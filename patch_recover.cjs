const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const missingCode = `
export const PLACEHOLDER_URL = 'https://placehold.co/500x750/1a1a1a/FFF?text=No+Image';

export type TmdbMovieInfo = {
  type?: 'movie' | 'tv';
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

export function upgradeImageUrl(url: string) { return url; }
export function needsImageUpgrade(url: string) { return false; }
export function extractBestPoster(images: any) { return null; }
export function extractBestBackdrop(images: any) { return null; }
export function extractBestTrailer(videos: any) { return null; }
export async function fetchTmdbSearch(title: string, year: string, type: string) { return null; }
export async function fetchTmdbDetail(type: string, id: string | number) { return null; }

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
    url = path.startsWith('http') ? path : (domain ? (path.startsWith('/') ? \`\${domain}\${path}\` : \`\${domain}/\${path}\`) : (path.startsWith('/') ? \`https://phimimg.com\${path}\` : \`https://phimimg.com/\${path}\`));
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

`;

code = code.replace(/async function apiFetch\(endpoint: string\): Promise<\{ data: any; source: 'primary' \| 'fallback' \}> \{/m, missingCode + '\nasync function apiFetch(endpoint: string): Promise<{ data: any; source: \'primary\' | \'fallback\' }> {');

fs.writeFileSync('src/lib/api.ts', code);
