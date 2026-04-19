const PRIMARY_BASE_URL = "https://phimapi.com";
const FALLBACK_BASE_URL = "https://ophim1.com";

let currentBaseUrl = PRIMARY_BASE_URL;

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;   // data hết hạn sau 5 phút
const MAX_ENTRIES = 100;             // tối đa 100 entries

// Dọn rác mỗi 10 phút
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export async function fetchWithCache(key: string, fetcher: () => Promise<any>) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetcher();

  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }

  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

const fetchWithFallback = async (endpoint: string) => {
  let attemptUrl = currentBaseUrl;
  try {
    const res = await fetch(`${attemptUrl}${endpoint}`);
    if (!res.ok) throw new Error('Network response was not ok');
    return res;
  } catch (error) {
    // If the attempt was with the primary URL, retry with the fallback URL
    if (attemptUrl === PRIMARY_BASE_URL) {
      console.warn(`Primary API failed, switching to fallback: ${FALLBACK_BASE_URL}`);
      currentBaseUrl = FALLBACK_BASE_URL;
      const fallbackRes = await fetch(`${FALLBACK_BASE_URL}${endpoint}`);
      if (!fallbackRes.ok) throw new Error('Network response was not ok');
      return fallbackRes;
    }
    // If the attempt was already with the fallback URL, just throw the error
    throw error;
  }
};

export const getImageUrl = (path: string, type: 'poster' | 'banner' = 'poster') => {
  if (!path) return '';
  if (path.includes('phimapi.com/image.php')) return path;
  if (path.includes('ophim.live')) return path;
  if (path.includes('phimimg.com')) {
    return `https://phimapi.com/image.php?url=${path}`;
  }
  
  let fullUrl = path;
  if (!path.startsWith('http')) {
    // Check if the path looks like a phimapi path (e.g., upload/vod/...)
    if (path.includes('upload/vod/')) {
      fullUrl = path.startsWith('/') ? `https://phimimg.com${path}` : `https://phimimg.com/${path}`;
      return `https://phimapi.com/image.php?url=${fullUrl}`;
    } else {
      // Otherwise, assume it's an ophim1 path
      fullUrl = path.startsWith('/') ? `https://img.ophim.live/uploads/movies${path}` : `https://img.ophim.live/uploads/movies/${path}`;
      return fullUrl;
    }
  }
  
  // If it's already a full HTTP URL but not caught by above
  if (currentBaseUrl === FALLBACK_BASE_URL) {
    return fullUrl;
  }
  
  return `https://phimapi.com/image.php?url=${fullUrl}`;
};

export const api = {
  getNewUpdated: async (page = 1) => {
    return fetchWithCache(`new-updated-${page}`, async () => {
      const res = await fetchWithFallback(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
      return await res.json();
    });
  },
  getByCategory: async (slug: string, page = 1) => {
    return fetchWithCache(`category-${slug}-${page}`, async () => {
      const res = await fetchWithFallback(`/v1/api/danh-sach/${slug}?page=${page}`);
      const data = await res.json();
      return { items: data.data?.items || [], pagination: data.data?.pagination };
    });
  },
  getMovieDetail: async (slug: string) => {
    return fetchWithCache(`detail-${slug}`, async () => {
      const res = await fetchWithFallback(`/phim/${slug}`);
      return await res.json();
    });
  },
  getByGenre: async (slug: string, page = 1) => {
    return fetchWithCache(`genre-${slug}-${page}`, async () => {
      const res = await fetchWithFallback(`/v1/api/the-loai/${slug}?page=${page}`);
      const data = await res.json();
      return { items: data.data?.items || [], pagination: data.data?.pagination };
    });
  },
  getByCountry: async (slug: string, page = 1) => {
    return fetchWithCache(`country-${slug}-${page}`, async () => {
      const res = await fetchWithFallback(`/v1/api/quoc-gia/${slug}?page=${page}`);
      const data = await res.json();
      return { items: data.data?.items || [], pagination: data.data?.pagination };
    });
  },
  getByYear: async (year: string, page = 1) => {
    return fetchWithCache(`year-${year}-${page}`, async () => {
      const res = await fetchWithFallback(`/v1/api/nam/${year}?page=${page}`);
      const data = await res.json();
      return { items: data.data?.items || [], pagination: data.data?.pagination };
    });
  },
  search: async (keyword: string, page = 1) => {
    return fetchWithCache(`search-${keyword}-${page}`, async () => {
      const res = await fetchWithFallback(`/v1/api/tim-kiem?keyword=${keyword}&page=${page}`);
      const data = await res.json();
      return { items: data.data?.items || [], pagination: data.data?.pagination };
    });
  },
  getTrendingFromTMDB: async () => {
    try {
      const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${apiKey}&language=vi-VN`);
      const data = await res.json();
      
      const items = data.results.map((m: any) => ({
        _id: m.id.toString(),
        name: m.title || m.name,
        origin_name: m.original_title || m.original_name,
        thumb_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        poster_url: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : '',
        year: m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0] || '',
        is_tmdb: true,
        tmdb_id: m.id,
        media_type: m.media_type,
        content: m.overview,
        slug: `search?q=${encodeURIComponent(m.title || m.name)}`
      }));
      return items;
    } catch (error) {
      console.error("TMDB error", error);
      return [];
    }
  },
};
