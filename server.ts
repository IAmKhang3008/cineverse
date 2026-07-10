import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // ─────────────────────────────────────────────────────────────
  // IN-MEMORY CACHE FOR GOOGLE SEARCH POSTERS
  // ─────────────────────────────────────────────────────────────
  interface CacheEntry {
    imageUrl: string | null;
    expiresAt: number;
  }
  const posterCache = new Map<string, CacheEntry>();
  const CACHE_TTL_SUCCESS = 24 * 60 * 60 * 1000; // 24 hours
  const CACHE_TTL_FAIL = 2 * 60 * 60 * 1000;    // 2 hours (avoid hammering on failures)

  // ─────────────────────────────────────────────────────────────
  // SEQUENTIAL RATE-LIMITED EXECUTION QUEUE (max 1 concurrency, 1500ms delay)
  // ─────────────────────────────────────────────────────────────
  let queuePromise = Promise.resolve();
  let currentQueueLength = 0;
  const MAX_QUEUE_DEPTH = 12; // Reject new requests instantly if busy to protect server & client load time

  function enqueueTask<T>(task: () => Promise<T>): Promise<T> {
    const current = queuePromise;
    let resolveNext: () => void = () => {};
    queuePromise = new Promise((resolve) => {
      resolveNext = resolve;
    });

    return new Promise(async (resolve, reject) => {
      try {
        await current;
      } catch (e) {
        // Ignore previous task errors
      }

      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        // Enforce 1500ms separation delay between Gemini requests to stay well within quota/RPM limit
        setTimeout(resolveNext, 1500);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // API ROUTE: GEMINI GOOGLE SEARCH POSTER PROXY
  // ─────────────────────────────────────────────────────────────
  app.get("/api/poster-search", async (req, res) => {
    const { title, year } = req.query;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title parameter is required." });
    }

    // 1. Check in-memory cache first
    const cacheKey = `${title.toLowerCase().trim()}_${(year || "").toString().trim()}`;
    const cached = posterCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[SERVER] Cache HIT for "${title}": ${cached.imageUrl}`);
      if (cached.imageUrl) {
        return res.json({ imageUrl: cached.imageUrl });
      } else {
        return res.status(404).json({ error: "No direct poster image URL found (cached failure)." });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[SERVER] Missing GEMINI_API_KEY. Returning 503.");
      return res.status(503).json({
        error: "Gemini API key is not configured on the server. Please add GEMINI_API_KEY in the platform's Secrets menu."
      });
    }

    // 2. Enforce queue limit to prevent infinite pileup
    if (currentQueueLength >= MAX_QUEUE_DEPTH) {
      console.warn(`[SERVER] Queue full (${currentQueueLength}/${MAX_QUEUE_DEPTH}). Bypassing search for "${title}".`);
      return res.status(429).json({ error: "Too many pending search requests. Try again later." });
    }

    currentQueueLength++;

    try {
      const result = await enqueueTask(async () => {
        console.log(`[SERVER] Running Gemini search for "${title}" ${year ? `(${year})` : ""}... Queue depth: ${currentQueueLength}`);
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        // We ask Gemini to search the web using Google Search grounding for the official high-quality movie poster URL.
        const prompt = `You are a movie metadata assistant. Search the web using Google Search to find the official high-quality poster image URL for the movie "${title}" ${year ? `(${year})` : ""}.
Find a direct, hotlinkable image URL from a highly reliable site (e.g. TMDB, IMDb, Wikipedia, or fanart.tv).
Respond ONLY with a valid JSON object matching this schema:
{
  "imageUrl": "https://..."
}
Do not include any explanation, other fields, or markdown code blocks.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
          },
        });

        const text = response.text?.trim() || "";
        if (!text) {
          throw new Error("Empty response from Gemini.");
        }

        const parsed = JSON.parse(text);
        if (parsed.imageUrl && parsed.imageUrl.startsWith("http")) {
          return parsed.imageUrl as string;
        }
        return null;
      });

      currentQueueLength--;

      if (result) {
        console.log(`[SERVER] Found poster URL for "${title}": ${result}`);
        posterCache.set(cacheKey, { imageUrl: result, expiresAt: Date.now() + CACHE_TTL_SUCCESS });
        return res.json({ imageUrl: result });
      } else {
        console.log(`[SERVER] No poster URL found for "${title}". Caching failure.`);
        posterCache.set(cacheKey, { imageUrl: null, expiresAt: Date.now() + CACHE_TTL_FAIL });
        return res.status(404).json({ error: "No direct poster image URL found in search results." });
      }
    } catch (err: any) {
      currentQueueLength--;
      console.error(`[SERVER] Error during Gemini search for "${title}":`, err);

      // Cache the failure/error to prevent rapid re-queries
      posterCache.set(cacheKey, { imageUrl: null, expiresAt: Date.now() + CACHE_TTL_FAIL });

      return res.status(500).json({ error: err.message || "Failed to search for movie poster." });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // API ROUTE: TMDB PROXY TO PREVENT CORS AND HIDE KEY
  // ─────────────────────────────────────────────────────────────
  app.get("/api/tmdb/*", async (req, res) => {
    // Extract subpath after /api/tmdb/
    const subPath = req.path.replace(/^\/api\/tmdb\//, "");
    if (!subPath) {
      return res.status(400).json({ error: "Subpath is required." });
    }

    const queryParams = { ...req.query };

    // Get TMDB API key from server environment, fallback to the default key securely on the server
    const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || "15d2ea6d0dc1d476efbca3eba2b9bbfb";
    queryParams.api_key = apiKey;

    // Reconstruct query string
    const queryString = new URLSearchParams(queryParams as any).toString();
    const tmdbUrl = `https://api.themoviedb.org/3/${subPath}${queryString ? `?${queryString}` : ""}`;

    try {
      const response = await fetch(tmdbUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "aistudio-build-tmdb-proxy"
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `TMDB returned error status ${response.status}` });
      }

      const data = await response.json();
      return res.json(data);
    } catch (err: any) {
      console.error(`[SERVER] Error proxying TMDB request to ${subPath}:`, err);
      return res.status(500).json({ error: err.message || "Failed to proxy request to TMDB." });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
  });

  // ─────────────────────────────────────────────────────────────
  // VITE MIDDLEWARE OR STATIC SERVING
  // ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Starting in DEVELOPMENT mode using Vite middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SERVER] Starting in PRODUCTION mode serving built static files.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Cineverse is running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[SERVER] Failed to start server:", err);
  process.exit(1);
});
