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
};
