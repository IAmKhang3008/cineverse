/**
 * api.ts — Hệ thống API kiên cường cho Cineverse
 * Bao gồm: Smart Retry + Jitter, Health Check, Parallel Fetch,
 * Image Hunter, Data Normalization Adapter
 *
 * CHANGELOG:
 * [FIX 1] normalizePrimary/normalizeFallback được gọi đúng theo source trong tất cả các hàm
 * [FIX 2] upgradeImageUrl xử lý được URL có query string (e.g. ?v=2)
 * [FIX 3] tmdbCache tích hợp vào fetchWithCache (persistent qua reload)
 * [FIX 4] TMDB Rate Limiter — tránh vượt giới hạn 40 req/10s
 */

import { fetchWithCache, TTL } from './cache';

// ============================================================
// CẤU HÌNH
// ============================================================
const PRIMARY_URL  = 'https://phimapi.com';
const FALLBACK_URL = 'https://ophim1.com';
const TMDB_KEY     = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

const MAX_RETRIES          = 1;
const PRIMARY_TIMEOUT      = 12000;
const PARALLEL_THRESHOLD   = 6000;
const HEALTH_CHECK_INTERVAL = 30_000;

// ============================================================
// [FIX 4] TMDB RATE LIMITER
// TMDB free tier: ~40 req/10s. Queue + sliding window để không bị 429.
// ============================================================
const TMDB_RATE_LIMIT  = 38;  // giữ dưới 40 để an toàn
const TMDB_WINDOW_MS   = 10_000;

const tmdbRateLimiter = {
  timestamps: [] as number[],
  queue: [] as Array<() => void>,
  processing: false,

  /** Đăng ký 1 request TMDB — trả về Promise resolve khi được phép gửi */
  async acquire(): Promise<void> {
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
      // Xóa các timestamp cũ hơn 10 giây
      this.timestamps = this.timestamps.filter(t => now - t < TMDB_WINDOW_MS);

      if (this.timestamps.length < TMDB_RATE_LIMIT) {
        this.timestamps.push(now);
        const next = this.queue.shift();
        next?.();
        // Xử lý ngay request kế tiếp (không delay nếu còn slot)
        tick();
      } else {
        // Tính thời gian chờ đến khi slot cũ nhất expire
        const oldest   = this.timestamps[0];
        const waitTime = TMDB_WINDOW_MS - (now - oldest) + 50; // +50ms buffer
        setTimeout(tick, waitTime);
      }
    };
    tick();
  },
};

// ============================================================
// FETCH HELPERS
// ============================================================
function fetchWithTimeout(url: string, timeoutMs: number, options: RequestInit = {}) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
      const base   = 200 * Math.pow(2, attempt);
      const jitter = base * (0.5 + Math.random() * 0.5);
      await sleep(jitter);
    }
  }
  throw lastError;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeoutMs = 8000,
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, options);
      if (!res.ok && (res.status >= 500 || res.status === 429)) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt === retries) break;
      const base   = 250 * Math.pow(2, attempt);
      const jitter = base * (0.5 + Math.random() * 0.5);
      const tag    = url.includes('themoviedb.org') ? '[TMDB Optional]' : '[API Retry]';
      console.warn(`${tag} Attempt ${attempt + 1}/${retries + 1} failed for "${url}". Retrying in ${Math.round(jitter)}ms...`, err?.message || err);
      await sleep(jitter);
    }
  }
  const tag = url.includes('themoviedb.org') ? '[TMDB Optional]' : '[API Retry]';
  console.error(`${tag} All ${retries + 1} attempts failed for "${url}".`, lastError?.message || lastError);
  throw lastError;
}

// ============================================================
// TRẠNG THÁI API
// ============================================================
const apiState = {
  usingFallback:    false,
  primaryDeadSince: 0,
  healthCheckTimer: null as ReturnType<typeof setInterval> | null,
  consecutiveFails: 0,

  switchToFallback() {
    if (this.usingFallback) return;
    this.usingFallback    = true;
    this.primaryDeadSince = Date.now();
    console.warn('[API] Primary phimapi.com không phản hồi → chuyển sang ophim1.com');
    this.startHealthCheck();
  },

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
        const res = await fetchWithTimeout(`${PRIMARY_URL}/danh-sach/phim-moi-cap-nhat?page=1`, 3000);
        if (res.ok) this.switchToPrimary();
      } catch { /* Primary vẫn chết */ }
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
// PARALLEL FETCH
// ============================================================
async function parallelFetch(endpoint: string): Promise<{ res: Response; source: 'primary' | 'fallback' }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackResult: { res: Response; source: 'fallback' } | null = null;

    const settle = (value: { res: Response; source: 'primary' | 'fallback' }) => {
      if (!settled) { settled = true; resolve(value); }
    };

    const primaryPromise = retryWithJitter(() =>
      fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT).then(r => {
        if (!r.ok && r.status >= 500) throw new Error(`HTTP ${r.status}`);
        return r;
      })
    );

    const fallbackTimer = setTimeout(async () => {
      try {
        const fRes = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
        if (!fRes.ok) return;
        fallbackResult = { res: fRes, source: 'fallback' };
        primaryPromise.catch(() => {});
        if (!settled) {
          console.info(`[API] Dùng fallback tạm thời cho ${endpoint} (Primary chậm hơn ${PARALLEL_THRESHOLD}ms)`);
          settle(fallbackResult);
        }
      } catch { /* fallback cũng chết */ }
    }, PARALLEL_THRESHOLD);

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
        if (apiState.consecutiveFails >= 2) apiState.switchToFallback();

        if (fallbackResult) {
          settle(fallbackResult);
        } else {
          fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT)
            .then(r => {
              if (r.ok) settle({ res: r, source: 'fallback' });
              else reject(err);
            })
            .catch(() => reject(err));
        }
      });
  });
}

// ============================================================
// [FIX 2] IMAGE HUNTER — xử lý URL có query string
// ============================================================

/**
 * Nâng cấp URL ảnh từ ophim1 lên chất lượng cao hơn.
 *
 * FIX: Tách query string ra trước khi apply regex, gắn lại sau.
 * Trước đây: "film-thumb.jpg?v=2" không match "-thumb(\.\w+)$" → bỏ sót.
 * Sau fix:   tách "?v=2" ra, xử lý "film-thumb.jpg", gắn lại "?v=2".
 */
function upgradeImageUrl(url: string): string {
  if (!url) return url;

  // Tách query string và fragment ra khỏi path để regex hoạt động đúng
  const qIdx  = url.indexOf('?');
  const hIdx  = url.indexOf('#');
  const cutAt = qIdx !== -1 ? qIdx : hIdx !== -1 ? hIdx : url.length;

  const base   = url.slice(0, cutAt);   // phần path thuần
  const suffix = url.slice(cutAt);      // "?v=2#anchor" hoặc ""

  const upgraded = base
    .replace(/-thumb(\.\w+)$/i,  '$1')   // xóa -thumb
    .replace(/_thumb(\.\w+)$/i,  '$1')   // xóa _thumb
    .replace(/-poster(\.\w+)$/i, '$1')   // xóa -poster
    .replace(/\/w\d+\//g, '/original/'); // TMDB: w500 → original

  return upgraded + suffix;
}

// ============================================================
// [FIX 3] TMDB CACHE — persistent qua reload dùng localStorage
// TTL 24 giờ để tránh stale data quá lâu
// ============================================================
const TMDB_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const TMDB_CACHE_PREFIX = 'cv_tmdb_';

interface TmdbCacheEntry {
  data:      TmdbMovieInfo | null;
  expiresAt: number;
}

const tmdbMemCache = new Map<string, TmdbMovieInfo | null>(); // L1: in-memory nhanh

function tmdbCacheGet(key: string): TmdbMovieInfo | null | undefined {
  // L1: memory trước
  if (tmdbMemCache.has(key)) return tmdbMemCache.get(key);

  // L2: localStorage
  try {
    const raw = localStorage.getItem(TMDB_CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry: TmdbCacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(TMDB_CACHE_PREFIX + key);
      return undefined;
    }
    // Warm L1 cache
    tmdbMemCache.set(key, entry.data);
    return entry.data;
  } catch {
    return undefined;
  }
}

function tmdbCacheSet(key: string, data: TmdbMovieInfo | null): void {
  tmdbMemCache.set(key, data);
  try {
    const entry: TmdbCacheEntry = { data, expiresAt: Date.now() + TMDB_CACHE_TTL_MS };
    localStorage.setItem(TMDB_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // localStorage đầy hoặc bị block (private mode) — chỉ dùng memory
    console.warn('[TMDB Cache] localStorage unavailable, using memory-only cache.', e);
  }
}

// ============================================================
// TMDB MOVIE LOOKUP
// ============================================================
interface TmdbMovieInfo {
  id:              number;
  title:           string;
  original_title:  string;
  name?:           string;
  original_name?:  string;
  release_date?:   string;
  first_air_date?: string;
  poster_path?:    string;
  backdrop_path?:  string;
  overview?:       string;
  vote_average?:   number;
}

async function fetchTmdbMovieInfo(
  movieName: string,
  year?: string | number,
): Promise<TmdbMovieInfo | null> {
  const cacheKey = `${movieName}:${year || ''}`;

  const cached = tmdbCacheGet(cacheKey);
  if (cached !== undefined) return cached; // null cũng là kết quả hợp lệ (không tìm thấy)

  // [FIX 4] Xin phép rate limiter trước khi gửi request
  await tmdbRateLimiter.acquire();

  try {
    const yearQuery = year ? `&year=${year}` : '';
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(movieName)}${yearQuery}&language=vi-VN`;
    const res  = await fetchWithTimeout(searchUrl, 5000);
    const data = await res.json();
    const hit  = data.results?.[0];

    if (!hit) {
      tmdbCacheSet(cacheKey, null);
      return null;
    }

    const info: TmdbMovieInfo = {
      id:             hit.id,
      title:          hit.title         || hit.name          || '',
      original_title: hit.original_title || hit.original_name || '',
      name:           hit.name          || hit.title         || '',
      original_name:  hit.original_name  || hit.original_title || '',
      release_date:   hit.release_date   || hit.first_air_date || '',
      first_air_date: hit.first_air_date || hit.release_date   || '',
      poster_path:    hit.poster_path,
      backdrop_path:  hit.backdrop_path,
      overview:       hit.overview,
      vote_average:   hit.vote_average,
    };

    tmdbCacheSet(cacheKey, info);
    return info;
  } catch {
    tmdbCacheSet(cacheKey, null);
    return null;
  }
}

// ============================================================
// IMAGE URL HELPERS
// ============================================================
export const PLACEHOLDER_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#121212"/>
  <rect x="0" y="0" width="300" height="4" fill="#E50914"/>
  <text x="150" y="200" font-family="sans-serif" font-size="48" fill="#E50914" text-anchor="middle">🎬</text>
  <text x="150" y="250" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">CINEVERSE</text>
  <text x="150" y="278" font-family="sans-serif" font-size="12" fill="#666666" text-anchor="middle">Đang cập nhật...</text>
</svg>
`)}`;

export const getImageUrl = (
  path: string,
  type: 'poster' | 'banner' = 'poster',
): string => {
  if (!path) return PLACEHOLDER_URL;
  if (path.includes('image.tmdb.org'))            return upgradeImageUrl(path);
  if (path.includes('phimapi.com/image.php'))     return path;
  if (path.includes('ophim.live') || path.includes('img.ophim')) {
    return upgradeImageUrl(path);
  }
  if (path.includes('upload/vod/') || !path.startsWith('http')) {
    const fullUrl = path.startsWith('http')
      ? path
      : path.startsWith('/')
        ? `https://phimimg.com${path}`
        : `https://phimimg.com/${path}`;
    return `https://phimapi.com/image.php?url=${fullUrl}`;
  }
  if (path.includes('phimimg.com')) {
    return `https://phimapi.com/image.php?url=${path}`;
  }
  return path;
};

// ============================================================
// DATA NORMALIZATION
// ============================================================
export interface NormalizedMovie {
  _id:             string;
  slug:            string;
  name:            string;
  origin_name:     string;
  poster_url:      string;
  thumb_url:       string;
  description:     string;
  content:         string;
  year:            string | number;
  quality:         string;
  lang:            string;
  time:            string;
  episode_current: string;
  episode_total:   string;
  type:            string;
  category:        { id: string; name: string; slug: string }[];
  country:         { id: string; name: string; slug: string }[];
  actor:           string[];
  director:        string[];
  tmdb?:           { id?: string; type?: string; vote_average?: number; title?: string; original_title?: string };
  trailer_url:     string;
  _source:         'primary' | 'fallback';
}

function normalizePrimary(raw: any): NormalizedMovie {
  const movie = raw.movie || raw;
  return {
    _id:             movie._id           || movie.id || '',
    slug:            movie.slug          || '',
    name:            movie.name          || '',
    origin_name:     movie.origin_name   || movie.name || '',
    poster_url:      getImageUrl(movie.poster_url || movie.thumb_url, 'poster'),
    thumb_url:       getImageUrl(movie.thumb_url  || movie.poster_url, 'banner'),
    description:     movie.content       || movie.description || '',
    content:         movie.content       || movie.description || '',
    year:            movie.year          || '',
    quality:         movie.quality       || 'HD',
    lang:            movie.lang          || 'Vietsub',
    time:            movie.time          || '',
    episode_current: movie.episode_current || 'Full',
    episode_total:   movie.episode_total   || '1',
    type:            movie.type          || 'movie',
    category:        normalizeCategories(movie.category),
    country:         normalizeCountries(movie.country),
    actor:           Array.isArray(movie.actor)    ? movie.actor    : [],
    director:        Array.isArray(movie.director) ? movie.director : (movie.director ? [movie.director] : []),
    tmdb:            movie.tmdb          || undefined,
    trailer_url:     movie.trailer_url   || '',
    _source:         'primary',
  };
}

function normalizeFallback(raw: any): NormalizedMovie {
  const movie    = raw.movie || raw;
  const rawPoster = movie.poster_url || movie.thumb_url || '';
  const rawThumb  = movie.thumb_url  || movie.poster_url || '';

  return {
    _id:             movie._id           || movie.id || '',
    slug:            movie.slug          || '',
    name:            movie.name          || '',
    origin_name:     movie.original_name || movie.origin_name || movie.name || '',
    poster_url:      upgradeImageUrl(getImageUrl(rawPoster, 'poster')),
    thumb_url:       upgradeImageUrl(getImageUrl(rawThumb,  'banner')),
    description:     movie.content       || movie.description || '',
    content:         movie.content       || movie.description || '',
    year:            movie.year          || '',
    quality:         movie.quality       || 'HD',
    lang:            movie.lang          || movie.language || 'Vietsub',
    time:            movie.time          || movie.duration || '',
    episode_current: movie.episode_current || movie.current_episode || 'Full',
    episode_total:   movie.episode_total   || movie.total_episodes  || '1',
    type:            movie.type          || (movie.category?.includes('series') ? 'series' : 'movie'),
    category:        normalizeCategories(movie.category),
    country:         normalizeCountries(movie.country),
    actor:           Array.isArray(movie.actor)    ? movie.actor    : [],
    director:        Array.isArray(movie.director) ? movie.director : (movie.director ? [movie.director] : []),
    tmdb:            undefined,
    trailer_url:     movie.trailer_url   || '',
    _source:         'fallback',
  };
}

/**
 * [FIX 1] Helper — chọn đúng normalizer theo source
 * Dùng hàm này thay vì hard-code normalizePrimary ở mọi nơi
 */
function normalizeBySource(raw: any, source: 'primary' | 'fallback'): NormalizedMovie {
  return source === 'primary' ? normalizePrimary(raw) : normalizeFallback(raw);
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
// CORE FETCH
// ============================================================
async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  let attemptPromise: Promise<{ res: Response; source: 'primary' | 'fallback' }>;

  if (apiState.usingFallback) {
    attemptPromise = fetchWithRetry(`${FALLBACK_URL}${endpoint}`, {}, 2, PRIMARY_TIMEOUT)
      .then(res => ({ res, source: 'fallback' as const }))
      .catch(e => {
        console.warn('[API] Fallback failed even with retries, trying parallel fetch:', e);
        return parallelFetch(endpoint);
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
  // [FIX 1] Dùng normalizeBySource thay vì hard-code normalizePrimary
  getNewUpdated: async (page = 1) => {
    return fetchWithCache(`new-updated:${page}`, async () => {
      const { data, source } = await apiFetch(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
      return {
        items:      (data.items || data.data?.items || []).map((item: any) => normalizeBySource(item, source)),
        pagination: data.pagination || data.data?.pagination,
      };
    }, TTL.NEW_UPDATED);
  },

  getByCategory: async (slug: string, page = 1) => {
    return fetchWithCache(`category:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(`/v1/api/danh-sach/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return {
        items:      items.map((item: any) => normalizeBySource(item, source)),
        pagination: data.data?.pagination,
      };
    }, TTL.CATEGORY_LIST);
  },

  getMovieDetail: async (slug: string) => {
    return fetchWithCache(`detail:tmdb:${slug}`, async () => {
      // === GIAI ĐOẠN 1: Lấy dữ liệu chính ===
      let primaryData: any    = null;
      let primarySource: 'primary' | 'fallback' = 'primary';

      try {
        const result  = await apiFetch(`/phim/${slug}`);
        primaryData   = result.data;
        primarySource = result.source;
      } catch (err) {
        console.warn('[API] Không thể lấy dữ liệu từ phimapi, sẽ thử fallback:', err);
      }

      // === GIAI ĐOẠN 2: Lấy thông tin từ TMDB ===
      const rawMovie  = primaryData?.movie || primaryData || {};
      const searchName = rawMovie.name || rawMovie.origin_name || rawMovie.title || '';
      const searchYear = rawMovie.year || '';

      let tmdbInfo: TmdbMovieInfo | null = null;
      if (searchName) {
        tmdbInfo = await Promise.race([
          fetchTmdbMovieInfo(searchName, searchYear),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
        ]);
      }

      // === GIAI ĐOẠN 3: Normalize đúng theo source ===
      let normalized: NormalizedMovie;

      if (primaryData) {
        // [FIX 1] dùng normalizeBySource thay vì if/else thủ công
        normalized = normalizeBySource(primaryData, primarySource);

        if (tmdbInfo) {
          const vietnameseName = tmdbInfo.name  || tmdbInfo.title;
          const originalName   = tmdbInfo.original_title || tmdbInfo.original_name || tmdbInfo.title;
          if (vietnameseName) normalized.name        = vietnameseName;
          if (originalName)   normalized.origin_name = originalName;
          if (!normalized.year && tmdbInfo.release_date) {
            normalized.year = tmdbInfo.release_date.split('-')[0];
          }
          if (!normalized.description && tmdbInfo.overview) {
            normalized.description = tmdbInfo.overview;
            normalized.content     = tmdbInfo.overview;
          }
          normalized.tmdb = {
            id:             String(tmdbInfo.id),
            type:           tmdbInfo.name ? 'tv' : 'movie',
            vote_average:   tmdbInfo.vote_average,
            title:          tmdbInfo.title,
            original_title: tmdbInfo.original_title,
          };
        }
      } else {
        // Fallback nặng — thử lần 2
        try {
          const fallbackResult = await apiFetch(`/phim/${slug}`);
          normalized = normalizeBySource(fallbackResult.data, fallbackResult.source);
          if (tmdbInfo) {
            normalized.name        = tmdbInfo.name  || tmdbInfo.title || normalized.name;
            normalized.origin_name = tmdbInfo.original_title || tmdbInfo.original_name || normalized.origin_name;
          }
        } catch {
          throw new Error(`Không thể lấy dữ liệu phim "${slug}" từ cả hai nguồn`);
        }
      }

      // === GIAI ĐOẠN 4: Cải thiện ảnh từ TMDB ===
      if (tmdbInfo) {
        if (tmdbInfo.poster_path   && (normalized.poster_url.includes('ophim') || normalized.poster_url === PLACEHOLDER_URL)) {
          normalized.poster_url = `https://image.tmdb.org/t/p/original${tmdbInfo.poster_path}`;
        }
        if (tmdbInfo.backdrop_path && (normalized.thumb_url.includes('ophim')  || normalized.thumb_url  === PLACEHOLDER_URL)) {
          normalized.thumb_url  = `https://image.tmdb.org/t/p/original${tmdbInfo.backdrop_path}`;
        }
      }

      return {
        movie:      normalized,
        episodes:   primaryData?.episodes || [],
        _tmdb_used: !!tmdbInfo,
        _source:    primarySource,
      };
    }, TTL.MOVIE_DETAIL);
  },

  getByGenre: async (slug: string, page = 1) => {
    return fetchWithCache(`genre:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(`/v1/api/the-loai/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return {
        items:      items.map((item: any) => normalizeBySource(item, source)),
        pagination: data.data?.pagination,
      };
    }, TTL.CATEGORY_LIST);
  },

  getByCountry: async (slug: string, page = 1) => {
    return fetchWithCache(`country:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(`/v1/api/quoc-gia/${slug}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return {
        items:      items.map((item: any) => normalizeBySource(item, source)),
        pagination: data.data?.pagination,
      };
    }, TTL.CATEGORY_LIST);
  },

  getByYear: async (year: string, page = 1) => {
    return fetchWithCache(`year:${year}:${page}`, async () => {
      const { data, source } = await apiFetch(`/v1/api/nam/${year}?page=${page}`);
      const items = data.data?.items || data.items || [];
      return {
        items:      items.map((item: any) => normalizeBySource(item, source)),
        pagination: data.data?.pagination,
      };
    }, TTL.CATEGORY_LIST);
  },

  search: async (keyword: string, page = 1, limit = 64) => {
    return fetchWithCache(`search:${keyword}:${page}:${limit}`, async () => {
      const { data, source } = await apiFetch(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`);
      const items      = data.data?.items || data.items || [];
      const pagination = data.data?.params?.pagination || data.pagination || null;
      return {
        items:      items.map((item: any) => normalizeBySource(item, source)),
        pagination,
      };
    }, TTL.SEARCH);
  },

  getApiStatus: () => ({
    usingFallback:    apiState.usingFallback,
    primaryDeadSince: apiState.primaryDeadSince,
    consecutiveFails: apiState.consecutiveFails,
    currentSource:    apiState.usingFallback ? 'ophim1.com' : 'phimapi.com',
  }),

  getTrendingFromTMDB: async () => {
    // [FIX 4] Rate limiter cho trending call
    await tmdbRateLimiter.acquire();
    try {
      const res  = await fetchWithRetry(
        `https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_KEY}&language=vi-VN`,
        {},
        2,
        6000,
      );
      const data = await res.json();
      return data.results.map((m: any): Partial<NormalizedMovie> => ({
        _id:         m.id.toString(),
        name:        m.title        || m.name,
        origin_name: m.original_title || m.original_name,
        thumb_url:   m.poster_path   ? `https://image.tmdb.org/t/p/w500${m.poster_path}`    : PLACEHOLDER_URL,
        poster_url:  m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : PLACEHOLDER_URL,
        year:        m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0] || '',
        description: m.overview || '',
        slug:        `search?q=${encodeURIComponent(m.title || m.name)}`,
        _source:     'primary',
      }));
    } catch (err) {
      console.error('[Trending] TMDB getTrendingFromTMDB failed completely:', err);
      return [];
    }
  },
};