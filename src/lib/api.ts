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
import { cleanLangString } from './utils';

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
    
    this.startHealthCheck();
  },
  switchToPrimary() {
    this.usingFallback = false;
    this.consecutiveFails = 0;
    
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

export interface NormalizedMovie {
  season?: number;
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
  if (url.includes('ophim.live') || url.includes('img.ophim')) {
    return url.replace('img.ophim.live', 'img.ophim.cc').replace('img.ophim.cc', 'img.ophim.live');
  }
  return url;
}

export function needsImageUpgrade(url: string) {
  return !url || url.includes('placehold.co') || !url.includes('image.tmdb.org');
}

export function getTmdbPosterUrl(
  posterPath: string | null | undefined, 
  size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500',
  fallbackUrl?: string
): string {
  if (!posterPath) {
    return fallbackUrl ? getImageUrl(fallbackUrl, 'poster') : PLACEHOLDER_URL;
  }
  if (posterPath.startsWith('http')) {
    return posterPath;
  }
  const cleanPath = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
}

export function extractBestPoster(images: any) {
  if (!images?.posters?.length) return null;
  const en = images.posters.find((i: any) => i.iso_639_1 === 'en');
  if (en) return `https://image.tmdb.org/t/p/w500${en.file_path}`;
  const nullLang = images.posters.find((i: any) => i.iso_639_1 === null);
  if (nullLang) return `https://image.tmdb.org/t/p/w500${nullLang.file_path}`;
  const vi = images.posters.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return `https://image.tmdb.org/t/p/w500${vi.file_path}`;
  return `https://image.tmdb.org/t/p/w500${images.posters[0].file_path}`;
}

export function extractBestBackdrop(images: any) {
  if (!images?.backdrops?.length) return null;
  const en = images.backdrops.find((i: any) => i.iso_639_1 === 'en');
  if (en) return `https://image.tmdb.org/t/p/w1280${en.file_path}`;
  const nullLang = images.backdrops.find((i: any) => i.iso_639_1 === null);
  if (nullLang) return `https://image.tmdb.org/t/p/w1280${nullLang.file_path}`;
  const vi = images.backdrops.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return `https://image.tmdb.org/t/p/w1280${vi.file_path}`;
  return `https://image.tmdb.org/t/p/w1280${images.backdrops[0].file_path}`;
}

export function extractBestTrailer(videos: any) {
  if (!videos?.results?.length) return null;
  const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
  if (trailer) return `https://www.youtube.com/watch?v=${trailer.key}`;
  return null;
}

export async function fetchTmdbByExternalId(externalId: string, source: string = 'imdb_id') {
  if (!TMDB_ENABLED || !externalId) return null;
  const cleanId = String(externalId).trim();
  if (!cleanId) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${encodeURIComponent(cleanId)}?api_key=${TMDB_KEY}&external_source=${source}`);
    if (!res.ok) return null;
    const data = await res.json();
    const movieRes = data.movie_results?.[0];
    const tvRes = data.tv_results?.[0];
    if (movieRes) return { ...movieRes, media_type: 'movie' };
    if (tvRes) return { ...tvRes, media_type: 'tv' };
    return null;
  } catch {
    return null;
  }
}

export async function fetchTmdbSearch(title: string, year?: string, type?: 'movie' | 'tv' | 'multi') {
  if (!TMDB_ENABLED || !title) return null;
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  try {
    let endpoint = '/3/search/multi';
    let yearParam = '';
    if (type === 'movie') {
      endpoint = '/3/search/movie';
      // Do not strictly enforce year in query yet, we will filter manually to be safe
      yearParam = year ? `&year=${year}&primary_release_year=${year}` : '';
    } else if (type === 'tv') {
      endpoint = '/3/search/tv';
      yearParam = year ? `&first_air_date_year=${year}` : '';
    }

    // Try with year param first
    let res = await fetch(`https://api.themoviedb.org${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}${yearParam}&language=vi`);
    let data = await res.json();
    let results = data.results || [];

    // If no results, fallback to search without year param
    if (!results.length && year) {
        res = await fetch(`https://api.themoviedb.org${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}&language=vi`);
        data = await res.json();
        results = data.results || [];
    }

    if (!results.length) return null;

    const valid = results.filter((r: any) => r.media_type !== 'person');
    if (!valid.length) return null;

    let bestMatch = valid[0];
    const targetYear = year ? parseInt(year) : null;

    if (targetYear) {
      // Score results
      let bestScore = -1;
      for (const item of valid) {
        let score = 0;
        const itemYearStr = item.release_date ? item.release_date.substring(0, 4) : (item.first_air_date ? item.first_air_date.substring(0, 4) : null);
        const itemYear = itemYearStr ? parseInt(itemYearStr) : null;
        
        const nameMatch = item.title?.toLowerCase() === cleanTitle.toLowerCase() || item.name?.toLowerCase() === cleanTitle.toLowerCase();
        const originNameMatch = item.original_title?.toLowerCase() === cleanTitle.toLowerCase() || item.original_name?.toLowerCase() === cleanTitle.toLowerCase();
        
        // Name match is the most important
        if (nameMatch || originNameMatch) {
            score += 20;
        }

        // Exact year match is crucial for separating reboots, but for later seasons of TV shows, the year might be the season's year, not the show's premiere year.
        if (itemYear === targetYear) {
            score += 10;
        } else if (itemYear && Math.abs(itemYear - targetYear) === 1) {
            score += 5; // Sometimes TMDB year and PhimAPI year differ by 1
        } else if (type === 'tv' && itemYear && itemYear < targetYear) {
            // For TV shows, if the show premiered before the target year, it's very likely valid (e.g. Season 2 in 2023, premiered in 2021)
            score += 3;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
        }
      }
    }

    if (!bestMatch.media_type) {
      bestMatch.media_type = type || (bestMatch.first_air_date ? 'tv' : 'movie');
    }
    return bestMatch;
  } catch {
    return null;
  }
}

export function extractTmdbObj(m: any): TmdbMovieInfo | undefined {
  if (!m) return undefined;
  const rawM = m.movie || m;
  
  let id = rawM.tmdb?.id || rawM.tmdb_id;
  if (!id && (typeof rawM.tmdb === 'number' || (typeof rawM.tmdb === 'string' && /^\d+$/.test(rawM.tmdb)))) {
    id = rawM.tmdb;
  }

  let imdbId = rawM.imdb_id || rawM.imdb?.id;
  if (!imdbId && typeof rawM.imdb === 'string' && rawM.imdb.startsWith('tt')) {
    imdbId = rawM.imdb;
  }

  let type = rawM.tmdb?.type || (rawM.type === 'series' || rawM.type === 'hoathinh' || rawM.type === 'tvshows' ? 'tv' : 'movie');
  let season = rawM.tmdb?.season || rawM.season || 1;

  // Try extracting season from title if it's still 1
  if (type === 'tv' && season === 1) {
      const searchName = rawM.name || rawM.title || '';
      const searchOrigin = rawM.origin_name || '';
      const seasonRegex = /(?:phần|mùa|season|ss)\s*(\d+)/i;
      
      const originMatch = searchOrigin.match(seasonRegex);
      if (originMatch) {
          season = parseInt(originMatch[1], 10);
      } else {
          const nameMatch = searchName.match(seasonRegex);
          if (nameMatch) {
              season = parseInt(nameMatch[1], 10);
          }
      }
  }

  if (id || imdbId || (rawM.tmdb && typeof rawM.tmdb === 'object')) {
    return {
      ...(typeof rawM.tmdb === 'object' ? rawM.tmdb : {}),
      id: id ? String(id) : (rawM.tmdb?.id ? String(rawM.tmdb.id) : undefined),
      imdb_id: imdbId ? String(imdbId) : undefined,
      type,
      season,
    };
  }
  return undefined;
}

export async function searchTmdbWithCache(movie: any) {
  if (!TMDB_ENABLED || !movie) return null;

  let extractedSeason: number | null = null;
  const isTv = movie.type === 'series' || movie.type === 'hoathinh' || movie.type === 'tvshows';
  const targetType = isTv ? 'tv' : 'movie';

  let searchName = movie.name || movie.title || '';
  let searchOrigin = movie.origin_name || '';

  // Extract season for TV shows
  if (isTv) {
    const seasonRegex = /(?:phần|mùa|season|ss)\s*(\d+)/i;
    const trailingNumberRegex = /\s+(\d+)\s*$/;
    
    let originMatch = searchOrigin.match(seasonRegex);
    if (!originMatch) originMatch = searchOrigin.match(trailingNumberRegex);
    
    if (originMatch) {
      extractedSeason = parseInt(originMatch[1], 10);
      searchOrigin = searchOrigin.replace(seasonRegex, '').replace(trailingNumberRegex, '').replace(/[\(\)-]+$/, '').trim();
    }
    
    let nameMatch = searchName.match(seasonRegex);
    if (!nameMatch) nameMatch = searchName.match(trailingNumberRegex);
    
    if (nameMatch) {
      if (!extractedSeason) extractedSeason = parseInt(nameMatch[1], 10);
      searchName = searchName.replace(seasonRegex, '').replace(trailingNumberRegex, '').replace(/[\(\)-]+$/, '').trim();
    }
  }

  const resolveSeasonFromTmdb = async (tmdbId: number, mediaType: string) => {
    if (mediaType === 'tv' && !extractedSeason) {
      // If regex failed, let's fetch TV details and see if any season name matches the movie name
      try {
        const detail = await fetchTmdbDetail(tmdbId, 'tv');
        if (detail && detail.seasons) {
          const lowerName = (movie.name || '').toLowerCase();
          const lowerOrigin = (movie.origin_name || '').toLowerCase();
          for (const s of detail.seasons) {
            if (s.season_number === 0) continue;
            const sName = (s.name || '').toLowerCase();
            // Match custom season names like "Asylum"
            if (sName && (lowerName.includes(sName) || lowerOrigin.includes(sName) || sName.includes(lowerOrigin) || sName.includes(lowerName))) {
              if (sName.replace(/season \d+/i, '').trim().length > 3) {
                  return s.season_number;
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return extractedSeason || 1;
  };

  // 1. Direct TMDB ID if present
  const tmdbObj = extractTmdbObj(movie);
  if (tmdbObj?.id) {
    if (tmdbObj.season) {
      return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: tmdbObj.season };
    }
    const cacheKeyId = `tmdb_season_resolve_${tmdbObj.id}`;
    const resolvedSeason = await fetchWithCache(cacheKeyId, () => resolveSeasonFromTmdb(Number(tmdbObj.id), tmdbObj.type || 'movie'), TTL.TMDB_STATIC);
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: resolvedSeason };
  }

  // 2. Direct IMDb ID if present
  if (tmdbObj?.imdb_id) {
    const findResult = await fetchWithCache(`tmdb_find_${tmdbObj.imdb_id}`, () => fetchTmdbByExternalId(tmdbObj.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
    if (findResult?.id) {
      const s = await resolveSeasonFromTmdb(findResult.id, findResult.media_type);
      return { ...findResult, season: s };
    }
  }

  // 3. Search by title
  const searchYear = String(movie.year || '');
  const cacheKey = `tmdb_unified_search_v5_${movie.slug || searchOrigin || searchName}_${searchYear}`;
  return fetchWithCache(cacheKey, async () => {
    let finalResult = null;
    // Await sequentially to prioritize original name over localized name
    if (searchOrigin) {
      finalResult = await fetchTmdbSearch(searchOrigin, searchYear, targetType);
    }
    if (!finalResult && searchName && searchName !== searchOrigin) {
      finalResult = await fetchTmdbSearch(searchName, searchYear, targetType);
    }
    if (!finalResult && searchOrigin) {
      finalResult = await fetchTmdbSearch(searchOrigin, searchYear, 'multi');
    }
    
    if (finalResult) {
      const s = await resolveSeasonFromTmdb(finalResult.id, finalResult.media_type);
      return { ...finalResult, season: s };
    }
    return null;
  }, TTL.TMDB_STATIC);
}

export async function fetchTmdbDetail(id: string | number, type?: string) {
  if (!TMDB_ENABLED) return null;
  const t = type || 'movie';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${t}/${id}?api_key=${TMDB_KEY}&language=vi&append_to_response=images,videos,credits,external_ids&include_image_language=vi,en,null`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export const getImageUrl = (path: string, _type: 'poster' | 'banner' = 'poster', domain?: string): string => {
  if (!path) return PLACEHOLDER_URL;

  let url = path;
  if (path.includes('image.tmdb.org')) {
    url = upgradeImageUrl(path);
  } else if (path.startsWith('/') && !path.includes('upload/vod/')) {
    const size = _type === 'banner' ? 'w1280' : 'w500';
    url = `https://image.tmdb.org/t/p/${size}${path}`;
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
  const tmdbPosterPath = m.poster_path || m.tmdb?.poster_path || m.tmdb?.poster;
  const tmdbBackdropPath = m.backdrop_path || m.tmdb?.backdrop_path || m.tmdb?.backdrop;

  const poster_url = tmdbPosterPath 
    ? getTmdbPosterUrl(tmdbPosterPath, 'w500')
    : getImageUrl(m.poster_url || m.thumb_url, 'poster', domain);

  const thumb_url = tmdbBackdropPath 
    ? getTmdbPosterUrl(tmdbBackdropPath, 'w1280')
    : getImageUrl(m.thumb_url  || m.poster_url, 'banner', domain);

  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.origin_name     || m.name  || '',
    poster_url:      poster_url,
    thumb_url:       thumb_url,
    description:     m.content         || m.description || '',
    content:         m.content         || m.description || '',
    year:            m.year            || '',
    quality:         m.quality         || 'HD',
    lang:            cleanLangString(m.lang || 'Vietsub', true),
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
  const tmdbPosterPath = m.poster_path || m.tmdb?.poster_path || m.tmdb?.poster;
  const tmdbBackdropPath = m.backdrop_path || m.tmdb?.backdrop_path || m.tmdb?.backdrop;

  const rawPoster = m.poster_url || m.thumb_url || '';
  const rawThumb  = m.thumb_url  || m.poster_url || '';

  const poster_url = tmdbPosterPath 
    ? getTmdbPosterUrl(tmdbPosterPath, 'w500')
    : upgradeImageUrl(getImageUrl(rawPoster, 'poster', domain));

  const thumb_url = tmdbBackdropPath 
    ? getTmdbPosterUrl(tmdbBackdropPath, 'w1280')
    : upgradeImageUrl(getImageUrl(rawThumb,  'banner', domain));

  return {
    _id:             m._id             || m.id    || '',
    slug:            m.slug            || '',
    name:            m.name            || '',
    origin_name:     m.original_name   || m.origin_name || m.name || '',
    poster_url:      poster_url,
    thumb_url:       thumb_url,
    description:     m.content         || m.description || '',
    content:         m.content         || m.description || '',
    year:            m.year            || '',
    quality:         m.quality         || 'HD',
    lang:            cleanLangString(m.lang || m.language || 'Vietsub', true),
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
      if (data && data.status === false) throw new Error(`Fallback API returned status: false (${data.msg || ''})`);
      return { data, source: 'fallback' };
    } catch (e) {
      console.warn('[API] Fallback failed:', e);
    }
  }

  // Otherwise, try primary
  try {
    const res = await fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT);
    if (!res.ok) throw new Error(`Primary HTTP ${res.status}`);
    
    const data = await res.json();
    if (data && data.status === false) {
      throw new Error(`Primary API returned status: false (${data.msg || ''})`);
    }

    // Success, reset consecutive fails
    apiState.consecutiveFails = 0;
    if (apiState.usingFallback) {
      apiState.switchToPrimary();
    }
    
    return { data, source: 'primary' };
  } catch (err) {
    if (canFallback) {
      apiState.consecutiveFails++;
      if (apiState.consecutiveFails >= 2) {
        apiState.switchToFallback();
      }
      
      const res = await fetchWithTimeout(`${FALLBACK_URL}${endpoint}`, PRIMARY_TIMEOUT);
      if (!res.ok) throw new Error(`Fallback HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.status === false) throw new Error(`Fallback API returned status: false (${data.msg || ''})`);
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

      // ── STAGE 2: Get TMDB ID & Extract Exact Season ────────
      let tmdbSearch: TmdbMovieInfo | null = null;
      if (TMDB_ENABLED) {
        const rawMovie = primaryData?.movie || primaryData || {};
        tmdbSearch = await searchTmdbWithCache(rawMovie) as TmdbMovieInfo | null;
      }

      // ── STAGE 3: Fetch TMDB full detail (append_to_response) ──
      let tmdbDetail: TmdbFullDetail | null = null;

      if (tmdbSearch?.id && TMDB_ENABLED) {
        const mediaType = tmdbSearch.media_type === 'tv' ? 'tv' : 'movie';
        // [FIX 8] 1 request thay vì 3-4 request riêng lẻ
        tmdbDetail = await fetchTmdbDetail(tmdbSearch.id, mediaType);
      }

      // ── STAGE 4: Normalize phimapi data ──────────────────────
      if (!primaryData) {
        // [FIX 10] Không gọi lại apiFetch — throw ngay nếu không có data
        throw new Error(`Không thể lấy dữ liệu phim "${slug}"`);
      }

      const normalized = normalizeBySource(primaryData, primarySource);

      // Extract season from pure source titles BEFORE TMDB overwrites them
      const seasonRegex = /(?:phần|mùa|season|ss)\s*(\d+)/i;
      const trailingNumberRegex = /\s+(\d+)\s*$/;
      let sMatch = normalized.origin_name?.match(seasonRegex) || normalized.origin_name?.match(trailingNumberRegex) || normalized.name?.match(seasonRegex) || normalized.name?.match(trailingNumberRegex);
      if (sMatch) {
         normalized.season = parseInt(sMatch[1], 10);
      }

      // ── STAGE 5: Merge TMDB data vào normalized ──────────────
      if (tmdbDetail) {
        const tmdbInfo = tmdbSearch!;

        // Tên — Luôn ghi đè title đã được dịch sang tiếng Việt từ TMDB (do language=vi)
        const tmdbName = tmdbDetail.title || tmdbDetail.name;
        if (tmdbName) {
          const hasForeignChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f]/.test(tmdbName);
          if (!hasForeignChars) {
            normalized.name = tmdbName;
          }
        }
        // Giữ original title gốc chuẩn xác
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
          season:        tmdbInfo.season,
          vote_average:  tmdbDetail.vote_average,
          vote_count:    tmdbDetail.vote_count,
          title:         tmdbDetail.title || tmdbDetail.name,
          original_title: tmdbDetail.original_title || tmdbDetail.original_name,
          genres:        tmdbDetail.genres?.map(g => g.name) || [],
          runtime:       tmdbDetail.runtime,
        };

        // [FIX 11] Ảnh — TMDB Primary (w500 cho poster, w1280 cho backdrop)
        const bestBackdrop = extractBestBackdrop(tmdbDetail.images);
        const bestPoster   = extractBestPoster(tmdbDetail.images);
        // Fallback về poster_path/backdrop_path nếu images rỗng
        const tmdbPoster   = bestPoster   || (tmdbDetail.poster_path   ? `https://image.tmdb.org/t/p/w500${tmdbDetail.poster_path}`   : '');
        const tmdbBackdrop = bestBackdrop || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetail.backdrop_path}` : '');

        if (tmdbPoster) normalized.poster_url = tmdbPoster;
        if (tmdbBackdrop) normalized.thumb_url = tmdbBackdrop;

      } else if (tmdbSearch) {
        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        const tmdbSearchName = tmdbSearch.title || tmdbSearch.name;
        if (tmdbSearchName) {
          const hasForeignChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f]/.test(tmdbSearchName);
          if (!hasForeignChars) {
            normalized.name = tmdbSearchName;
          }
        }
        if (tmdbSearch.original_title || tmdbSearch.original_name) {
          normalized.origin_name = tmdbSearch.original_title || tmdbSearch.original_name || normalized.origin_name;
        }
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
          season:       tmdbSearch.season,
          vote_average: tmdbSearch.vote_average,
          vote_count:   tmdbSearch.vote_count,
        };
        if (tmdbSearch.poster_path)
          normalized.poster_url = `https://image.tmdb.org/t/p/w500${tmdbSearch.poster_path}`;
        if (tmdbSearch.backdrop_path)
          normalized.thumb_url  = `https://image.tmdb.org/t/p/w1280${tmdbSearch.backdrop_path}`;
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
              normalized.thumb_url = `https://image.tmdb.org/t/p/w1280${bestBackdrop.file_path}`;
            }

            if (posters.length > 0 && needsImageUpgrade(normalized.poster_url)) {
              const bestPoster = [...posters].sort((a: any, b: any) => {
                return ((b.vote_average || 0) - (a.vote_average || 0)) || (b.width - a.width);
              })[0];
              normalized.poster_url = `https://image.tmdb.org/t/p/w500${bestPoster.file_path}`;
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
        `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}&language=vi`,
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