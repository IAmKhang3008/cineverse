import { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/api";

const CACHE_KEY_PREFIX = "poster_cache_v1_";

export function useMoviePoster(
  slug: string,
  movieName: string,
  movieYear?: string | number,
  initialPoster?: string,
  initialThumb?: string,
  allowBackendSearch: boolean = false
) {
  const [src, setSrc] = useState<string>(() => {
    if (!slug) return "";
    try {
      return localStorage.getItem(`${CACHE_KEY_PREFIX}${slug}`) || "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!slug) return false;
    try {
      return !localStorage.getItem(`${CACHE_KEY_PREFIX}${slug}`);
    } catch {
      return true;
    }
  });
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!slug) return;

    let isMounted = true;

    // 1. Check local storage cache first
    const cacheKey = `${CACHE_KEY_PREFIX}${slug}`;
    try {
      const cachedUrl = localStorage.getItem(cacheKey);
      if (cachedUrl) {
        if (isMounted) {
          setSrc(cachedUrl);
          setLoading(false);
        }
        return;
      }
    } catch (e) {
      console.warn("[Cache] Failed to read from localStorage:", e);
    }

    if (isMounted) {
      setSrc(""); // Clear previous poster so we don't show old images while loading
      setLoading(true);
      setError(false);
    }

    // 2. Build candidate fallback URL queue
    const candidateUrls: string[] = [];

    if (initialPoster) candidateUrls.push(getImageUrl(initialPoster, "poster"));
    if (initialThumb) candidateUrls.push(getImageUrl(initialThumb, "poster"));
    if (initialPoster && initialPoster !== initialThumb) candidateUrls.push(getImageUrl(initialPoster, "banner"));
    if (initialThumb && initialPoster !== initialThumb) candidateUrls.push(getImageUrl(initialThumb, "banner"));

    // Filter duplicates, empty values, or default placeholder indicators
    const queue = Array.from(new Set(candidateUrls)).filter(
      (url) => url && !url.includes("placeholder") && !url.startsWith("data:")
    );

    let currentIdx = 0;

    const tryNext = async () => {
      if (!isMounted) return;

      if (currentIdx < queue.length) {
        const urlToTest = queue[currentIdx];
        currentIdx++;

        const img = new Image();
        img.src = urlToTest;
        img.onload = () => {
          if (isMounted) {
            setSrc(urlToTest);
            setLoading(false);
            try {
              localStorage.setItem(cacheKey, urlToTest);
            } catch (e) {
              console.warn("[Cache] Failed to write localStorage:", e);
            }
          }
        };
        img.onerror = () => {
          tryNext(); // Try the next candidate in the queue
        };
      } else {
        // 3. Fallback: Query Google Image Search via Express proxy on the backend only if allowed
        if (allowBackendSearch) {
          try {
            console.info(`[useMoviePoster] Direct URLs failed/missing for "${movieName}". Querying backend Gemini-Search...`);
            const yearParam = movieYear ? `&year=${movieYear}` : "";
            const response = await fetch(
              `/api/poster-search?title=${encodeURIComponent(movieName)}${yearParam}`
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.imageUrl && isMounted) {
                const googleUrl = getImageUrl(data.imageUrl, "poster");
                
                // Verify that the Google-discovered image can actually load
                const img = new Image();
                img.src = googleUrl;
                img.onload = () => {
                  if (isMounted) {
                    setSrc(googleUrl);
                    setLoading(false);
                    try {
                      localStorage.setItem(cacheKey, googleUrl);
                    } catch {}
                  }
                };
                img.onerror = () => {
                  usePlaceholder();
                };
                return;
              }
            }
          } catch (err) {
            console.warn("[useMoviePoster] Google/Gemini search fallback failed:", err);
          }
        }

        // Ultimate fallback: Render the beautiful placeholder SVG
        usePlaceholder();
      }
    };

    const usePlaceholder = () => {
      if (isMounted) {
        setSrc(getImageUrl("", "poster"));
        setLoading(false);
        setError(true);
      }
    };

    tryNext();

    return () => {
      isMounted = false;
    };
  }, [slug, movieName, movieYear, initialPoster, initialThumb]);

  return { src, loading, error };
}
