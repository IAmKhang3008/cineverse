/**
 * api.ts — Hệ thống API kiên cường cho Cineverse
 * Bao gồm: Smart Retry + Jitter, Health Check, Parallel Fetch,
 * Image Hunter, Data Normalization Adapter
 */

import { fetchWithCache, TTL } from './cache';

// ============================================================
// CẤU HÌNH
// ============================================================
const PRIMARY_URL  = 'https://phimapi.com';
const FALLBACK_URL = 'https://ophim1.com';
const TMDB_KEY     = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

// Bao nhiêu lần retry trước khi bỏ cuộc với primary
const MAX_RETRIES   = 1;
// Thời gian chờ tối đa cho mỗi request primary (ms)
const PRIMARY_TIMEOUT = 10000;
// Nếu primary không trả lời sau bao nhiêu ms thì dùng fallback song song
const PARALLEL_THRESHOLD = 3000;
// Health check mỗi 30 giây khi đang ở chế độ fallback
const HEALTH_CHECK_INTERVAL = 30_000;

function fetchWithTimeout(url: string, timeoutMs: number, options: RequestInit = {}) {
  // Polyfill fallback for AbortSignal.timeout
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

// ============================================================
// TRẠNG THÁI API — theo dõi primary còn sống không
// ============================================================
const apiState = {
  usingFallback:   false,
  primaryDeadSince: 0,
  healthCheckTimer: null as ReturnType<typeof setInterval> | null,
  consecutiveFails: 0, // bao nhiêu lần fail liên tiếp

  // Chuyển sang fallback và bắt đầu health check ngầm
  switchToFallback() {
    if (this.usingFallback) return; // đã ở fallback rồi
    this.usingFallback    = true;
    this.primaryDeadSince = Date.now();
    console.warn('[API] Primary phimapi.com không phản hồi → chuyển sang ophim1.com');
    this.startHealthCheck();
  },

  // Quay về primary
  switchToPrimary() {
    this.usingFallback    = false;
    this.consecutiveFails = 0;
    this.primaryDeadSince = 0;
    console.info('[API] phimapi.com sống lại → tự động quay về primary ✅');
    this.stopHealthCheck();
  },

  startHealthCheck() {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(async () => {
      try {
        // Ping nhẹ — chỉ lấy 1 phim để test, không cache
        const res = await fetchWithTimeout(`${PRIMARY_URL}/danh-sach/phim-moi-cap-nhat?page=1`, 3000);
        if (res.ok) this.switchToPrimary();
      } catch {
        // Primary vẫn chết, giữ nguyên fallback
      }
    }, HEALTH_CHECK_INTERVAL);
  },

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  },
};

// ============================================================
// SMART RETRY VỚI EXPONENTIAL BACKOFF + JITTER
// Jitter = thêm số ngẫu nhiên vào thời gian chờ để tránh
// nhiều client retry cùng lúc gây nghẽn server
// ============================================================
async function retryWithJitter(
  fn: () => Promise<Response>,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;

      // Exponential backoff: 200ms, 400ms, 800ms...
      const base  = 200 * Math.pow(2, attempt);
      // Jitter: ±50% ngẫu nhiên để tránh thundering herd
      const jitter = base * (0.5 + Math.random() * 0.5);
      await sleep(jitter);
    }
  }

  throw lastError;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// PARALLEL FETCH
// Gửi request đến cả 2 API cùng lúc.
// Ưu tiên primary — nếu primary không trả lời trong
// PARALLEL_THRESHOLD ms thì dùng kết quả fallback.
// ============================================================
async function parallelFetch(endpoint: string): Promise<{ res: Response; source: 'primary' | 'fallback' }> {
  // Race giữa primary (có timeout ngắn) và fallback
  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackResult: { res: Response; source: 'fallback' } | null = null;

    const settle = (value: { res: Response; source: 'primary' | 'fallback' }) => {
      if (!settled) { settled = true; resolve(value); }
    };

    // --- Nhánh PRIMARY ---
    const primaryPromise = retryWithJitter(() =>
      fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; })
    );

    // Sau PARALLEL_THRESHOLD ms, nếu primary chưa xong → dùng fallback
    const fallbackTimer = setTimeout(async () => {
      try {
        const fRes = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
        if (!fRes.ok) return; // fallback cũng fail, chờ primary tiếp
        fallbackResult = { res: fRes, source: 'fallback' };
        // Chỉ dùng fallback nếu primary vẫn chưa xong
        primaryPromise.catch(() => {}); // tránh unhandled rejection
        if (!settled) settle(fallbackResult);
      } catch { /* fallback cũng chết, vẫn chờ primary */ }
    }, PARALLEL_THRESHOLD);

    // Primary trả lời trước → luôn dùng primary
    primaryPromise
      .then(res => {
        clearTimeout(fallbackTimer);
        apiState.consecutiveFails = 0;
        if (apiState.usingFallback) apiState.switchToPrimary();
        settle({ res, source: 'primary' });
      })
      .catch(err => {
        clearTimeout(fallbackTimer);
        apiState.consecutiveFails++;
        // Sau 2 lần fail liên tiếp mới chuyển fallback hẳn
        if (apiState.consecutiveFails >= 2) apiState.switchToFallback();

        if (fallbackResult) {
          settle(fallbackResult); // fallback đã có kết quả từ timer
        } else {
          // Cố gắng lần cuối với fallback
          fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT)
            .then(r => {
              if (r.ok) settle({ res: r, source: 'fallback' });
              else reject(err);
            })
            .catch(() => reject(err)); // luôn trả về lỗi của primary nếu fallback cũng lỗi
        }
      });
  });
}

// ============================================================
// IMAGE HUNTER — săn tìm ảnh chất lượng cao
// ============================================================

/**
 * Nâng cấp URL ảnh từ ophim1 lên chất lượng cao hơn.
 * ophim1 thường dùng: -thumb.jpg, _thumb.jpg, -poster.jpg
 * phimimg.com dùng URL gốc không có suffix
 */
function upgradeImageUrl(url: string): string {
  if (!url) return url;
  return url
    .replace(/-thumb(\.\w+)$/i, '$1')      // xóa -thumb
    .replace(/_thumb(\.\w+)$/i, '$1')      // xóa _thumb
    .replace(/-poster(\.\w+)$/i, '$1')     // xóa -poster
    .replace(/\/w\d+\//g, '/original/');   // TMDB: w500 → original
}

/**
 * Lấy ảnh từ TMDB dựa trên tên phim — dùng khi cả 2 API không có ảnh đẹp
 */
async function fetchTmdbImage(
  movieName: string,
  year?: string,
  type: 'poster' | 'banner' = 'poster',
): Promise<string> {
  try {
    const yearQuery = year ? `&year=${year}` : '';
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(movieName)}${yearQuery}&language=vi-VN`;
    const res  = await fetchWithTimeout(searchUrl, 5000);
    const data = await res.json();
    const hit  = data.results?.[0];
    if (!hit) return '';

    const path = type === 'poster' ? hit.poster_path : hit.backdrop_path;
    return path ? `https://image.tmdb.org/t/p/original${path}` : '';
  } catch {
    return ''; // silently fail
  }
}

/**
 * Hàm getImageUrl chính — xử lý mọi nguồn ảnh
 */
export const getImageUrl = (
  path: string,
  type: 'poster' | 'banner' = 'poster',
): string => {
  if (!path) return PLACEHOLDER_URL;

  // Ảnh đã là URL đầy đủ từ TMDB
  if (path.includes('image.tmdb.org')) return upgradeImageUrl(path);

  // Ảnh phimapi đã qua proxy
  if (path.includes('phimapi.com/image.php')) return path;

  // Ảnh ophim — thử nâng cấp URL trước
  if (path.includes('ophim.live') || path.includes('img.ophim')) {
    return upgradeImageUrl(path);
  }

  // Path tương đối từ phimimg.com
  if (path.includes('upload/vod/') || !path.startsWith('http')) {
    const fullUrl = path.startsWith('http')
      ? path
      : path.startsWith('/')
        ? `https://phimimg.com${path}`
        : `https://phimimg.com/${path}`;
    return `https://phimapi.com/image.php?url=${fullUrl}`;
  }

  // URL đầy đủ từ phimimg.com
  if (path.includes('phimimg.com')) {
    return `https://phimapi.com/image.php?url=${path}`;
  }

  return path;
};

// Placeholder ảnh mang thương hiệu Cineverse
// SVG inline — không cần network request, không bao giờ lỗi
export const PLACEHOLDER_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#121212"/>
  <rect x="0" y="0" width="300" height="4" fill="#E50914"/>
  <text x="150" y="200" font-family="sans-serif" font-size="48" fill="#E50914" text-anchor="middle">🎬</text>
  <text x="150" y="250" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">CINEVERSE</text>
  <text x="150" y="278" font-family="sans-serif" font-size="12" fill="#666666" text-anchor="middle">Đang cập nhật...</text>
</svg>
`)}`;

// ============================================================
// DATA NORMALIZATION — Adapter Pattern
// Chuẩn hóa data từ cả 2 nguồn về cùng 1 interface
// ============================================================
export interface NormalizedMovie {
  _id:          string;
  slug:         string;
  name:         string;
  origin_name:  string;
  poster_url:   string;
  thumb_url:    string;
  description:  string;
  content:      string; // alias of description for backward compat
  year:         string | number;
  quality:      string;
  lang:         string;
  time:         string;
  episode_current: string;
  episode_total:   string;
  type:         string;
  category:     { id: string; name: string; slug: string }[];
  country:      { id: string; name: string; slug: string }[];
  actor:        string[];
  director:     string[];
  tmdb?:        { id?: string; type?: string; vote_average?: number };
  trailer_url:  string;
  _source:      'primary' | 'fallback'; // metadata để debug
}

/**
 * Normalize data từ phimapi.com (primary)
 */
function normalizePrimary(raw: any): NormalizedMovie {
  const movie = raw.movie || raw;
  return {
    _id:             movie._id          || movie.id || '',
    slug:            movie.slug         || '',
    name:            movie.name         || '',
    origin_name:     movie.origin_name  || movie.name || '',
    poster_url:      getImageUrl(movie.poster_url || movie.thumb_url, 'poster'),
    thumb_url:       getImageUrl(movie.thumb_url  || movie.poster_url, 'banner'),
    description:     movie.content      || movie.description || '',
    content:         movie.content      || movie.description || '',
    year:            movie.year         || '',
    quality:         movie.quality      || 'HD',
    lang:            movie.lang         || 'Vietsub',
    time:            movie.time         || '',
    episode_current: movie.episode_current || 'Full',
    episode_total:   movie.episode_total   || '1',
    type:            movie.type         || 'movie',
    category:        normalizeCategories(movie.category),
    country:         normalizeCountries(movie.country),
    actor:           movie.actor        || [],
    director:        Array.isArray(movie.director) ? movie.director : (movie.director ? [movie.director] : []),
    tmdb:            movie.tmdb         || undefined,
    trailer_url:     movie.trailer_url  || '',
    _source:         'primary',
  };
}

/**
 * Normalize data từ ophim1.com (fallback)
 * ophim1 có cấu trúc khác — map các trường tương ứng
 */
function normalizeFallback(raw: any): NormalizedMovie {
  const movie = raw.movie || raw;

  // ophim1 dùng "chieuphim.org" CDN cho ảnh
  const rawPoster = movie.poster_url || movie.thumb_url || '';
  const rawThumb  = movie.thumb_url  || movie.poster_url || '';

  return {
    _id:             movie._id          || movie.id || '',
    slug:            movie.slug         || '',
    name:            movie.name         || '',
    origin_name:     movie.original_name || movie.origin_name || movie.name || '',
    poster_url:      upgradeImageUrl(getImageUrl(rawPoster, 'poster')),
    thumb_url:       upgradeImageUrl(getImageUrl(rawThumb,  'banner')),
    description:     movie.content      || movie.description || '',
    content:         movie.content      || movie.description || '',
    year:            movie.year         || '',
    quality:         movie.quality      || 'HD',
    lang:            movie.lang         || movie.language || 'Vietsub',
    time:            movie.time         || movie.duration || '',
    episode_current: movie.episode_current || movie.current_episode || 'Full',
    episode_total:   movie.episode_total   || movie.total_episodes  || '1',
    type:            movie.type         || (movie.category?.includes('series') ? 'series' : 'movie'),
    category:        normalizeCategories(movie.category),
    country:         normalizeCountries(movie.country),
    actor:           Array.isArray(movie.actor)    ? movie.actor    : [],
    director:        Array.isArray(movie.director) ? movie.director : (movie.director ? [movie.director] : []),
    tmdb:            undefined,
    trailer_url:     movie.trailer_url  || '',
    _source:         'fallback',
  };
}

function normalizeCategories(raw: any): NormalizedMovie['category'] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Object.values(raw);
  return arr.map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

function normalizeCountries(raw: any): NormalizedMovie['country'] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Object.values(raw);
  return arr.map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

// ============================================================
// CORE FETCH — kết hợp parallelFetch + normalize
// ============================================================
async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  let attemptPromise: Promise<{ res: Response; source: 'primary' | 'fallback' }>;

  if (apiState.usingFallback) {
    attemptPromise = fetch(`${FALLBACK_URL}${endpoint}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { res, source: 'fallback' } as { res: Response; source: 'fallback' };
      })
      .catch((e) => {
        console.warn('[API] Fallback also failed, retrying parallel', e);
        return parallelFetch(endpoint); // Nếu fallback lỗi, thử lại cả 2
      });
  } else {
    attemptPromise = parallelFetch(endpoint);
  }

  const { res, source } = await attemptPromise;
  const data = await res.json();
  return { data, source };
}

// ============================================================
// PUBLIC API
// ============================================================
export const api = {
  getNewUpdated: async (page = 1) => {
    return fetchWithCache(`new-updated:${page}`, async () => {
      const { data } = await apiFetch(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
      return {
        items: (data.items || data.data?.items || []).map(normalizePrimary),
        pagination: data.pagination || data.data?.pagination,
      };
    }, TTL.NEW_UPDATED);
  },

  getByCategory: async (slug: string, page = 1) => {
    return fetchWithCache(`category:${slug}:${page}`, async () => {
      const { data } = await apiFetch(`/v1/api/danh-sach/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return {
        items: items.map(normalizePrimary),
        pagination: data.data?.pagination,
      };
    }, TTL.CATEGORY_LIST);
  },

  getMovieDetail: async (slug: string) => {
    return fetchWithCache(`detail:${slug}`, async () => {
      const { data, source } = await apiFetch(`/phim/${slug}`);
      const normalized = source === 'primary'
        ? normalizePrimary(data)
        : normalizeFallback(data);

      // Nếu ảnh từ fallback bị xấu → thử săn ảnh TMDB
      if (source === 'fallback' && normalized.poster_url.includes('ophim')) {
        const tmdbPoster = await fetchTmdbImage(normalized.name, String(normalized.year), 'poster');
        const tmdbThumb  = await fetchTmdbImage(normalized.name, String(normalized.year), 'banner');
        if (tmdbPoster) normalized.poster_url = tmdbPoster;
        if (tmdbThumb)  normalized.thumb_url  = tmdbThumb;
      }

      return { movie: normalized, episodes: data.episodes || [] };
    }, TTL.MOVIE_DETAIL);
  },

  getByGenre: async (slug: string, page = 1) => {
    return fetchWithCache(`genre:${slug}:${page}`, async () => {
      const { data } = await apiFetch(`/v1/api/the-loai/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map(normalizePrimary), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST);
  },

  getByCountry: async (slug: string, page = 1) => {
    return fetchWithCache(`country:${slug}:${page}`, async () => {
      const { data } = await apiFetch(`/v1/api/quoc-gia/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map(normalizePrimary), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST);
  },

  getByYear: async (year: string, page = 1) => {
    return fetchWithCache(`year:${year}:${page}`, async () => {
      const { data } = await apiFetch(`/v1/api/nam/${year}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map(normalizePrimary), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST);
  },

  search: async (keyword: string, page = 1) => {
    return fetchWithCache(`search:${keyword}:${page}`, async () => {
      const { data } = await apiFetch(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map(normalizePrimary), pagination: data.data?.pagination };
    }, TTL.SEARCH);
  },

  // Lấy trạng thái API hiện tại — dùng để debug hoặc hiển thị UI
  getApiStatus: () => ({
    usingFallback:    apiState.usingFallback,
    primaryDeadSince: apiState.primaryDeadSince,
    consecutiveFails: apiState.consecutiveFails,
    currentSource:    apiState.usingFallback ? 'ophim1.com' : 'phimapi.com',
  }),

  getTrendingFromTMDB: async () => {
    try {
      const res  = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_KEY}&language=vi-VN`);
      const data = await res.json();
      return data.results.map((m: any): Partial<NormalizedMovie> => ({
        _id:         m.id.toString(),
        name:        m.title       || m.name,
        origin_name: m.original_title || m.original_name,
        thumb_url:   m.poster_path   ? `https://image.tmdb.org/t/p/w500${m.poster_path}`    : PLACEHOLDER_URL,
        poster_url:  m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : PLACEHOLDER_URL,
        year:        m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0] || '',
        description: m.overview || '',
        slug:        `search?q=${encodeURIComponent(m.title || m.name)}`,
        _source:     'primary',
      }));
    } catch {
      return [];
    }
  },
};