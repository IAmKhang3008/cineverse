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
const PRIMARY_TIMEOUT       = 12_000;
const PARALLEL_THRESHOLD    = 6_000;
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

// ─────────────────────────────────────────────────────────────
// API STATE — health check + failover
// ─────────────────────────────────────────────────────────────
const apiState = {
  usingFallback:    false,
  primaryDeadSince: 0,
  healthCheckTimer: null as ReturnType<typeof setInterval> | null,
  consecutiveFails: 0,

  switchToFallback() {
    if (this.usingFallback) return;
    this.usingFallback    = true;
    this.primaryDeadSince = Date.now();
    console.warn('[API] phimapi.com không phản hồi → ophim1.com');
    this.startHealthCheck();
  },
  switchToPrimary() {
    this.usingFallback    = false;
    this.consecutiveFails = 0;
    this.primaryDeadSince = 0;
    console.info('[API] phimapi.com sống lại ✅');
    this.stopHealthCheck();
  },
  startHealthCheck() {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(async () => {
      try {
        const r = await fetchWithTimeout(`${PRIMARY_URL}/danh-sach/phim-moi-cap-nhat?page=1`, 3_000);
        if (r.ok) this.switchToPrimary();
      } catch { /* vẫn chết */ }
    }, HEALTH_CHECK_INTERVAL);
  },
  stopHealthCheck() {
    if (this.healthCheckTimer) { clearInterval(this.healthCheckTimer); this.healthCheckTimer = null; }
  },
};

// ─────────────────────────────────────────────────────────────
// PARALLEL FETCH
// ─────────────────────────────────────────────────────────────
async function parallelFetch(endpoint: string, canFallback = true): Promise<{ res: Response; source: 'primary' | 'fallback' }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackResult: { res: Response; source: 'fallback' } | null = null;
    const settle = (v: { res: Response; source: 'primary' | 'fallback' }) => {
      if (!settled) { settled = true; resolve(v); }
    };

    const primaryPromise = retryWithJitter(() =>
      fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT).then(r => {
        if (!r.ok && r.status >= 500) throw new Error(`HTTP ${r.status}`);
        return r;
      })
    );

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (canFallback) {
      fallbackTimer = setTimeout(async () => {
        try {
          const fRes = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
          if (!fRes.ok) return;
          fallbackResult = { res: fRes, source: 'fallback' };
          primaryPromise.catch(() => {});
          if (!settled) {
            console.info(`[API] Fallback tạm cho ${endpoint} (primary > ${PARALLEL_THRESHOLD}ms)`);
            settle(fallbackResult);
          }
        } catch { /* fallback cũng chết */ }
      }, PARALLEL_THRESHOLD);
    }

    primaryPromise
      .then(res => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        apiState.consecutiveFails = 0;
        if (apiState.usingFallback) apiState.switchToPrimary();
        settle({ res, source: 'primary' });
      })
      .catch(err => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        apiState.consecutiveFails++;
        if (apiState.consecutiveFails >= 2) apiState.switchToFallback();
        if (fallbackResult) { settle(fallbackResult); return; }
        if (canFallback) {
          fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT)
            .then(r => { if (r.ok) settle({ res: r, source: 'fallback' }); else reject(err); })
            .catch(() => reject(err));
        } else {
          reject(err);
        }
      });
  });
}

// ─────────────────────────────────────────────────────────────
// [FIX 2] IMAGE UPGRADE — tách query string trước khi regex
// ─────────────────────────────────────────────────────────────
function upgradeImageUrl(url: string): string {
  if (!url) return url;
  const qIdx  = url.indexOf('?');
  const hIdx  = url.indexOf('#');
  const cutAt = qIdx !== -1 ? qIdx : hIdx !== -1 ? hIdx : url.length;
  const base   = url.slice(0, cutAt);
  const suffix = url.slice(cutAt);
  return base
    .replace(/-thumb(\.\w+)$/i,  '$1')
    .replace(/_thumb(\.\w+)$/i,  '$1')
    .replace(/-poster(\.\w+)$/i, '$1')
    .replace(/\/w\d+\//g, '/original/')
    + suffix;
}

// ─────────────────────────────────────────────────────────────
// [FIX 3] TMDB CACHE — 2-layer: memory L1 + localStorage L2
// ─────────────────────────────────────────────────────────────
const TMDB_CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24h
const TMDB_CACHE_PREFIX = 'cv_tmdb_';

interface TmdbCacheEntry<T> { data: T | null; expiresAt: number; }

// Generic 2-layer cache để dùng cho cả TmdbMovieInfo và TmdbFullDetail
class TmdbCache<T> {
  private mem = new Map<string, T | null>();
  private prefix: string;
  constructor(prefix: string) { this.prefix = TMDB_CACHE_PREFIX + prefix + '_'; }

  get(key: string): T | null | undefined {
    if (this.mem.has(key)) return this.mem.get(key);
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return undefined;
      const entry: TmdbCacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) { localStorage.removeItem(this.prefix + key); return undefined; }
      this.mem.set(key, entry.data);
      return entry.data;
    } catch { return undefined; }
  }

  set(key: string, data: T | null): void {
    this.mem.set(key, data);
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify({ data, expiresAt: Date.now() + TMDB_CACHE_TTL_MS }));
    } catch { /* localStorage full/blocked */ }
  }
}

// ─────────────────────────────────────────────────────────────
// TMDB TYPES
// ─────────────────────────────────────────────────────────────
interface TmdbMovieInfo {
  id:             number;
  title:          string;
  original_title: string;
  name?:          string;
  original_name?: string;
  media_type?:    'movie' | 'tv' | 'person';
  release_date?:  string;
  first_air_date?: string;
  poster_path?:   string;
  backdrop_path?: string;
  overview?:      string;
  vote_average?:  number;
  vote_count?:    number;
  popularity?:    number;
}

// [FIX 8] Full detail trả về từ append_to_response
interface TmdbFullDetail extends TmdbMovieInfo {
  genres?:    { id: number; name: string }[];
  runtime?:   number;
  status?:    string;
  tagline?:   string;
  // credits (appended)
  credits?: {
    cast: { id: number; name: string; character: string; profile_path?: string }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
  // videos (appended)
  videos?: {
    results: { id: string; key: string; site: string; type: string; official: boolean; published_at: string }[];
  };
  // images (appended)
  images?: {
    backdrops: { file_path: string; width: number; height: number; vote_average: number }[];
    posters:   { file_path: string; width: number; height: number; vote_average: number }[];
  };
  // number_of_episodes / seasons (TV)
  number_of_episodes?: number;
  number_of_seasons?:  number;
}

const tmdbSearchCache = new TmdbCache<TmdbMovieInfo>('search');
const tmdbDetailCache = new TmdbCache<TmdbFullDetail>('detail');

// ─────────────────────────────────────────────────────────────
// [FIX 6 + FIX 12] TMDB SEARCH — check res.ok, sanitize key,
// score-based matching (không chỉ lấy results[0] mù quáng)
// ─────────────────────────────────────────────────────────────

/** Tính điểm match giữa tên phim tìm kiếm và kết quả TMDB */
function scoreTmdbResult(result: TmdbMovieInfo, searchName: string, year?: string | number): number {
  // Bỏ qua 'person' ngay
  if (result.media_type === 'person') return -1;

  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const query   = normalize(searchName);
  const title   = normalize(result.title || result.name || '');
  const origTitle = normalize(result.original_title || result.original_name || '');

  let score = 0;

  // Exact match → điểm cao nhất
  if (title === query || origTitle === query) score += 100;
  // Partial match
  else if (title.includes(query) || query.includes(title)) score += 50;
  else if (origTitle.includes(query) || query.includes(origTitle)) score += 40;
  else score -= 20; // không match tên → trừ điểm

  // Year match
  if (year) {
    const resultYear = (result.release_date || result.first_air_date || '').slice(0, 4);
    if (resultYear === String(year)) score += 30;
    else if (Math.abs(Number(resultYear) - Number(year)) === 1) score += 10; // lệch 1 năm
  }

  // Popularity bonus (log để không quá dominant)
  score += Math.min(Math.log10((result.popularity || 0.1) + 1) * 10, 20);

  // Vote count bonus (nhiều vote = ít sai)
  score += Math.min((result.vote_count || 0) / 500, 5);

  return score;
}

async function fetchTmdbSearch(
  movieName: string,
  year?: string | number,
): Promise<TmdbMovieInfo | null> {
  if (!TMDB_ENABLED) return null;

  // [FIX 6] Sanitize cache key — loại bỏ ký tự đặc biệt
  const cacheKey = `${movieName.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/g, '_')}:${year || ''}`;
  const cached   = tmdbSearchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  await tmdbRateLimiter.acquire();

  try {
    const yearParam  = year ? `&year=${year}` : '';
    const url        = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(movieName)}${yearParam}&language=vi-VN&include_adult=false`;
    const res        = await fetchWithTimeout(url, 6_000);

    // [FIX 6] Check res.ok trước khi parse
    if (!res.ok) {
      if (res.status === 401) console.error('[TMDB] API key không hợp lệ hoặc đã bị thu hồi (401).');
      else if (res.status === 429) console.warn('[TMDB] Rate limit hit (429).');
      tmdbSearchCache.set(cacheKey, null);
      return null;
    }

    const data    = await res.json();
    const results = (data.results || []) as TmdbMovieInfo[];

    if (results.length === 0) { tmdbSearchCache.set(cacheKey, null); return null; }

    // [FIX 12] Score-based matching — không chỉ lấy results[0]
    const scored = results
      .map(r => ({ r, score: scoreTmdbResult(r, movieName, year) }))
      .filter(x => x.score > 0) // loại kết quả có điểm âm
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) { tmdbSearchCache.set(cacheKey, null); return null; }

    const best = scored[0].r;

    const info: TmdbMovieInfo = {
      id:             best.id,
      title:          best.title          || best.name          || '',
      original_title: best.original_title || best.original_name || '',
      name:           best.name           || best.title         || '',
      original_name:  best.original_name  || best.original_title || '',
      media_type:     best.media_type,
      release_date:   best.release_date   || best.first_air_date || '',
      first_air_date: best.first_air_date || best.release_date   || '',
      poster_path:    best.poster_path,
      backdrop_path:  best.backdrop_path,
      overview:       best.overview,
      vote_average:   best.vote_average,
      vote_count:     best.vote_count,
      popularity:     best.popularity,
    };

    tmdbSearchCache.set(cacheKey, info);
    return info;
  } catch (err) {
    console.warn('[TMDB] Search failed:', err);
    tmdbSearchCache.set(cacheKey, null);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// [FIX 8] TMDB FULL DETAIL — 1 request với append_to_response
// Thay vì 3-4 request riêng: /movie/{id} + /credits + /videos + /images
// → 1 request duy nhất: /movie/{id}?append_to_response=credits,videos,images
//
// Theo TMDB docs: với append_to_response, 6 sub-request = 100ms
// thay vì 464ms nếu gọi riêng lẻ
// ─────────────────────────────────────────────────────────────
async function fetchTmdbDetail(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<TmdbFullDetail | null> {
  if (!TMDB_ENABLED) return null;

  const cacheKey = `${mediaType}_${tmdbId}`;
  const cached   = tmdbDetailCache.get(cacheKey);
  if (cached !== undefined) return cached;

  await tmdbRateLimiter.acquire();

  try {
    // append_to_response: credits, videos, images — 1 request thay vì 4
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}` +
      `?api_key=${TMDB_KEY}&language=vi-VN` +
      `&append_to_response=credits,videos,images` +
      `&include_image_language=vi,null,en`; // ưu tiên ảnh tiếng Việt, fallback null (ngôn ngữ gốc), rồi en

    const res = await fetchWithTimeout(url, 8_000);

    if (!res.ok) {
      console.warn(`[TMDB] Detail fetch failed: HTTP ${res.status} for ${mediaType}/${tmdbId}`);
      tmdbDetailCache.set(cacheKey, null);
      return null;
    }

    const data: TmdbFullDetail = await res.json();
    tmdbDetailCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[TMDB] Detail fetch error:', err);
    tmdbDetailCache.set(cacheKey, null);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// [FIX 9] TRAILER EXTRACTION — ưu tiên: official teaser/trailer vi → en
// ─────────────────────────────────────────────────────────────
function extractBestTrailer(videos?: TmdbFullDetail['videos']): string {
  if (!videos?.results?.length) return '';
  const youtubeVideos = videos.results.filter(v => v.site === 'YouTube');
  if (youtubeVideos.length === 0) return '';

  // Ưu tiên: Official Trailer > Official Teaser > Trailer > Teaser > Clip
  const priority = ['Trailer', 'Teaser', 'Clip', 'Featurette'];
  for (const type of priority) {
    const official = youtubeVideos.find(v => v.type === type && v.official);
    if (official) return `https://www.youtube.com/watch?v=${official.key}`;
    const any = youtubeVideos.find(v => v.type === type);
    if (any) return `https://www.youtube.com/watch?v=${any.key}`;
  }

  // Fallback: bất kỳ YouTube video nào
  return `https://www.youtube.com/watch?v=${youtubeVideos[0].key}`;
}

// ─────────────────────────────────────────────────────────────
// [FIX 11] BEST BACKDROP — score ảnh theo width + vote_average
// ─────────────────────────────────────────────────────────────
function extractBestBackdrop(images?: TmdbFullDetail['images']): string {
  if (!images?.backdrops?.length) return '';
  const best = [...images.backdrops]
    .sort((a, b) => {
      // Score = width * 0.7 + vote_average * 0.3 (normalize về 0-1)
      const scoreA = (a.width / 3840) * 0.7 + (a.vote_average / 10) * 0.3;
      const scoreB = (b.width / 3840) * 0.7 + (b.vote_average / 10) * 0.3;
      return scoreB - scoreA;
    })[0];
  return `https://image.tmdb.org/t/p/original${best.file_path}`;
}

function extractBestPoster(images?: TmdbFullDetail['images']): string {
  if (!images?.posters?.length) return '';
  const best = [...images.posters]
    .sort((a, b) => (b.vote_average - a.vote_average) || (b.width - a.width))[0];
  return `https://image.tmdb.org/t/p/original${best.file_path}`;
}

// ─────────────────────────────────────────────────────────────
// IMAGE URL HELPERS
// ─────────────────────────────────────────────────────────────
export const PLACEHOLDER_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#121212"/>
  <rect x="0" y="0" width="300" height="4" fill="#E50914"/>
  <text x="150" y="200" font-family="sans-serif" font-size="48" fill="#E50914" text-anchor="middle">🎬</text>
  <text x="150" y="250" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">CINEVERSE</text>
  <text x="150" y="278" font-family="sans-serif" font-size="12" fill="#666666" text-anchor="middle">Đang cập nhật...</text>
</svg>
`)}`;

/** [FIX 11] Điều kiện cần upgrade ảnh — rộng hơn, không chỉ 'ophim' */
function needsImageUpgrade(url: string): boolean {
  if (!url || url === PLACEHOLDER_URL) return true;
  if (url.startsWith('data:')) return true;
  // Ảnh từ phimimg.com thường là thumbnail thấp chất lượng
  if (url.includes('phimimg.com') && !url.includes('original')) return true;
  // Ảnh ophim
  if (url.includes('ophim') || url.includes('img.ophim')) return true;
  // Ảnh TMDB kích thước thấp (w185, w300, w342, w500)
  if (url.includes('image.tmdb.org') && /\/w(185|300|342|500)\//.test(url)) return true;
  return false;
}

export const getImageUrl = (path: string, _type: 'poster' | 'banner' = 'poster'): string => {
  if (!path) return PLACEHOLDER_URL;

  let url = path;

  // 1. If it's a TMDB image, upgrade it first (to get high quality original)
  if (path.includes('image.tmdb.org')) {
    url = upgradeImageUrl(path);
  }
  // 2. Extract original if it's already a phimapi proxy
  else if (path.includes('phimapi.com/image.php')) {
    try {
      const urlObj = new URL(path);
      const actualUrl = urlObj.searchParams.get('url');
      if (actualUrl) {
        url = actualUrl;
      }
    } catch {}
  }
  // 3. If it's an ophim image, upgrade it first
  else if (path.includes('ophim.live') || path.includes('img.ophim')) {
    url = upgradeImageUrl(path);
  }
  // 4. If it's relative or has upload/vod, make it absolute under phimimg.com
  else if (path.includes('upload/vod/') || !path.startsWith('http')) {
    url = path.startsWith('http')
      ? path
      : path.startsWith('/') ? `https://phimimg.com${path}` : `https://phimimg.com/${path}`;
  }

  // 5. Now apply proxying based on host to bypass ISP blocks and hotlink protection
  if (url.includes('image.tmdb.org')) {
    // TMDB images are blocked in Vietnam, proxy them through images.weserv.nl (runs on Cloudflare network, 100% unblocked and fast)
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  }

  if (url.includes('phimimg.com') || url.includes('ophim.live') || url.includes('img.ophim')) {
    // phimimg has hotlinking protection, proxy through phimapi.com to bypass
    return `https://phimapi.com/image.php?url=${encodeURIComponent(url)}`;
  }

  return url;
};

// ─────────────────────────────────────────────────────────────
// DATA NORMALIZATION
// ─────────────────────────────────────────────────────────────

export interface FilterOptions {
  category?: string;
  country?: string;
  year?: string | number;
  sort_field?: string;
  sort_type?: string;
  sort_lang?: string;
  limit?: number;
}

const buildQuery = (base: string, params: Record<string, any>) => {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  
  if (!query) return base;
  return base.includes('?') ? `${base}&${query}` : `${base}?${query}`;
};

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
  tmdb?:           {
    id?:            string;
    type?:          string;
    vote_average?:  number;
    vote_count?:    number;
    title?:         string;
    original_title?: string;
    genres?:        string[];
    runtime?:       number;
  };
  trailer_url:     string;
  _source:         'primary' | 'fallback';
}

function normalizePrimary(raw: any): NormalizedMovie {
  const m = raw.movie || raw;
  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.origin_name     || m.name  || '',
    poster_url:      getImageUrl(m.poster_url || m.thumb_url, 'poster'),
    thumb_url:       getImageUrl(m.thumb_url  || m.poster_url, 'banner'),
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

function normalizeFallback(raw: any): NormalizedMovie {
  const m         = raw.movie || raw;
  const rawPoster = m.poster_url || m.thumb_url || '';
  const rawThumb  = m.thumb_url  || m.poster_url || '';
  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.original_name   || m.origin_name || m.name || '',
    poster_url:      upgradeImageUrl(getImageUrl(rawPoster, 'poster')),
    thumb_url:       upgradeImageUrl(getImageUrl(rawThumb,  'banner')),
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

// [FIX 1]
function normalizeBySource(raw: any, source: 'primary' | 'fallback'): NormalizedMovie {
  return source === 'primary' ? normalizePrimary(raw) : normalizeFallback(raw);
}

function normalizeCategories(raw: any): NormalizedMovie['category'] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : Object.values(raw)).map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

function normalizeCountries(raw: any): NormalizedMovie['country'] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : Object.values(raw)).map((c: any) => ({
    id:   c.id   || c._id  || c.slug || '',
    name: c.name || c.label || '',
    slug: c.slug || c.id   || '',
  }));
}

function isEndpointSupportedOnFallback(endpoint: string): boolean {
  if (endpoint.includes('/images') || endpoint.includes('/peoples') || endpoint.includes('/keywords')) {
    return false;
  }
  if (endpoint.includes('/random') || endpoint.includes('/nam/')) {
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// CORE FETCH
// ─────────────────────────────────────────────────────────────
async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  const canFallback = isEndpointSupportedOnFallback(endpoint);

  const attempt = (apiState.usingFallback && canFallback)
    ? fetchWithRetry(`${FALLBACK_URL}${endpoint}`, {}, 2, PRIMARY_TIMEOUT)
        .then(res => ({ res, source: 'fallback' as const }))
        .catch(e => { console.warn('[API] Fallback failed, trying parallel:', e); return parallelFetch(endpoint, canFallback); })
    : parallelFetch(endpoint, canFallback);

  const { res, source } = await attempt;
  const data = await res.json();
  return { data, source };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────
export const api = {
  getNewUpdated: async (page = 1) =>
    fetchWithCache(`new-updated:${page}`, async () => {
      const { data, source } = await apiFetch(`/danh-sach/phim-moi-cap-nhat-v3?page=${page}`);
      return {
        items:      (data.items || data.data?.items || []).map((i: any) => normalizeBySource(i, source)),
        pagination: data.pagination || data.data?.pagination,
      };
    }, TTL.NEW_UPDATED),

  getNewMovies: async (page = 1, filters?: FilterOptions) =>
    fetchWithCache(`new-movies:${page}:${JSON.stringify(filters || {})}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/danh-sach`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { 
        items: items.map((i: any) => normalizeBySource(i, source)), 
        pagination: data.data?.params?.pagination || data.pagination || null 
      };
    }, TTL.NEW_UPDATED),


  getByCategory: async (slug: string, page = 1, filters?: FilterOptions) =>
    fetchWithCache(`category:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/danh-sach/${slug}`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: data.data?.pagination };
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

  getByGenre: async (slug: string, page = 1, filters?: FilterOptions) =>
    fetchWithCache(`genre:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/the-loai/${slug}`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST),

  getByCountry: async (slug: string, page = 1, filters?: FilterOptions) =>
    fetchWithCache(`country:${slug}:${page}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/quoc-gia/${slug}`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST),

  getByYear: async (year: string, page = 1, filters?: FilterOptions) =>
    fetchWithCache(`year:${year}:${page}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/nam/${year}`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination: data.data?.pagination };
    }, TTL.CATEGORY_LIST),

  search: async (keyword: string, page = 1, limit = 64, filters?: FilterOptions) =>
    fetchWithCache(`search:${keyword}:${page}:${limit}`, async () => {
      const { data, source } = await apiFetch(buildQuery(`/v1/api/tim-kiem`, { keyword, page, limit, ...filters }));
      const items      = data.data?.items || data.items || [];
      const pagination = data.data?.params?.pagination || data.pagination || null;
      return { items: items.map((i: any) => normalizeBySource(i, source)), pagination };
    }, TTL.SEARCH),

  getApiStatus: () => ({
    usingFallback:    apiState.usingFallback,
    primaryDeadSince: apiState.primaryDeadSince,
    consecutiveFails: apiState.consecutiveFails,
    currentSource:    apiState.usingFallback ? 'ophim1.com' : 'phimapi.com',
    tmdbEnabled:      TMDB_ENABLED,
  }),

  // [FIX 7] Dùng /trending/movie (không trả 'person') thay vì /trending/all
  getTrendingFromTMDB: async () => {
    if (!TMDB_ENABLED) return [];
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
        pagination: data.data?.params?.pagination || data.pagination || null,
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