const BASE_URL = "https://phimapi.com";

export const getImageUrl = (path: string, type: 'poster' | 'banner' = 'poster') => {
  if (!path) return '';
  if (path.includes('phimapi.com/image.php')) return path;
  let fullUrl = path;
  if (!path.startsWith('http')) {
    fullUrl = path.startsWith('/') ? `https://phimimg.com${path}` : `https://phimimg.com/${path}`;
  }
  return `https://phimapi.com/image.php?url=${fullUrl}`;
};

export const api = {
  getNewUpdated: async (page = 1) => {
    const res = await fetch(`${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`);
    const data = await res.json();
    return data;
  },
  getByCategory: async (slug: string, page = 1) => {
    const res = await fetch(`${BASE_URL}/v1/api/danh-sach/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getMovieDetail: async (slug: string) => {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    return res.json();
  },
  getByGenre: async (slug: string, page = 1) => {
    const res = await fetch(`${BASE_URL}/v1/api/the-loai/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getByCountry: async (slug: string, page = 1) => {
    const res = await fetch(`${BASE_URL}/v1/api/quoc-gia/${slug}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  getByYear: async (year: string, page = 1) => {
    const res = await fetch(`${BASE_URL}/v1/api/nam/${year}?page=${page}`);
    const data = await res.json();
    return { items: data.data?.items || [], pagination: data.data?.pagination };
  },
  search: async (keyword: string, page = 1) => {
    const res = await fetch(`${BASE_URL}/v1/api/tim-kiem?keyword=${keyword}&page=${page}`);
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
