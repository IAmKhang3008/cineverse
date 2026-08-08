// High-performance poster resolver with memory & storage caching

const posterCache = new Map<string, string>();
const verifiedTmdbUrls = new Set<string>();
const failedTmdbUrls = new Set<string>();

const LOCAL_PLACEHOLDER = '/images/no-poster.svg';

/**
 * Checks if an image URL is reachable within timeout (default 3000ms)
 */
async function testImageUrl(url: string, timeoutMs: number = 3000): Promise<boolean> {
  if (verifiedTmdbUrls.has(url)) return true;
  if (failedTmdbUrls.has(url)) return false;

  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        img.src = '';
        failedTmdbUrls.add(url);
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        verifiedTmdbUrls.add(url);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        failedTmdbUrls.add(url);
        resolve(false);
      }
    };

    // Trigger load
    img.src = url;
  });
}

/**
 * Gets the best available poster URL:
 * 1. Checks in-memory cache for instant 0ms resolution
 * 2. Tries TMDB CDN (https://image.tmdb.org/t/p/w500...) if poster_path exists
 * 3. Verifies TMDB image accessibility with 3s timeout
 * 4. Falls back to phimapi.com URL or local placeholder if TMDB fails
 */
export async function getMoviePoster(
  poster_path?: string | null,
  title?: string,
  fallbackUrl?: string | null,
  size: string = 'w500'
): Promise<string> {
  const cacheKey = `${poster_path || ''}_${title || ''}_${fallbackUrl || ''}_${size}`;
  
  if (posterCache.has(cacheKey)) {
    return posterCache.get(cacheKey)!;
  }

  // Try TMDB path construct
  let candidateTmdbUrl: string | null = null;

  if (poster_path) {
    if (poster_path.startsWith('http://') || poster_path.startsWith('https://')) {
      candidateTmdbUrl = poster_path;
    } else {
      const cleanPath = poster_path.startsWith('/') ? poster_path : `/${poster_path}`;
      candidateTmdbUrl = `https://image.tmdb.org/t/p/${size}${cleanPath}`;
    }
  }

  if (candidateTmdbUrl) {
    const isOk = await testImageUrl(candidateTmdbUrl, 3000);
    if (isOk) {
      posterCache.set(cacheKey, candidateTmdbUrl);
      return candidateTmdbUrl;
    }
  }

  // Fallback URL handling (e.g. from phimapi.com)
  let validFallback = fallbackUrl || null;
  if (validFallback && validFallback.includes('phimapi.com/image.php')) {
    // Already formatted
  } else if (validFallback && !validFallback.startsWith('http')) {
    validFallback = `https://phimapi.com/image.php?url=${encodeURIComponent(validFallback)}`;
  }

  const result = validFallback || LOCAL_PLACEHOLDER;
  posterCache.set(cacheKey, result);
  return result;
}

/**
 * Generates responsive srcSet and sizes props for TMDB images
 */
export function getPosterSrcSet(url: string | null | undefined): { srcSet?: string; sizes?: string } | null {
  if (!url || !url.includes('image.tmdb.org/t/p/')) return null;

  const basePath = url.substring(url.lastIndexOf('/'));
  return {
    srcSet: `https://image.tmdb.org/t/p/w185${basePath} 185w, https://image.tmdb.org/t/p/w342${basePath} 342w, https://image.tmdb.org/t/p/w500${basePath} 500w, https://image.tmdb.org/t/p/w780${basePath} 780w`,
    sizes: '(max-width: 480px) 185px, (max-width: 768px) 342px, (max-width: 1200px) 500px, 780px'
  };
}
export function getMoviePosterSync(
  poster_path?: string | null,
  fallbackUrl?: string | null,
  size: string = 'w500'
): string {
  if (poster_path) {
    if (poster_path.startsWith('http')) return poster_path;
    const cleanPath = poster_path.startsWith('/') ? poster_path : `/${poster_path}`;
    const tmdbUrl = `https://image.tmdb.org/t/p/${size}${cleanPath}`;
    if (!failedTmdbUrls.has(tmdbUrl)) {
      return tmdbUrl;
    }
  }

  if (fallbackUrl) {
    if (fallbackUrl.startsWith('http')) return fallbackUrl;
    return `https://phimapi.com/image.php?url=${encodeURIComponent(fallbackUrl)}`;
  }

  return LOCAL_PLACEHOLDER;
}
