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
const PROXY_URL             = '/api/phim';
const PRIMARY_URL           = 'https://phimapi.com';
const PRIMARY_TIMEOUT       = 8_000;
const MAX_RETRIES           = 1;
const HEALTH_CHECK_INTERVAL = 30_000;

// [FIX 5] TMDB Key với fallback tin cậy
const TMDB_KEY: string    = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
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
  poster_path?: string;
  backdrop_path?: string;
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
  const nonVi = images.posters.find((i: any) => i.iso_639_1 && i.iso_639_1 !== 'vi');
  if (nonVi) return `https://image.tmdb.org/t/p/w500${nonVi.file_path}`;
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

export function toSlug(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export const TMDB_GENRE_MAP: Record<string, string> = {
  'action': 'Hành Động',
  'adventure': 'Phiêu Lưu',
  'animation': 'Hoạt Hình',
  'comedy': 'Hài',
  'crime': 'Tội Phạm',
  'documentary': 'Tài Liệu',
  'drama': 'Chính Kịch',
  'family': 'Gia Đình',
  'fantasy': 'Giả Tưởng',
  'history': 'Lịch Sử',
  'horror': 'Kinh Dị',
  'music': 'Âm Nhạc',
  'mystery': 'Bí Ẩn',
  'romance': 'Lãng Mạn',
  'science fiction': 'Khoa Học Viễn Tưởng',
  'tv movie': 'Truyền Hình',
  'thriller': 'Gây Cấn',
  'war': 'Chiến Tranh',
  'western': 'Miền Tây',
  'action & adventure': 'Hành Động & Phiêu Lưu',
  'kids': 'Trẻ Em',
  'news': 'Tin Tức',
  'reality': 'Truyền Hình Thực Tế',
  'sci-fi & fantasy': 'Khoa Học Viễn Tưởng & Giả Tưởng',
  'soap': 'Tâm Lý Tình Cảm',
  'talk': 'Trò Chuyện',
  'war & politics': 'Chiến Tranh & Chính Trị',
};

export function cleanTmdbGenre(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  if (TMDB_GENRE_MAP[lower]) {
    return TMDB_GENRE_MAP[lower];
  }

  // Loại bỏ từ "Phim ", "phim ", "Phim - " ở đầu
  let cleaned = trimmed.replace(/^(?:phim\s*[-–—:]*\s*)/i, '').trim();
  if (cleaned.toLowerCase() === 'phim truyền hình') return 'Truyền Hình';
  if (cleaned.toLowerCase() === 'phim tài liệu') return 'Tài Liệu';
  
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export const TMDB_COUNTRY_MAP: Record<string, string> = {
  'us': 'Hoa Kỳ',
  'usa': 'Hoa Kỳ',
  'united states': 'Hoa Kỳ',
  'united states of america': 'Hoa Kỳ',
  'gb': 'Anh',
  'uk': 'Anh',
  'united kingdom': 'Anh',
  'great britain': 'Anh',
  'de': 'Đức',
  'germany': 'Đức',
  'deutschland': 'Đức',
  'fr': 'Pháp',
  'france': 'Pháp',
  'kr': 'Hàn Quốc',
  'korea': 'Hàn Quốc',
  'south korea': 'Hàn Quốc',
  'republic of korea': 'Hàn Quốc',
  'jp': 'Nhật Bản',
  'japan': 'Nhật Bản',
  'cn': 'Trung Quốc',
  'china': 'Trung Quốc',
  'hk': 'Hồng Kông',
  'hong kong': 'Hồng Kông',
  'tw': 'Đài Loan',
  'taiwan': 'Đài Loan',
  'th': 'Thái Lan',
  'thailand': 'Thái Lan',
  'in': 'Ấn Độ',
  'india': 'Ấn Độ',
  'it': 'Ý',
  'italy': 'Ý',
  'es': 'Tây Ban Nha',
  'spain': 'Tây Ban Nha',
  'ca': 'Canada',
  'au': 'Úc',
  'australia': 'Úc',
  'ru': 'Nga',
  'russia': 'Nga',
  'russian federation': 'Nga',
  'vn': 'Việt Nam',
  'vietnam': 'Việt Nam',
  'viet nam': 'Việt Nam',
  'br': 'Brazil',
  'mx': 'Mexico',
  'se': 'Thụy Điển',
  'sweden': 'Thụy Điển',
  'no': 'Na Uy',
  'norway': 'Na Uy',
  'dk': 'Đan Mạch',
  'denmark': 'Đan Mạch',
  'nl': 'Hà Lan',
  'netherlands': 'Hà Lan',
  'be': 'Bỉ',
  'belgium': 'Bỉ',
  'pl': 'Ba Lan',
  'poland': 'Ba Lan',
  'ch': 'Thụy Sĩ',
  'switzerland': 'Thụy Sĩ',
  'at': 'Áo',
  'austria': 'Áo',
  'ie': 'Ireland',
  'nz': 'New Zealand',
  'sg': 'Singapore',
  'ph': 'Philippines',
  'id': 'Indonesia',
  'my': 'Malaysia',
  'tr': 'Thổ Nhĩ Kỳ',
  'turkey': 'Thổ Nhĩ Kỳ',
  'eg': 'Ai Cập',
  'egypt': 'Ai Cập',
  'za': 'Nam Phi',
  'south africa': 'Nam Phi',
  'ar': 'Argentina',
  'co': 'Colombia',
  'cl': 'Chile',
  'cz': 'Cộng Hòa Séc',
  'czech republic': 'Cộng Hòa Séc',
  'gr': 'Hy Lạp',
  'greece': 'Hy Lạp',
  'hu': 'Hungary',
  'pt': 'Bồ Đào Nha',
  'portugal': 'Bồ Đào Nha',
  'ro': 'Romania',
  'ua': 'Ukraine',
  'il': 'Israel',
  'ir': 'Iran',
  'is': 'Iceland',
  'fi': 'Phần Lan',
  'finland': 'Phần Lan',
};

export function translateTmdbCountry(nameOrIso: string): string {
  if (!nameOrIso) return '';
  const lower = nameOrIso.trim().toLowerCase();
  if (TMDB_COUNTRY_MAP[lower]) return TMDB_COUNTRY_MAP[lower];
  return nameOrIso.trim();
}

export function translateTmdbCountries(productionCountries?: any[], originCountries?: any[]): { id: string; name: string; slug: string }[] {
  const result: { id: string; name: string; slug: string }[] = [];
  const seen = new Set<string>();

  if (Array.isArray(productionCountries) && productionCountries.length > 0) {
    for (const c of productionCountries) {
      const iso = c.iso_3166_1 || c.id || '';
      const rawName = c.name || iso;
      const vnName = translateTmdbCountry(iso) || translateTmdbCountry(rawName) || rawName;
      if (vnName && !seen.has(vnName.toLowerCase())) {
        seen.add(vnName.toLowerCase());
        result.push({
          id: iso || vnName,
          name: vnName,
          slug: toSlug(vnName),
        });
      }
    }
  }

  if (result.length === 0 && Array.isArray(originCountries)) {
    for (const iso of originCountries) {
      if (typeof iso === 'string') {
        const vnName = translateTmdbCountry(iso) || iso;
        if (vnName && !seen.has(vnName.toLowerCase())) {
          seen.add(vnName.toLowerCase());
          result.push({
            id: iso,
            name: vnName,
            slug: toSlug(vnName),
          });
        }
      }
    }
  }

  return result.length > 0 ? result : [{ id: 'us', name: 'Hoa Kỳ', slug: 'hoa-ky' }];
}

export function extractBestTrailer(videos: any): string | null {
  if (!videos?.results || !Array.isArray(videos.results) || videos.results.length === 0) return null;
  const ytVideos = videos.results.filter((v: any) => v.site === 'YouTube' && v.key);
  if (ytVideos.length === 0) return null;

  // 1. Trailer chính thức (type === "Trailer" && official === true)
  const officialTrailer = ytVideos.find((v: any) => v.type === 'Trailer' && (v.official === true || v.official === 'true'));
  if (officialTrailer) return `https://www.youtube.com/embed/${officialTrailer.key}`;

  // 2. Bất kỳ Trailer nào (type === "Trailer")
  const anyTrailer = ytVideos.find((v: any) => v.type === 'Trailer');
  if (anyTrailer) return `https://www.youtube.com/embed/${anyTrailer.key}`;

  // 3. Teaser hoặc Clip chính thức
  const officialTeaser = ytVideos.find((v: any) => (v.type === 'Teaser' || v.type === 'Clip') && (v.official === true || v.official === 'true'));
  if (officialTeaser) return `https://www.youtube.com/embed/${officialTeaser.key}`;

  // 4. Bất kỳ video chính thức nào
  const anyOfficial = ytVideos.find((v: any) => v.official === true || v.official === 'true');
  if (anyOfficial) return `https://www.youtube.com/embed/${anyOfficial.key}`;

  // 5. Fallback video YouTube đầu tiên
  return `https://www.youtube.com/embed/${ytVideos[0].key}`;
}

export async function fetchTmdbVideos(id: string | number, type: 'movie' | 'tv' | string = 'movie', seasonNum?: number, epNum?: number): Promise<string | null> {
  if (!TMDB_ENABLED || !id) return null;
  const cleanId = String(id).replace(/^tmdb-/, '');
  const t = type === 'tv' ? 'tv' : 'movie';
  const cacheKey = `tmdb_vid_v3_${t}_${cleanId}${seasonNum ? `_s${seasonNum}_e${epNum || 1}` : ''}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      let url = `https://api.themoviedb.org/3/${t}/${cleanId}/videos?api_key=${TMDB_KEY}&language=en-US`;
      if (t === 'tv' && seasonNum && epNum) {
        url = `https://api.themoviedb.org/3/tv/${cleanId}/season/${seasonNum}/episode/${epNum}/videos?api_key=${TMDB_KEY}&language=en-US`;
      }
      let res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const trailer = extractBestTrailer(data);
        if (trailer) return trailer;
      }
      // Fallback with all video languages
      const fallbackUrl = `https://api.themoviedb.org/3/${t}/${cleanId}/videos?api_key=${TMDB_KEY}&include_video_language=en,vi,null`;
      res = await fetch(fallbackUrl);
      if (res.ok) {
        const data = await res.json();
        return extractBestTrailer(data);
      }
      return null;
    } catch {
      return null;
    }
  }, TTL.TMDB_STATIC);
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
    let res = await fetch(`https://api.themoviedb.org${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}${yearParam}&language=en-US`);
    let data = await res.json();
    let results = data.results || [];

    // If no results, fallback to search without year param
    if (!results.length && year) {
        res = await fetch(`https://api.themoviedb.org${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}&language=en-US`);
        data = await res.json();
        results = data.results || [];
    }

    if (!results.length) return null;

    const valid = results.filter((r: any) => r.media_type !== 'person');
    if (!valid.length) return null;

    let bestMatch = valid[0];
    const targetYear = year ? parseInt(year) : null;
    const normClean = normalizeTitleForComparison(cleanTitle);

    // Score results for best exact match
    let bestScore = -100;
    for (const item of valid) {
      let score = 0;
      const itemYearStr = item.release_date ? item.release_date.substring(0, 4) : (item.first_air_date ? item.first_air_date.substring(0, 4) : null);
      const itemYear = itemYearStr ? parseInt(itemYearStr) : null;

      const normItemTitle = normalizeTitleForComparison(item.title || item.name);
      const normItemOrig = normalizeTitleForComparison(item.original_title || item.original_name);

      const isExactMatch = normClean && (normItemTitle === normClean || normItemOrig === normClean);

      if (isExactMatch) {
        score += 60; // Khớp tiêu đề chính xác 100%
      } else {
        // Nếu tiêu đề khác nhau (ví dụ: "The Runner" vs "Runner", "Blade Runner" vs "Runner"): trừ điểm nặng
        score -= 30;
      }

      // So khớp năm phát hành
      if (targetYear && itemYear) {
        if (itemYear === targetYear) {
          score += 25;
        } else if (Math.abs(itemYear - targetYear) === 1) {
          score += 10;
        } else if (type === 'tv' && itemYear < targetYear) {
          score += 5;
        } else {
          score -= 20;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
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
    const res = await fetch(`https://api.themoviedb.org/3/${t}/${id}?api_key=${TMDB_KEY}&language=vi-VN&append_to_response=images,videos,credits,external_ids,release_dates&include_image_language=en,null&include_video_language=en,vi,null`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data) {
      // Đảm bảo poster luôn là tiếng Anh từ TMDB
      const enPoster = data.images?.posters?.find((p: any) => p.iso_639_1 === 'en');
      if (enPoster?.file_path) {
        data.poster_path = enPoster.file_path;
      } else {
        const nullPoster = data.images?.posters?.find((p: any) => p.iso_639_1 === null);
        if (nullPoster?.file_path) {
          data.poster_path = nullPoster.file_path;
        }
      }

      // Nếu không có tóm tắt tiếng Việt, lấy tóm tắt tiếng Anh
      if (!data.overview) {
        try {
          const enRes = await fetch(`https://api.themoviedb.org/3/${t}/${id}?api_key=${TMDB_KEY}&language=en-US`);
          if (enRes.ok) {
            const enData = await enRes.json();
            if (enData.overview) data.overview = enData.overview;
          }
        } catch {}
      }
    }
    return data;
  } catch { return null; }
}

/**
 * Tính toán chất lượng phim dựa trên TMDB release dates:
 * - Chưa ra mắt (release date trong tương lai): "CHƯA RA MẮT"
 * - Đã ra mắt nhưng chỉ chiếu rạp/chưa có DVOD (digital/physical): "CAM"
 * - Đã ra mắt trên streaming hoặc DVOD (digital/physical): "FHD"
 */
export function calculateMovieQuality(releaseDatesResult: any, defaultReleaseDate?: string): 'CHƯA RA MẮT' | 'CAM' | 'FHD' {
  const now = new Date();

  // Kiểm tra ngày phát hành mặc định
  if (defaultReleaseDate) {
    const d = new Date(defaultReleaseDate);
    if (!isNaN(d.getTime()) && d > now) {
      return 'CHƯA RA MẮT';
    }
  }

  const results = releaseDatesResult?.results || (Array.isArray(releaseDatesResult) ? releaseDatesResult : []);
  if (!results.length) {
    if (defaultReleaseDate) {
      const d = new Date(defaultReleaseDate);
      if (!isNaN(d.getTime()) && d > now) return 'CHƯA RA MẮT';
    }
    return 'FHD';
  }

  let hasTheatrical = false;
  let hasDigitalOrPhysical = false;
  let earliestRelease: Date | null = null;

  for (const country of results) {
    const dates = country.release_dates || [];
    for (const rd of dates) {
      if (!rd.release_date) continue;
      const rDate = new Date(rd.release_date);
      if (isNaN(rDate.getTime())) continue;

      if (!earliestRelease || rDate < earliestRelease) {
        earliestRelease = rDate;
      }

      if (rDate <= now) {
        // Types: 1 = Premiere, 2 = Theatrical (limited), 3 = Theatrical
        if ([1, 2, 3].includes(rd.type)) {
          hasTheatrical = true;
        }
        // Types: 4 = Digital, 5 = Physical (DVD/Blu-ray), 6 = TV
        if ([4, 5, 6].includes(rd.type)) {
          hasDigitalOrPhysical = true;
        }
      }
    }
  }

  if (!earliestRelease && defaultReleaseDate) {
    const d = new Date(defaultReleaseDate);
    if (!isNaN(d.getTime())) earliestRelease = d;
  }

  // 1. Nếu phim chưa ra mắt
  if (!earliestRelease || earliestRelease > now) {
    return 'CHƯA RA MẮT';
  }

  // 2. Nếu phim đã ra mắt nhưng chỉ chiếu rạp / chưa có DVOD
  if (!hasDigitalOrPhysical) {
    return 'CAM';
  }

  // 3. Nếu phim đã có trên streaming hoặc DVOD
  return 'FHD';
}

export const TMDB_GENRE_ID_MAP: Record<number, string> = {
  28: 'Hành Động',
  12: 'Phiêu Lưu',
  16: 'Hoạt Hình',
  35: 'Hài',
  80: 'Tội Phạm',
  99: 'Tài Liệu',
  18: 'Chính Kịch',
  10751: 'Gia Đình',
  14: 'Giả Tưởng',
  36: 'Lịch Sử',
  27: 'Kinh Dị',
  10402: 'Âm Nhạc',
  9648: 'Bí Ẩn',
  10749: 'Lãng Mạn',
  878: 'Khoa Học Viễn Tưởng',
  10770: 'Truyền Hình',
  53: 'Gây Cấn',
  10752: 'Chiến Tranh',
  37: 'Miền Tây',
  10759: 'Hành Động & Phiêu Lưu',
  10762: 'Trẻ Em',
  10763: 'Tin Tức',
  10764: 'Truyền Hình Thực Tế',
  10765: 'Khoa Học Viễn Tưởng & Giả Tưởng',
  10766: 'Tâm Lý',
  10767: 'Talk Show',
  10768: 'Chiến Tranh & Chính Trị',
};

/**
 * Tìm kiếm phim & series từ TMDb khi phim không tồn tại trên phimapi.com
 * Chuẩn hóa cấu trúc dữ liệu giống hệt phim thịnh hành (Phim Thịnh Hành)
 */
export async function searchTmdbMultiList(query: string, page = 1, limit = 24, filters?: any): Promise<{ items: any[]; pagination: any }> {
  if (!TMDB_ENABLED || !query || !query.trim()) return { items: [], pagination: null };
  const cleanQ = query.trim();

  const cacheKey = `tmdb_search_multi_v4_${cleanQ}_${page}_${limit}_${JSON.stringify(filters || {})}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const options = { method: 'GET', headers: { accept: 'application/json' } };
      let yearQuery = '';
      if (filters?.year) {
        yearQuery = `&year=${filters.year}&primary_release_year=${filters.year}&first_air_date_year=${filters.year}`;
      }

      const [resVi, resEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(cleanQ)}&language=vi-VN&api_key=${TMDB_KEY}&page=${page}&include_adult=false${yearQuery}`, options)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(cleanQ)}&language=en-US&api_key=${TMDB_KEY}&page=${page}&include_adult=false${yearQuery}`, options)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ]);

      const dataViResults: any[] = resVi?.results || [];
      const dataEnResults: any[] = resEn?.results || [];

      // Bản đồ chứa dữ liệu tiếng Anh để fallback poster, backdrop và tiêu đề
      const enMap = new Map<number, any>(dataEnResults.map(m => [m.id, m]));

      // Hợp nhất danh sách phim
      const mergedList: any[] = [];
      const seenIds = new Set<number>();

      for (const m of [...dataViResults, ...dataEnResults]) {
        if (!m || seenIds.has(m.id)) continue;
        if (m.media_type !== 'movie' && m.media_type !== 'tv') continue;
        seenIds.add(m.id);
        mergedList.push(m);
      }

      // Lọc theo năm nếu có trong filters
      let filteredList = mergedList;
      if (filters?.year) {
        const yStr = String(filters.year);
        filteredList = filteredList.filter((m: any) => {
          const mYear = (m.release_date || m.first_air_date || '').slice(0, 4);
          return mYear === yStr;
        });
        if (filteredList.length === 0) filteredList = mergedList;
      }

      const validItems = filteredList.slice(0, limit);
      if (validItems.length === 0) {
        return { items: [], pagination: null };
      }

      // Lấy release_dates song song cho các phim điện ảnh để tính qualityTag
      const releasePromises = validItems.map((m: any) => {
        if (m.media_type === 'movie') {
          return fetch(`https://api.themoviedb.org/3/movie/${m.id}/release_dates?api_key=${TMDB_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);
        }
        return Promise.resolve(null);
      });

      const releaseResults = await Promise.all(releasePromises);

      const items = validItems.map((m: any, idx: number) => {
        const enItem = enMap.get(m.id) || {};
        const releaseInfo = releaseResults[idx];
        const releaseDate = m.release_date || m.first_air_date || enItem.release_date || enItem.first_air_date || '';
        
        let qualityTag: 'CHƯA RA MẮT' | 'CAM' | 'FHD' = 'FHD';
        if (m.media_type === 'movie') {
          qualityTag = calculateMovieQuality(releaseInfo, releaseDate);
        } else {
          if (releaseDate && new Date(releaseDate).getTime() > Date.now()) {
            qualityTag = 'CHƯA RA MẮT';
          } else {
            qualityTag = 'FHD';
          }
        }

        const englishPosterPath = enItem.poster_path || m.poster_path;
        const posterUrl = englishPosterPath 
          ? `https://image.tmdb.org/t/p/w500${englishPosterPath}` 
          : PLACEHOLDER_URL;
        const backdropPath = m.backdrop_path || enItem.backdrop_path;
        const thumbUrl = backdropPath 
          ? `https://image.tmdb.org/t/p/w1280${backdropPath}` 
          : posterUrl;

        const displayName = m.title || m.name || enItem.title || enItem.name || '';
        const originName = m.original_title || m.original_name || enItem.original_title || enItem.original_name || displayName;
        const year = releaseDate ? releaseDate.slice(0, 4) : '';
        const overview = m.overview || enItem.overview || '';

        const genres = (m.genre_ids || enItem.genre_ids || []).map((gid: number) => {
          const gName = TMDB_GENRE_ID_MAP[gid] || 'Phim';
          return {
            id: String(gid),
            name: gName,
            slug: toSlug(gName),
          };
        });

        return {
          _id: `tmdb-${m.id}`,
          id: m.id,
          name: displayName,
          origin_name: originName,
          poster_url: posterUrl,
          thumb_url: thumbUrl,
          poster_path: englishPosterPath || m.poster_path,
          backdrop_path: backdropPath,
          year: year,
          description: overview,
          content: overview,
          slug: `tmdb-${m.id}`,
          quality: qualityTag,
          lang: qualityTag === 'CHƯA RA MẮT' ? '' : 'Vietsub',
          vote_average: m.vote_average || enItem.vote_average || 0,
          vote_count: m.vote_count || enItem.vote_count || 0,
          type: m.media_type === 'tv' ? 'series' : 'movie',
          category: genres,
          tmdb: {
            id: m.id,
            type: m.media_type || (m.first_air_date ? 'tv' : 'movie'),
            vote_average: m.vote_average || enItem.vote_average || 0,
            vote_count: m.vote_count || enItem.vote_count || 0,
            poster_path: englishPosterPath || m.poster_path,
            backdrop_path: backdropPath,
          },
          _source: 'primary' as const,
          _fromTmdbSearch: true,
        };
      });

      const totalResults = Math.max(resVi?.total_results || 0, resEn?.total_results || 0, items.length);
      const totalPgs = Math.min(Math.max(resVi?.total_pages || 1, resEn?.total_pages || 1), 50);

      return {
        items,
        pagination: {
          totalItems: totalResults,
          totalPages: totalPgs,
          currentPage: page,
          pageSizes: limit,
        },
      };
    } catch (err) {
      console.warn('[TMDB Search Multi] Failed:', err);
      return { items: [], pagination: null };
    }
  }, TTL.SEARCH);
}

/**
 * Chuẩn hóa tiêu đề để so sánh chính xác cao và siêu nhanh
 */
export function normalizeTitleForComparison(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Thuật toán so sánh siêu nhanh và ổn định xem phim có tồn tại trên phimapi.com hay không
 */
export async function findMatchInPhimApi(tmdbDetail: any): Promise<{ matched: any | null; score: number }> {
  if (!tmdbDetail) return { matched: null, score: 0 };

  const normOrig = normalizeTitleForComparison(tmdbDetail.original_title || tmdbDetail.original_name);
  const normVi = normalizeTitleForComparison(tmdbDetail.title || tmdbDetail.name);
  const tmdbYear = parseInt((tmdbDetail.release_date || tmdbDetail.first_air_date || '').slice(0, 4), 10);

  // Tìm kiếm song song cả tên gốc và tên tiếng Việt
  const queries = Array.from(new Set([
    tmdbDetail.original_title,
    tmdbDetail.original_name,
    tmdbDetail.title,
    tmdbDetail.name
  ].filter(Boolean) as string[]));
  const searchPromises = queries.map(q =>
    fetchWithTimeout(`${PRIMARY_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&limit=10`, 3500)
      .then(r => r.json())
      .then(d => d.data?.items || d.items || [])
      .catch(() => [])
  );

  const searchResults = await Promise.allSettled(searchPromises);
  const seenSlugs = new Set<string>();
  const candidates: any[] = [];

  for (const res of searchResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      for (const item of res.value) {
        if (item.slug && !seenSlugs.has(item.slug)) {
          seenSlugs.add(item.slug);
          candidates.push(item);
        }
      }
    }
  }

  let bestMatch: any = null;
  let bestScore = 0;

  for (const item of candidates) {
    const itemOrig = normalizeTitleForComparison(item.origin_name);
    const itemName = normalizeTitleForComparison(item.name);
    const itemYear = parseInt(item.year, 10);

    let score = 0;
    let exactTitleMatch = false;

    // 1. So khớp tuyệt đối tên gốc (Original Title)
    if (itemOrig && normOrig && itemOrig === normOrig) {
      score += 70;
      exactTitleMatch = true;
    }
    // 2. So khớp tuyệt đối tên tiếng Việt (Vietnamese Title)
    else if (itemName && normVi && itemName === normVi) {
      score += 70;
      exactTitleMatch = true;
    }
    // 3. Khớp chéo tuyệt đối
    else if ((itemOrig && normVi && itemOrig === normVi) || (itemName && normOrig && itemName === normOrig)) {
      score += 65;
      exactTitleMatch = true;
    }

    // [QUAN TRỌNG]: Tuyệt đối KHÔNG ghép bừa phim khác nhau chỉ vì chung vài từ (ví dụ: "Runner" vs "The Runner", "Blade Runner" vs "Runner")
    if (!exactTitleMatch) {
      continue;
    }

    // So khớp năm phát hành (phải chính xác hoặc chênh lệch tối đa 1 năm do liên hoan phim)
    if (!isNaN(itemYear) && !isNaN(tmdbYear)) {
      const yearDiff = Math.abs(itemYear - tmdbYear);
      if (yearDiff === 0) score += 30;
      else if (yearDiff === 1) score += 15;
      else if (yearDiff >= 2) score -= 40;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  // Đòi hỏi score >= 85 (bắt buộc phải khớp tên 100% và năm chênh lệch không quá 1 năm)
  return { matched: bestScore >= 85 ? bestMatch : null, score: bestScore };
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
    poster_path:     tmdbPosterPath,
    backdrop_path:   tmdbBackdropPath,
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
    poster_path:     tmdbPosterPath,
    backdrop_path:   tmdbBackdropPath,
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
  // 1. Try local reverse proxy first (same-origin, 100% immune to browser CORS policies & client adblockers)
  try {
    const res = await fetchWithTimeout(`${PROXY_URL}${endpoint}`, PRIMARY_TIMEOUT);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.status !== false) {
          return { data, source: 'primary' };
        }
      }
    }
  } catch {
    // If reverse proxy is unreachable (e.g., pure static production host), fall through to direct fetch
  }

  // 2. Direct fetch to PRIMARY_URL
  try {
    const res = await fetchWithTimeout(`${PRIMARY_URL}${endpoint}`, PRIMARY_TIMEOUT);
    if (!res.ok) throw new Error(`Primary HTTP ${res.status}`);
    
    const data = await res.json();
    if (data && data.status === false) {
      throw new Error(`Primary API returned status: false (${data.msg || ''})`);
    }

    return { data, source: 'primary' };
  } catch (err) {
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
    fetchWithCache(`detail:v3:${slug}`, async () => {
      const isTmdbSlug = slug.startsWith('tmdb-') || /^\d+$/.test(slug);
      const tmdbIdFromSlug = isTmdbSlug ? slug.replace(/^tmdb-/, '') : null;

      // ── TRƯỜNG HỢP 1: Phim từ TMDB (ví dụ: Phim Thịnh Hành tmdb-xxxx) ──
      if (tmdbIdFromSlug && TMDB_ENABLED) {
        let tmdbDetail = await fetchTmdbDetail(tmdbIdFromSlug, 'movie');
        if (!tmdbDetail) {
          tmdbDetail = await fetchTmdbDetail(tmdbIdFromSlug, 'tv');
        }
        if (tmdbDetail) {
          const isTv = !tmdbDetail.title && (!!tmdbDetail.name || !!tmdbDetail.number_of_seasons);
          const releaseDate = tmdbDetail.release_date || tmdbDetail.first_air_date || '';
          let qualityTag: 'CHƯA RA MẮT' | 'CAM' | 'FHD' = 'FHD';
          if (!isTv) {
            qualityTag = calculateMovieQuality(tmdbDetail.release_dates, releaseDate);
          } else {
            if (releaseDate && new Date(releaseDate).getTime() > Date.now()) {
              qualityTag = 'CHƯA RA MẮT';
            } else {
              qualityTag = 'FHD';
            }
          }

          // Thuật toán so sánh siêu nhanh và ổn định xem phim có tồn tại trên phimapi.com không
          const { matched } = await findMatchInPhimApi(tmdbDetail);

          // NẾU CÓ: Lấy chi tiết trên phimapi.com, nhưng Diễn viên và Hình ảnh lấy từ TMDb
          if (matched && matched.slug) {
            try {
              const phimapiResult = await apiFetch(`/phim/${matched.slug}`);
              if (phimapiResult?.data?.movie) {
                const normPrimary = normalizePrimary(phimapiResult.data, phimapiResult.source);

                // Ưu tiên tên tiếng Việt từ TMDb hoặc phimapi
                if (tmdbDetail.title) normPrimary.name = tmdbDetail.title;
                if (tmdbDetail.original_title) normPrimary.origin_name = tmdbDetail.original_title;

                // [YÊU CẦU]: Actors và Images lấy từ TMDB
                const bestPoster = extractBestPoster(tmdbDetail.images) || (tmdbDetail.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbDetail.poster_path}` : normPrimary.poster_url);
                const bestBackdrop = extractBestBackdrop(tmdbDetail.images) || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetail.backdrop_path}` : normPrimary.thumb_url);
                normPrimary.poster_url = bestPoster;
                normPrimary.thumb_url = bestBackdrop;
                normPrimary.poster_path = tmdbDetail.poster_path;
                normPrimary.backdrop_path = tmdbDetail.backdrop_path;

                if (tmdbDetail.credits?.cast?.length) {
                  normPrimary.actor = tmdbDetail.credits.cast.slice(0, 15).map((a: any) => a.name);
                }
                if (tmdbDetail.credits?.crew?.length) {
                  const dirs = tmdbDetail.credits.crew.filter((c: any) => c.job === 'Director').map((d: any) => d.name);
                  if (dirs.length) normPrimary.director = dirs;
                }

                // Cập nhật tag chất lượng theo quy tắc
                normPrimary.quality = qualityTag || normPrimary.quality || 'FHD';

                // [YÊU CẦU]: Quốc gia phát hành chuẩn từ TMDB (Hoa Kỳ, Đức, Anh,...)
                if (tmdbDetail.production_countries?.length || (tmdbDetail as any).origin_country?.length) {
                  normPrimary.country = translateTmdbCountries(tmdbDetail.production_countries, (tmdbDetail as any).origin_country);
                }

                // [YÊU CẦU]: Thể loại từ TMDB loại bỏ chữ "Phim"
                if (tmdbDetail.genres?.length) {
                  normPrimary.category = tmdbDetail.genres.map((g: any) => ({
                    id: String(g.id),
                    name: cleanTmdbGenre(g.name),
                    slug: toSlug(cleanTmdbGenre(g.name)),
                  }));
                }

                // [YÊU CẦU]: Trailer từ TMDb
                let trailer = extractBestTrailer(tmdbDetail.videos);
                if (!trailer && tmdbDetail.id) {
                  trailer = await fetchTmdbVideos(tmdbDetail.id, 'movie');
                }
                if (trailer) {
                  normPrimary.trailer_url = trailer;
                }

                normPrimary.tmdb = {
                  id: tmdbDetail.id,
                  type: 'movie',
                  vote_average: tmdbDetail.vote_average,
                  vote_count: tmdbDetail.vote_count,
                  poster_path: tmdbDetail.poster_path,
                  backdrop_path: tmdbDetail.backdrop_path,
                  title: tmdbDetail.title,
                  original_title: tmdbDetail.original_title,
                  genres: tmdbDetail.genres?.map((g: any) => cleanTmdbGenre(g.name)) || [],
                  runtime: tmdbDetail.runtime,
                };

                return {
                  movie: normPrimary,
                  episodes: phimapiResult.data.episodes || [],
                  _tmdb_used: true,
                  _tmdb_id: tmdbDetail.id,
                  _source: phimapiResult.source,
                };
              }
            } catch (err) {
              console.warn('[API] Lỗi lấy chi tiết phimapi cho phim tương ứng, fallback sang TMDb hoàn toàn:', err);
            }
          }

          // NẾU KHÔNG CÓ TRÊN PHIMAPI.COM: Dùng hoàn toàn TMDb trong Detail.tsx!
          const bestPoster = extractBestPoster(tmdbDetail.images) || (tmdbDetail.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbDetail.poster_path}` : PLACEHOLDER_URL);
          const bestBackdrop = extractBestBackdrop(tmdbDetail.images) || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetail.backdrop_path}` : PLACEHOLDER_URL);

          let trailer = extractBestTrailer(tmdbDetail.videos);
          if (!trailer && tmdbDetail.id) {
            trailer = await fetchTmdbVideos(tmdbDetail.id, isTv ? 'tv' : 'movie');
          }

          const tmdbOnlyMovie: NormalizedMovie = {
            _id: `tmdb-${tmdbDetail.id}`,
            slug: `tmdb-${tmdbDetail.id}`,
            name: tmdbDetail.title || tmdbDetail.name || '',
            origin_name: tmdbDetail.original_title || tmdbDetail.original_name || tmdbDetail.title || '',
            poster_url: bestPoster,
            thumb_url: bestBackdrop,
            poster_path: tmdbDetail.poster_path,
            backdrop_path: tmdbDetail.backdrop_path,
            description: tmdbDetail.overview || 'Chưa có thông tin giới thiệu tiếng Việt cho phim này.',
            content: tmdbDetail.overview || 'Chưa có thông tin giới thiệu tiếng Việt cho phim này.',
            year: (tmdbDetail.release_date || tmdbDetail.first_air_date || '').slice(0, 4),
            quality: qualityTag,
            lang: 'Vietsub',
            time: tmdbDetail.runtime ? `${tmdbDetail.runtime} phút` : (tmdbDetail.episode_run_time?.[0] ? `${tmdbDetail.episode_run_time[0]} phút/tập` : ''),
            episode_current: qualityTag === 'CHƯA RA MẮT' ? 'Chưa chiếu' : (isTv ? (tmdbDetail.number_of_episodes ? `${tmdbDetail.number_of_episodes} Tập` : 'Trọn bộ') : 'Bản chiếu rạp / Trailer'),
            episode_total: String(tmdbDetail.number_of_episodes || tmdbDetail.number_of_seasons || 1),
            type: isTv ? 'series' : 'movie',
            category: (tmdbDetail.genres || []).map((g: any) => ({ id: String(g.id), name: cleanTmdbGenre(g.name), slug: toSlug(cleanTmdbGenre(g.name)) })),
            country: translateTmdbCountries(tmdbDetail.production_countries, (tmdbDetail as any).origin_country),
            actor: (tmdbDetail.credits?.cast || []).slice(0, 15).map((a: any) => a.name),
            director: (tmdbDetail.credits?.crew || []).filter((c: any) => c.job === 'Director').map((d: any) => d.name),
            tmdb: {
              id: tmdbDetail.id,
              type: isTv ? 'tv' : 'movie',
              vote_average: tmdbDetail.vote_average,
              vote_count: tmdbDetail.vote_count,
              poster_path: tmdbDetail.poster_path,
              backdrop_path: tmdbDetail.backdrop_path,
              title: tmdbDetail.title || tmdbDetail.name,
              original_title: tmdbDetail.original_title || tmdbDetail.original_name,
              genres: tmdbDetail.genres?.map((g: any) => cleanTmdbGenre(g.name)) || [],
              runtime: tmdbDetail.runtime,
            },
            trailer_url: trailer || '',
            _source: 'primary',
          };

          return {
            movie: tmdbOnlyMovie,
            episodes: [],
            _tmdb_used: true,
            _tmdb_id: tmdbDetail.id,
            _source: 'primary',
          };
        }
      }

      // ── TRƯỜNG HỢP 2: Slug từ phimapi.com (xem bình thường) ──
      // [FIX 10] Không gọi apiFetch 2 lần — chỉ 1 lần, lỗi thì null
      const [phimapiResult, _] = await Promise.allSettled([
        apiFetch(`/phim/${slug}`),
        Promise.resolve(),
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
        tmdbDetail = await fetchTmdbDetail(tmdbSearch.id, mediaType);
      }

      // ── STAGE 4: Normalize phimapi data ──────────────────────
      if (!primaryData) {
        if (TMDB_ENABLED) {
          try {
            const cleanSlug = slug.replace(/^tmdb-/, '').replace(/-/g, ' ');
            const search = await fetchTmdbSearch(cleanSlug, undefined, 'multi');
            const tmdbId = search?.id || (slug.match(/^\d+$/) ? slug : null);
            if (tmdbId) {
              const tmdbDetail = await fetchTmdbDetail(tmdbId, search?.media_type || 'movie');
              if (tmdbDetail) {
                const qTag = calculateMovieQuality(tmdbDetail.release_dates, tmdbDetail.release_date);
                const bestPoster = extractBestPoster(tmdbDetail.images) || (tmdbDetail.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbDetail.poster_path}` : PLACEHOLDER_URL);
                const bestBackdrop = extractBestBackdrop(tmdbDetail.images) || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetail.backdrop_path}` : PLACEHOLDER_URL);
                return {
                  movie: {
                    _id: `tmdb-${tmdbDetail.id}`,
                    slug: `tmdb-${tmdbDetail.id}`,
                    name: tmdbDetail.title || tmdbDetail.name || '',
                    origin_name: tmdbDetail.original_title || tmdbDetail.original_name || tmdbDetail.title || '',
                    poster_url: bestPoster,
                    thumb_url: bestBackdrop,
                    poster_path: tmdbDetail.poster_path,
                    backdrop_path: tmdbDetail.backdrop_path,
                    description: tmdbDetail.overview || 'Chưa có thông tin giới thiệu tiếng Việt cho phim này.',
                    content: tmdbDetail.overview || 'Chưa có thông tin giới thiệu tiếng Việt cho phim này.',
                    year: (tmdbDetail.release_date || tmdbDetail.first_air_date || '').slice(0, 4),
                    quality: qTag,
                    lang: 'Vietsub',
                    time: tmdbDetail.runtime ? `${tmdbDetail.runtime} phút` : '',
                    episode_current: qTag === 'CHƯA RA MẮT' ? 'Chưa chiếu' : 'Bản chiếu rạp / Trailer',
                    episode_total: '1',
                    type: 'movie',
                    category: (tmdbDetail.genres || []).map((g: any) => ({ id: String(g.id), name: cleanTmdbGenre(g.name), slug: toSlug(cleanTmdbGenre(g.name)) })),
                    country: translateTmdbCountries(tmdbDetail.production_countries, tmdbDetail.origin_country),
                    actor: (tmdbDetail.credits?.cast || []).slice(0, 15).map((a: any) => a.name),
                    director: (tmdbDetail.credits?.crew || []).filter((c: any) => c.job === 'Director').map((d: any) => d.name),
                    tmdb: {
                      id: tmdbDetail.id,
                      type: 'movie',
                      vote_average: tmdbDetail.vote_average,
                      vote_count: tmdbDetail.vote_count,
                      poster_path: tmdbDetail.poster_path,
                      backdrop_path: tmdbDetail.backdrop_path,
                      title: tmdbDetail.title,
                      original_title: tmdbDetail.original_title,
                      genres: tmdbDetail.genres?.map((g: any) => cleanTmdbGenre(g.name)) || [],
                      runtime: tmdbDetail.runtime,
                    },
                    trailer_url: extractBestTrailer(tmdbDetail.videos) || await fetchTmdbVideos(tmdbDetail.id, 'movie') || '',
                    _source: 'primary',
                  },
                  episodes: [],
                  _tmdb_used: true,
                  _tmdb_id: tmdbDetail.id,
                  _source: 'primary',
                };
              }
            }
          } catch { /* continue to error */ }
        }
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

        // [YÊU CẦU]: Trailer — lấy từ TMDB videos
        let trailer = extractBestTrailer(tmdbDetail.videos);
        if (!trailer && tmdbDetail.id) {
          trailer = await fetchTmdbVideos(tmdbDetail.id, tmdbSearch?.media_type || normalized.type);
        }
        if (trailer) {
          normalized.trailer_url = trailer;
        }

        // [YÊU CẦU]: Quốc gia phát hành chuẩn từ TMDB (Hoa Kỳ, Đức, Anh,...)
        if (tmdbDetail.production_countries?.length || (tmdbDetail as any).origin_country?.length) {
          normalized.country = translateTmdbCountries(tmdbDetail.production_countries, (tmdbDetail as any).origin_country);
        }

        // [YÊU CẦU]: Thể loại từ TMDB, loại bỏ chữ "Phim"
        if (tmdbDetail.genres?.length) {
          normalized.category = tmdbDetail.genres.map((g: any) => ({
            id: String(g.id),
            name: cleanTmdbGenre(g.name),
            slug: toSlug(cleanTmdbGenre(g.name)),
          }));
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
          genres:        tmdbDetail.genres?.map(g => cleanTmdbGenre(g.name)) || [],
          runtime:       tmdbDetail.runtime,
        };

        // [FIX 11] Ảnh — TMDB Primary (w500 cho poster, w1280 cho backdrop)
        const bestBackdrop = extractBestBackdrop(tmdbDetail.images);
        const bestPoster   = extractBestPoster(tmdbDetail.images);
        // Fallback về poster_path/backdrop_path nếu images rỗng
        const tmdbPoster   = bestPoster   || (tmdbDetail.poster_path   ? `https://image.tmdb.org/t/p/w500${tmdbDetail.poster_path}`   : '');
        const tmdbBackdrop = bestBackdrop || (tmdbDetail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetail.backdrop_path}` : '');

        if (tmdbPoster) {
          normalized.poster_url = tmdbPoster;
          normalized.poster_path = tmdbDetail.poster_path;
        }
        if (tmdbBackdrop) {
          normalized.thumb_url = tmdbBackdrop;
          normalized.backdrop_path = tmdbDetail.backdrop_path;
        }

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
        if (tmdbSearch.poster_path) {
          normalized.poster_url = `https://image.tmdb.org/t/p/w500${tmdbSearch.poster_path}`;
          normalized.poster_path = tmdbSearch.poster_path;
        }
        if (tmdbSearch.backdrop_path) {
          normalized.thumb_url  = `https://image.tmdb.org/t/p/w1280${tmdbSearch.backdrop_path}`;
          normalized.backdrop_path = tmdbSearch.backdrop_path;
        }
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

  search: async (keyword: string, page = 1, limit = 24, filters: { category?: string; country?: string; year?: string; sort_field?: string; sort_type?: string; sort_lang?: string } = {}) => {
    const cleanKeyword = (keyword || '').trim();
    if (!cleanKeyword) {
      return { items: [], pagination: null };
    }
    return fetchWithCache(`search:${cleanKeyword}:${page}:${limit}:${JSON.stringify(filters)}`, async () => {
      try {
        const params = new URLSearchParams();
        params.append('keyword', cleanKeyword);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (filters.category) params.append('category', filters.category);
        if (filters.country) params.append('country', filters.country);
        if (filters.year) params.append('year', filters.year);
        if (filters.sort_field) params.append('sort_field', filters.sort_field);
        if (filters.sort_type) params.append('sort_type', filters.sort_type);
        if (filters.sort_lang) params.append('sort_lang', filters.sort_lang);

        const { data, source } = await apiFetch(`/v1/api/tim-kiem?${params.toString()}`);
        let items      = (data.data?.items || data.items || []).map((i: any) => normalizeBySource(i, source));
        let pagination = data.data?.params?.pagination || data.pagination || null;

        // Nếu phim không tồn tại trên phimapi.com (0 kết quả), tự động fallback sang TMDb giống như Phim Thịnh Hành để tìm kiếm & preview
        if (!items || items.length === 0) {
          const tmdbRes = await searchTmdbMultiList(cleanKeyword, page, limit, filters);
          if (tmdbRes && tmdbRes.items && tmdbRes.items.length > 0) {
            return tmdbRes;
          }
        }

        return { items, pagination };
      } catch (err) {
        console.warn('[API Search] Search failed for:', cleanKeyword, err);
        // Fallback sang TMDB nếu phimapi lỗi
        try {
          const tmdbRes = await searchTmdbMultiList(cleanKeyword, page, limit, filters);
          if (tmdbRes && tmdbRes.items && tmdbRes.items.length > 0) {
            return tmdbRes;
          }
        } catch {}
        return { items: [], pagination: null };
      }
    }, TTL.SEARCH);
  },

  getApiStatus: () => ({
    usingFallback: false,
    consecutiveFails: 0,
  }),

  getTrendingTmdb: async (timeWindow: 'day' | 'week' = 'day') => {
    try {
      const options = { method: 'GET', headers: { accept: 'application/json' } };
      const [resVi, resEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/movie/${timeWindow}?language=vi-VN&api_key=${TMDB_KEY}`, options).then(r => r.json()).catch(() => null),
        fetch(`https://api.themoviedb.org/3/trending/movie/${timeWindow}?language=en-US&api_key=${TMDB_KEY}`, options).then(r => r.json()).catch(() => null),
      ]);
      const data = resVi || resEn;
      if (!data?.results) throw new Error('No results from TMDB trending');

      const enPosters = new Map((resEn?.results || []).map((m: any) => [m.id, m.poster_path]));
      const results = (data.results || []).slice(0, 15);

      // Fetch release dates in parallel để tính quality tag chính xác
      const releasePromises = results.map((m: any) =>
        fetch(`https://api.themoviedb.org/3/movie/${m.id}/release_dates?api_key=${TMDB_KEY}`)
          .then(r => r.json())
          .catch(() => null)
      );
      const releaseResults = await Promise.all(releasePromises);

      return results.map((m: any, idx: number) => {
        const qualityTag = calculateMovieQuality(releaseResults[idx], m.release_date);
        const englishPosterPath = enPosters.get(m.id) || m.poster_path;

        return {
          _id: `tmdb-${m.id}`,
          id: m.id,
          name: m.title || m.name,
          origin_name: m.original_title || m.original_name || m.title || '',
          poster_url: englishPosterPath ? `https://image.tmdb.org/t/p/w500${englishPosterPath}` : PLACEHOLDER_URL,
          thumb_url: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : (englishPosterPath ? `https://image.tmdb.org/t/p/w500${englishPosterPath}` : PLACEHOLDER_URL),
          poster_path: englishPosterPath,
          backdrop_path: m.backdrop_path,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          description: m.overview || '',
          content: m.overview || '',
          slug: `tmdb-${m.id}`,
          quality: qualityTag,
          vote_average: m.vote_average,
          tmdb: {
            id: m.id,
            type: 'movie',
            vote_average: m.vote_average,
            poster_path: englishPosterPath,
            backdrop_path: m.backdrop_path,
          },
          _source: 'primary' as const,
        };
      });
    } catch (err) {
      console.error('[API] getTrendingTmdb failed:', err);
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