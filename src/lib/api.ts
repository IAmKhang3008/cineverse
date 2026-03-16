const PRIMARY_BASE_URL = "https://phimapi.com";
const FALLBACK_BASE_URL = "https://ophim1.com";

let currentBaseUrl = PRIMARY_BASE_URL;

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
    const res = await fetchWithFallback(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
    const data = await res.json();
    return data;
  },
  getByCategory: async (slug: string, page = 1) => {
    const res = await fetchWithFallback(`/v1/api/danh-sach/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getMovieDetail: async (slug: string) => {
    const res = await fetchWithFallback(`/phim/${slug}`);
    return res.json();
  },
  getByGenre: async (slug: string, page = 1) => {
    const res = await fetchWithFallback(`/v1/api/the-loai/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getByCountry: async (slug: string, page = 1) => {
    const res = await fetchWithFallback(`/v1/api/quoc-gia/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getByYear: async (year: string, page = 1) => {
    const res = await fetchWithFallback(`/v1/api/nam/${year}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  search: async (keyword: string, page = 1) => {
    const res = await fetchWithFallback(`/v1/api/tim-kiem?keyword=${keyword}&page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
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
