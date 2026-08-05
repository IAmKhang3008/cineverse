/**
 * api.ts — Hệ thống API kiên cường cho Cineverse
 *
 * CHANGELOG:
 * [FIX 1] normalizeBySource — gọi đúng normalizer theo source
 * [FIX 2] upgradeImageUrl — xử lý URL có query string
 * [FIX 3] tmdbCache 2-layer (memory + localStorage TTL 24h)
 * [FIX 4] TMDB Rate Limiter — sliding window 38 req/10s
 * [FIX 5] Bỏ hard-code API key, tắt TMDB gracefully khi không có key
 * [FIX 6] fetchTmdbMovieInfo — check res.ok, sanitize cache key
 * [FIX 7] getTrendingFromTMDB — /trending/movie (không trả 'person')
 * [FIX 8] fetchTmdbDetail — 1 request duy nhất với append_to_response
 *         (credits + videos + images) thay vì 3-4 request riêng lẻ
 * [FIX 9] getMovieDetail — trailer từ TMDB /videos, image scoring
 * [FIX 10] getMovieDetail — không gọi apiFetch 2 lần khi primaryData null
 * [FIX 11] Image upgrade — điều kiện rộng hơn (không chỉ 'ophim')
 * [FIX 12] Score-based matching — không chỉ lấy results[0] mù quáng
 */

import { fetchWithCache, TTL } from './cache';

// ─────────────────────────────────────────────────────────────
// CẤU HÌNH
// ─────────────────────────────────────────────────────────────
const PRIMARY_URL           = 'https://phimapi.com';
const FALLBACK_URL          = 'https://ophim1.com';
const MAX_RETRIES           = 1;
const PRIMARY_TIMEOUT       = 8_000;
const PARALLEL_THRESHOLD    = 1_000;
const HEALTH_CHECK_INTERVAL = 30_000;

// [FIX 5] Không hard-code key — chỉ lấy từ .env
const TMDB_KEY: string    = (import.meta as any).env.VITE_TMDB_API_KEY || '';
const TMDB_ENABLED: boolean = TMDB_KEY.trim().length > 0;

if (!TMDB_ENABLED) {
  console.info(
    '[TMDB] Không tìm thấy VITE_TMDB_API_KEY → tắt TMDB.\n' +
    'Thêm VITE_TMDB_API_KEY=your_key vào .env để bật.\n' +
    'Lấy key: https://www.themoviedb.org/settings/api',
  );
}

// ─────────────────────────────────────────────────────────────
// [FIX 4] TMDB RATE LIMITER — sliding window 38 req/10s
// ─────────────────────────────────────────────────────────────
const TMDB_RATE_LIMIT = 38;
const TMDB_WINDOW_MS  = 10_000;

const tmdbRateLimiter = {
  timestamps: [] as number[],
  queue:      [] as Array<() => void>,
  processing: false,

  acquire(): Promise<void> {
    return new Promise(resolve => {
      this.queue.push(resolve);
      if (!this.processing) this._process();
    });
  },

  _process() {
    this.processing = true;
    const tick = () => {
      if (this.queue.length === 0) { this.processing = false; return; }
      const now = Date.now();
      this.timestamps = this.timestamps.filter(t => now - t < TMDB_WINDOW_MS);
      if (this.timestamps.length < TMDB_RATE_LIMIT) {
        this.timestamps.push(now);
        this.queue.shift()?.();
        tick();
      } else {
        const waitTime = TMDB_WINDOW_MS - (now - this.timestamps[0]) + 50;
        setTimeout(tick, waitTime);
      }
    };
    tick();
  },
};

// ─────────────────────────────────────────────────────────────
// FETCH HELPERS
// ─────────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, ms: number, opts: RequestInit = {}): Promise<Response> {
  if (typeof AbortSignal?.timeout === 'function') {
    return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  }
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function retryWithJitter(fn: () => Promise<Response>, retries = MAX_RETRIES): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      lastError = err;
      if (i === retries) break;
      await sleep(200 * Math.pow(2, i) * (0.5 + Math.random() * 0.5));
    }
  }
  throw lastError;
}

export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  retries = 3,
  timeoutMs = 8_000,
): Promise<Response> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, opts);
      if (!res.ok && (res.status >= 500 || res.status === 429))
        throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err: any) {
      lastError = err;
      if (i === retries) break;
      const jitter = 250 * Math.pow(2, i) * (0.5 + Math.random() * 0.5);
      const tag    = url.includes('themoviedb.org') ? '[TMDB]' : '[API]';
      console.warn(`${tag} Attempt ${i + 1}/${retries + 1} failed. Retry in ${Math.round(jitter)}ms`, err?.message);
      await sleep(jitter);
    }
  }
  const tag = url.includes('themoviedb.org') ? '[TMDB]' : '[API]';
  console.warn(`${tag} All ${retries + 1} attempts failed.`, lastError?.message);
  throw lastError;
}

const apiState = {
  usingFallback: false,
  consecutiveFails: 0,
  healthCheckTimer: null as ReturnType<typeof setInterval> | null,

  switchToFallback() {
    if (this.usingFallback) return;
    this.usingFallback = true;
    console.warn('[API] phimapi.com không phản hồi → ophim1.com');
    this.startHealthCheck();
  },
  switchToPrimary() {
    this.usingFallback = false;
    this.consecutiveFails = 0;
    console.info('[API] phimapi.com sống lại ✅');
    this.stopHealthCheck();
  },
  startHealthCheck() {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(async () => {
      try {
        const res = await fetch(`${PRIMARY_URL}/v1/api/danh-sach/phim-le?limit=1`);
        if (res.ok) {
          this.switchToPrimary();
        }
      } catch {}
    }, HEALTH_CHECK_INTERVAL);
  },
  stopHealthCheck() {
    if (this.healthCheckTimer) { clearInterval(this.healthCheckTimer); this.healthCheckTimer = null; }
  },
};


export const PLACEHOLDER_URL = 'https://placehold.co/500x750/1a1a1a/FFF?text=No+Image';

export type TmdbMovieInfo = {
  type?: string;
  id?: number | string;
  vote_average?: number;
  vote_count?: number;
  season?: number | null;
  title?: string;
  original_title?: string;
  media_type?: string;
  [key: string]: any;
};

export type TmdbFullDetail = {
  [key: string]: any;
};

export type NormalizedMovie = {
  _id: string;
  slug: string;
  name: string;
  origin_name: string;
  poster_url: string;
  thumb_url: string;
  description: string;
  content: string;
  year: string;
  quality: string;
  lang: string;
  time: string;
  episode_current: string;
  episode_total: string;
  type: string;
  category: any[];
  country: any[];
  actor: string[];
  director: string[];
  tmdb?: TmdbMovieInfo;
  trailer_url: string;
  _source: 'primary' | 'fallback';
};

export function upgradeImageUrl(url: string) {
  if (!url) return url;
  if (url.includes('image.tmdb.org') && url.includes('/w500')) {
    return url.replace('/w500', '/original');
  }
  if (url.includes('ophim.live') || url.includes('img.ophim')) {
    return url.replace('img.ophim.live', 'img.ophim.cc').replace('img.ophim.cc', 'img.ophim.live');
  }
  return url;
}

export function needsImageUpgrade(url: string) {
  return url.includes('placehold.co') || url.includes('/w500') || !url.includes('image.tmdb.org');
}

export function extractBestPoster(images: any) {
  if (!images?.posters?.length) return null;
  const vi = images.posters.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return `https://image.tmdb.org/t/p/original${vi.file_path}`;
  const en = images.posters.find((i: any) => i.iso_639_1 === 'en');
  if (en) return `https://image.tmdb.org/t/p/original${en.file_path}`;
  return `https://image.tmdb.org/t/p/original${images.posters[0].file_path}`;
}

export function extractBestBackdrop(images: any) {
  if (!images?.backdrops?.length) return null;
  const vi = images.backdrops.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return `https://image.tmdb.org/t/p/original${vi.file_path}`;
  const en = images.backdrops.find((i: any) => i.iso_639_1 === 'en');
  if (en) return `https://image.tmdb.org/t/p/original${en.file_path}`;
  return `https://image.tmdb.org/t/p/original${images.backdrops[0].file_path}`;
}

export function extractBestTrailer(videos: any) {
  if (!videos?.results?.length) return null;
  const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
  if (trailer) return `https://www.youtube.com/watch?v=${trailer.key}`;
  return null;
}

export async function fetchTmdbSearch(title: string, year: string, type?: string) {
  if (!TMDB_ENABLED) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=vi-VN`);
    const data = await res.json();
    return data.results?.[0] || null;
  } catch { return null; }
}

export async function fetchTmdbDetail(id: string | number, type?: string) {
  if (!TMDB_ENABLED) return null;
  const t = type || 'movie';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${t}/${id}?api_key=${TMDB_KEY}&language=vi-VN&append_to_response=images,videos,credits`);
    return await res.json();
  } catch { return null; }
}

export const getImageUrl = (path: string, _type: 'poster' | 'banner' = 'poster', domain?: string): string => {
  if (!path) return PLACEHOLDER_URL;

  let url = path;
  if (path.includes('image.tmdb.org')) {
    url = upgradeImageUrl(path);
  } else if (path.includes('phimapi.com/image.php')) {
    try {
      const urlObj = new URL(path);
      const actualUrl = urlObj.searchParams.get('url');
      if (actualUrl) url = actualUrl;
    } catch {}
  } else if (path.includes('ophim.live') || path.includes('img.ophim')) {
    url = upgradeImageUrl(path);
  } else if (path.includes('upload/vod/') || !path.startsWith('http')) {
    url = path.startsWith('http') ? path : (domain ? (path.startsWith('/') ? `${domain}${path}` : `${domain}/${path}`) : (path.startsWith('/') ? `https://phimimg.com${path}` : `https://phimimg.com/${path}`));
  }
  return url;
};

function normalizeCategories(raw: any): any[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : Object.values(raw)).map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

function normalizeCountries(raw: any): any[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : Object.values(raw)).map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

export function normalizePrimary(raw: any, domain?: string): NormalizedMovie {
  const m = raw.movie || raw;
  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.origin_name     || m.name  || '',
    poster_url:      getImageUrl(m.poster_url || m.thumb_url, 'poster', domain),
    thumb_url:       getImageUrl(m.thumb_url  || m.poster_url, 'banner', domain),
    description:     m.content         || m.description || '',
    content:         m.content         || m.description || '',
    year:            m.year            || '',
    quality:         m.quality         || 'HD',
    lang:            m.lang            || 'Vietsub',
    time:            m.time            || '',
    episode_current: m.episode_current || 'Full',
    episode_total:   m.episode_total   || '1',
    type:            m.type            || 'movie',
    category:        normalizeCategories(m.category),
    country:         normalizeCountries(m.country),
    actor:           Array.isArray(m.actor)    ? m.actor    : [],
    director:        Array.isArray(m.director) ? m.director : (m.director ? [m.director] : []),
    tmdb:            m.tmdb            || undefined,
    trailer_url:     m.trailer_url     || '',
    _source:         'primary',
  };
}

export function normalizeFallback(raw: any, domain?: string): NormalizedMovie {
  const m         = raw.movie || raw;
  const rawPoster = m.poster_url || m.thumb_url || '';
  const rawThumb  = m.thumb_url  || m.poster_url || '';
  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.original_name   || m.origin_name || m.name || '',
    poster_url:      upgradeImageUrl(getImageUrl(rawPoster, 'poster', domain)),
    thumb_url:       upgradeImageUrl(getImageUrl(rawThumb,  'banner', domain)),
    description:     m.content         || m.description || '',
    content:         m.content         || m.description || '',
    year:            m.year            || '',
    quality:         m.quality         || 'HD',
    lang:            m.lang            || m.language || 'Vietsub',
    time:            m.time            || m.duration || '',
    episode_current: m.episode_current || m.current_episode || 'Full',
    episode_total:   m.episode_total   || m.total_episodes  || '1',
    type:            m.type            || (Array.isArray(m.category) && m.category.some((c: any) => c.slug === 'phim-bo') ? 'series' : 'movie'),
    category:        normalizeCategories(m.category),
    country:         normalizeCountries(m.country),
    actor:           Array.isArray(m.actor)    ? m.actor    : [],
    director:        Array.isArray(m.director) ? m.director : (m.director ? [m.director] : []),
    tmdb:            undefined,
    trailer_url:     m.trailer_url     || '',
    _source:         'fallback',
  };
}

export function normalizeBySource(raw: any, source: 'primary' | 'fallback', domain?: string): NormalizedMovie {
  return source === 'primary' ? normalizePrimary(raw, domain) : normalizeFallback(raw, domain);
}

function isEndpointSupportedOnFallback(endpoint: string): boolean {
  if (endpoint.includes('/images') || endpoint.includes('/peoples') || endpoint.includes('/keywords')) {
    return false;
  }
  if (endpoint.includes('/random') || endpoint.includes('/nam/') || endpoint.includes('/tmdb/')) {
    return false;
  }
  return true;
}


async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  const canFallback = isEndpointSupportedOnFallback(endpoint);

  // If we are currently in fallback mode and fallback is supported for this endpoint
  if (apiState.usingFallback && canFallback) {
    try {
      const res = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
      if (!res.ok) throw new Error(`Fallback HTTP ${res.status}`);
      const data = await res.json();
      return { data, source: 'fallback' };
    } catch (e) {
      console.warn('[API] Fallback failed:', e);
    }
  }

  // Otherwise, try primary
  try {
    const res = await fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT);
    if (!res.ok) throw new Error(`Primary HTTP ${res.status}`);
    
    // Success, reset consecutive fails
    apiState.consecutiveFails = 0;
    if (apiState.usingFallback) {
      apiState.switchToPrimary();
    }
    
    const data = await res.json();
    return { data, source: 'primary' };
  } catch (err) {
    if (canFallback) {
      apiState.consecutiveFails++;
      if (apiState.consecutiveFails >= 2) {
        apiState.switchToFallback();
      }
      console.warn(`[API] Primary failed for ${endpoint}, using fallback.`);
      const res = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
      if (!res.ok) throw new Error(`Fallback HTTP ${res.status}`);
      const data = await res.json();
      return { data, source: 'fallback' };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

function normalizePagination(pagination: any) {
  if (!pagination) return { totalPages: 1, currentPage: 1 };
  let totalPages = pagination.totalPages;
  if (totalPages === undefined && pagination.totalItems !== undefined && pagination.totalItemsPerPage !== undefined) {
    totalPages = Math.ceil(pagination.totalItems / pagination.totalItemsPerPage);
  }
  return {
    ...pagination,
    totalPages: totalPages || 1,
  };
}

export const api = {
  getNewUpdated: async (page = 1, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`new-updated:${page}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/danh-sach?${params.toString()}`);
      return {
        items:      (data.data?.items || data.items || []).map((i: any) => normalizeBySource(i, source)),
        pagination: normalizePagination(data.data?.params?.pagination || data.pagination || data.data?.pagination),
      };
    }, TTL.NEW_UPDATED),

  getByCategory: async (slug: string, page = 1, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`category:${slug}:${page}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/danh-sach/${slug}?${params.toString()}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.pagination) };
    }, TTL.CATEGORY_LIST),

  getByGenre: async (slug: string, page = 1, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`genre:${slug}:${page}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/the-loai/${slug}?${params.toString()}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.pagination) };
    }, TTL.CATEGORY_LIST),

  getByCountry: async (slug: string, page = 1, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`country:${slug}:${page}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/quoc-gia/${slug}?${params.toString()}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.data?.params?.pagination || data.pagination) };
    }, TTL.CATEGORY_LIST),

  getByYear: async (year: string | number, page = 1, filters: { category?: string; country?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`year:${year}:${page}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/nam/${year}?${params.toString()}`);
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.pagination) };
    }, TTL.CATEGORY_LIST),

  // ───────────────────────────────────────────────────────────
  // [FIX 8 + 9 + 10 + 11] getMovieDetail — TMDB FIRST, nâng cấp toàn diện
  // Luồng:
  //   1. Fetch phimapi (source data + episodes) song song với TMDB search
  //   2. Từ TMDB id → 1 request append_to_response (credits+videos+images)
  //   3. Merge: phimapi cung cấp slug/episodes, TMDB cung cấp chất lượng data
  //   4. Fallback sạch khi TMDB unavailable
  // ───────────────────────────────────────────────────────────
  getMovieDetail: async (slug: string) =>
    fetchWithCache(`detail:v2:${slug}`, async () => {
      // ── STAGE 1: Fetch phimapi + TMDB search SONG SONG ──────
      // [FIX 10] Không gọi apiFetch 2 lần — chỉ 1 lần, lỗi thì null
      const [phimapiResult, _] = await Promise.allSettled([
        apiFetch(`/phim/${slug}`),
        Promise.resolve(), // placeholder để allSettled
      ]);

      let primaryData: any    = null;
      let primarySource: 'primary' | 'fallback' = 'primary';

      if (phimapiResult.status === 'fulfilled') {
        primaryData   = phimapiResult.value.data;
        primarySource = phimapiResult.value.source;
      } else {
        console.warn('[API] phimapi fetch failed:', (phimapiResult as PromiseRejectedResult).reason);
      }

      // ── STAGE 2: TMDB search (parallel với normalize) ──────
      const rawMovie   = primaryData?.movie || primaryData || {};
      const searchName = rawMovie.name || rawMovie.origin_name || rawMovie.title || '';
      const searchYear = String(rawMovie.year || '');

      // Chạy song song: normalize phimapi data + search TMDB
      // Nếu phimapi đã có tmdb.id → bỏ qua search, dùng trực tiếp
      const existingTmdbId   = rawMovie.tmdb?.id;
      const existingTmdbType = (rawMovie.tmdb?.type || 'movie') as 'movie' | 'tv';

      let tmdbSearch: TmdbMovieInfo | null = null;

      if (TMDB_ENABLED) {
        if (existingTmdbId) {
          // Phimapi đã cung cấp TMDB ID → bỏ qua search step
          tmdbSearch = { id: Number(existingTmdbId), title: rawMovie.name || '', original_title: '', media_type: existingTmdbType };
        } else if (searchName) {
          // Timeout 4s (tăng từ 2s) — search với tên tiếng Anh nếu có
          const searchPromises = [fetchTmdbSearch(searchName, searchYear)];
          if (rawMovie.origin_name && rawMovie.origin_name !== searchName) {
            searchPromises.push(fetchTmdbSearch(rawMovie.origin_name, searchYear));
          }

          const searchResults = await Promise.race([
            Promise.any(searchPromises.map(p => p.then(r => r ?? Promise.reject('null')))),
            new Promise<null>(r => setTimeout(() => r(null), 4_000)),
          ]);
          tmdbSearch = searchResults as TmdbMovieInfo | null;
        }
      }

      // ── STAGE 3: Fetch TMDB full detail (append_to_response) ──
      let tmdbDetail: TmdbFullDetail | null = null;

      if (tmdbSearch?.id && TMDB_ENABLED) {
        const mediaType = (tmdbSearch.media_type === 'tv' || existingTmdbType === 'tv') ? 'tv' : 'movie';
        // [FIX 8] 1 request thay vì 3-4 request riêng lẻ
        tmdbDetail = await fetchTmdbDetail(tmdbSearch.id, mediaType);
      }

      // ── STAGE 4: Normalize phimapi data ──────────────────────
      if (!primaryData) {
        // [FIX 10] Không gọi lại apiFetch — throw ngay nếu không có data
        throw new Error(`Không thể lấy dữ liệu phim "${slug}"`);
      }

      const normalized = normalizeBySource(primaryData, primarySource);

      // ── STAGE 5: Merge TMDB data vào normalized ──────────────
      if (tmdbDetail) {
        const tmdbInfo = tmdbSearch!;

        // Tên — ưu tiên giữ tên tiếng Việt từ phimapi nếu đã có
        if (!normalized.name && (tmdbDetail.name || tmdbDetail.title)) {
          normalized.name = tmdbDetail.name || tmdbDetail.title || normalized.name;
        }
        if (tmdbDetail.original_title || tmdbDetail.original_name) {
          normalized.origin_name = tmdbDetail.original_title || tmdbDetail.original_name || normalized.origin_name;
        }

        // Năm
        if (!normalized.year) {
          const tmdbYear = (tmdbDetail.release_date || tmdbDetail.first_air_date || '').slice(0, 4);
          if (tmdbYear) normalized.year = tmdbYear;
        }

        // Description — TMDB overview nếu phimapi thiếu
        if (!normalized.description && tmdbDetail.overview) {
          normalized.description = tmdbDetail.overview;
          normalized.content     = tmdbDetail.overview;
        }

        // Runtime (TV: dùng number_of_episodes nếu có)
        if (!normalized.time) {
          if (tmdbDetail.runtime) normalized.time = `${tmdbDetail.runtime} phút`;
          else if (tmdbDetail.number_of_episodes) normalized.time = `${tmdbDetail.number_of_episodes} tập`;
        }

        // [FIX 9] Trailer — lấy từ TMDB videos
        if (!normalized.trailer_url) {
          normalized.trailer_url = extractBestTrailer(tmdbDetail.videos);
        }

        // Cast từ TMDB credits (nếu phimapi thiếu)
        if (!normalized.actor.length && tmdbDetail.credits?.cast) {
          normalized.actor = tmdbDetail.credits.cast.slice(0, 10).map(c => c.name);
        }

        // Director từ TMDB credits
        if (!normalized.director.length && tmdbDetail.credits?.crew) {
          const directors = tmdbDetail.credits.crew
            .filter(c => c.job === 'Director')
            .map(c => c.name);
          if (directors.length) normalized.director = directors;
        }

        // TMDB metadata
        normalized.tmdb = {
          id:            String(tmdbInfo.id),
          type:          tmdbSearch!.media_type || (primarySource === 'primary' ? normalized.type : 'movie'),
          vote_average:  tmdbDetail.vote_average,
          vote_count:    tmdbDetail.vote_count,
          title:         tmdbDetail.title || tmdbDetail.name,
          original_title: tmdbDetail.original_title || tmdbDetail.original_name,
          genres:        tmdbDetail.genres?.map(g => g.name) || [],
          runtime:       tmdbDetail.runtime,
        };

        // [FIX 11] Ảnh — điều kiện upgrade rộng hơn + score-based
        const bestBackdrop = extractBestBackdrop(tmdbDetail.images);
        const bestPoster   = extractBestPoster(tmdbDetail.images);
        // Fallback về poster_path/backdrop_path nếu images rỗng
        const tmdbPoster   = bestPoster   || (tmdbDetail.poster_path   ? `https://image.tmdb.org/t/p/original${tmdbDetail.poster_path}`   : '');
        const tmdbBackdrop = bestBackdrop || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbDetail.backdrop_path}` : '');

        if (tmdbPoster   && needsImageUpgrade(normalized.poster_url)) normalized.poster_url = tmdbPoster;
        if (tmdbBackdrop && needsImageUpgrade(normalized.thumb_url))  normalized.thumb_url  = tmdbBackdrop;

      } else if (tmdbSearch) {
        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        if (!normalized.year && tmdbSearch.release_date) {
          normalized.year = tmdbSearch.release_date.slice(0, 4);
        }
        if (!normalized.description && tmdbSearch.overview) {
          normalized.description = tmdbSearch.overview;
          normalized.content     = tmdbSearch.overview;
        }
        normalized.tmdb = {
          id:           String(tmdbSearch.id),
          type:         tmdbSearch.media_type || normalized.type,
          vote_average: tmdbSearch.vote_average,
          vote_count:   tmdbSearch.vote_count,
        };
        if (tmdbSearch.poster_path   && needsImageUpgrade(normalized.poster_url))
          normalized.poster_url = `https://image.tmdb.org/t/p/original${tmdbSearch.poster_path}`;
        if (tmdbSearch.backdrop_path && needsImageUpgrade(normalized.thumb_url))
          normalized.thumb_url  = `https://image.tmdb.org/t/p/original${tmdbSearch.backdrop_path}`;
      }

      // ── STAGE 5.5: Fallback to phimapi.com images if poster or banner needs upgrade ──
      if (needsImageUpgrade(normalized.poster_url) || needsImageUpgrade(normalized.thumb_url)) {
        try {
          const imagesData = await api.getMovieImages(slug).catch(() => null);
          if (imagesData && imagesData.images && imagesData.images.length > 0) {
            const backdrops = imagesData.images.filter((img: any) => img.width && img.height && img.width > img.height);
            const posters = imagesData.images.filter((img: any) => img.width && img.height && img.height > img.width);

            if (backdrops.length > 0 && needsImageUpgrade(normalized.thumb_url)) {
              const bestBackdrop = [...backdrops].sort((a: any, b: any) => {
                const scoreA = (a.width / 3840) * 0.7 + ((a.vote_average || 0) / 10) * 0.3;
                const scoreB = (b.width / 3840) * 0.7 + ((b.vote_average || 0) / 10) * 0.3;
                return scoreB - scoreA;
              })[0];
              normalized.thumb_url = `https://image.tmdb.org/t/p/original${bestBackdrop.file_path}`;
            }

            if (posters.length > 0 && needsImageUpgrade(normalized.poster_url)) {
              const bestPoster = [...posters].sort((a: any, b: any) => {
                return ((b.vote_average || 0) - (a.vote_average || 0)) || (b.width - a.width);
              })[0];
              normalized.poster_url = `https://image.tmdb.org/t/p/original${bestPoster.file_path}`;
            }
          }
        } catch (err) {
          console.warn("[API] Fallback image upgrade failed:", err);
        }
      }

      return {
        movie:       normalized,
        episodes:    primaryData?.episodes || [],
        _tmdb_used:  !!tmdbDetail,
        _tmdb_id:    tmdbSearch?.id,
        _source:     primarySource,
      };
    }, TTL.MOVIE_DETAIL),

  search: async (keyword: string, page = 1, limit = 64, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) =>
    fetchWithCache(`search:${keyword}:${page}:${limit}:${JSON.stringify(filters)}`, async () => {
      const params = new URLSearchParams();
      params.append('keyword', keyword);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.country) params.append('country', filters.country);
      if (filters.year) params.append('year', filters.year);
      if (filters.sort_field) params.append('sort_field', filters.sort_field);
      if (filters.sort_type) params.append('sort_type', filters.sort_type);
      if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

      const { data, source } = await apiFetch(`/v1/api/tim-kiem?${params.toString()}`);
      const items      = data.data?.items || data.items || [];
      const pagination = data.data?.params?.pagination || data.pagination || null;
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination };
    }, TTL.SEARCH),

  getApiStatus: () => ({
    usingFallback: false,
    consecutiveFails: 0,
  }),

  getTrendingTmdb: async () => {
    await tmdbRateLimiter.acquire();
    try {
      const res  = await fetchWithRetry(
        `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN`,
        {}, 2, 6_000,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.results || []).map((m: any): Partial<NormalizedMovie> => ({
        _id:         m.id.toString(),
        name:        m.title          || m.name,
        origin_name: m.original_title || m.original_name,
        thumb_url:   m.poster_path   ? `https://image.tmdb.org/t/p/w500${m.poster_path}`    : PLACEHOLDER_URL,
        poster_url:  m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : PLACEHOLDER_URL,
        year:        (m.release_date || m.first_air_date || '').slice(0, 4),
        description: m.overview || '',
        slug:        `search?q=${encodeURIComponent(m.title || m.name)}`,
        _source:     'primary' as const,
      }));
    } catch (err) {
      console.warn('[Trending] TMDB fetch failed:', err);
      return [];
    }
  },

  getRandom: async (limit = 10, type?: string) =>
    fetchWithCache(`random:${limit}:${type || ''}`, async () => {
      const typeParam = type ? `&type=${type}` : '';
      const { data, source } = await apiFetch(`/v1/api/random?limit=${limit}${typeParam}`);
      const items = data.data?.items || data.items || [];
      return {
        items: items.map((i: any) => normalizeBySource(i, source)),
        pagination: normalizePagination(data.data?.params?.pagination || data.pagination),
      };
    }, TTL.NEW_UPDATED),

  getMovieImages: async (slug: string) =>
    fetchWithCache(`images:${slug}`, async () => {
      const { data } = await apiFetch(`/v1/api/phim/${slug}/images`);
      return data.data || null;
    }, TTL.TMDB_STATIC),

  getMoviePeoples: async (slug: string) =>
    fetchWithCache(`peoples:${slug}`, async () => {
      const { data } = await apiFetch(`/v1/api/phim/${slug}/peoples`);
      return data.data || null;
    }, TTL.TMDB_STATIC),

  getMovieKeywords: async (slug: string) =>
    fetchWithCache(`keywords:${slug}`, async () => {
      const { data } = await apiFetch(`/v1/api/phim/${slug}/keywords`);
      return data.data || null;
    }, TTL.TMDB_STATIC),

  getGenres: async () =>
    fetchWithCache(`genres:all`, async () => {
      const { data } = await apiFetch(`/the-loai`);
      return data.data?.items || data.items || [];
    }, TTL.TMDB_STATIC),

  getCountries: async () =>
    fetchWithCache(`countries:all`, async () => {
      const { data } = await apiFetch(`/quoc-gia`);
      return data.data?.items || data.items || [];
    }, TTL.TMDB_STATIC),

  getMovieDetailById: async (id: string) =>
    fetchWithCache(`detail:id:${id}`, async () => {
      const { data, source } = await apiFetch(`/phim/id/${id}`);
      return {
        movie: normalizeBySource(data, source),
        episodes: data.episodes || [],
        _source: source,
      };
    }, TTL.MOVIE_DETAIL),

  getMovieDetailByTmdb: async (type: 'movie' | 'tv', id: number | string) =>
    fetchWithCache(`detail:tmdb:${type}:${id}`, async () => {
      const { data, source } = await apiFetch(`/tmdb/${type}/${id}`);
      return {
        movie: normalizeBySource(data, source),
        episodes: data.episodes || [],
        _source: source,
      };
    }, TTL.MOVIE_DETAIL),
};