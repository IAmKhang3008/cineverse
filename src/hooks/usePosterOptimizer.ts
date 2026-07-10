import { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/api";

const CACHE_KEY_PREFIX = "poster_cache_v1_";
const memoryCache = new Map<string, string>();

export function usePosterOptimizer(slug: string, rawUrl: string) {
  const [url, setUrl] = useState<string>(() => {
    if (!slug) return "";

    // Check memory cache first (ultra-fast)
    if (memoryCache.has(slug)) {
      return memoryCache.get(slug)!;
    }

    // Check localStorage
    try {
      const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${slug}`);
      if (cached) {
        memoryCache.set(slug, cached);
        return cached;
      }
    } catch {
      // Ignore localStorage errors
    }

    // Default to the upgraded proxy URL
    return getImageUrl(rawUrl, "poster");
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const currentUrl = getImageUrl(rawUrl, "poster");
    if (currentUrl && currentUrl !== memoryCache.get(slug)) {
      memoryCache.set(slug, currentUrl);
      try {
        localStorage.setItem(`${CACHE_KEY_PREFIX}${slug}`, currentUrl);
      } catch {
        // Ignore localStorage errors
      }
      setUrl(currentUrl);
    }
  }, [slug, rawUrl]);

  return {
    imageData: url ? { url, type: "direct" as const } : null,
    isLoading,
    error: null,
  };
}
