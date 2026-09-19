/**
 * colorExtractor.ts - Universal adaptive color extraction for movie detail panels
 * Works seamlessly across all devices (Desktop, Mobile, Tablets, Smart TVs)
 * Bypasses Chrome's cached image CORS restrictions via Blob fetching and canvas analysis.
 */

import { getImageUrl } from './api';

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/**
 * Deterministic genre/title-based fallback color generator
 * Ensures every movie gets an appropriate, vibrant theme accent color
 * even when third-party image CDNs block cross-origin requests.
 */
export function getMovieThemeColorFallback(movieData: any): string {
  if (!movieData) return '#E50914';

  const categories = movieData.category
    ? (Array.isArray(movieData.category) ? movieData.category : Object.values(movieData.category))
    : [];
  const catNames = categories.map((c: any) => (c.name || '').toLowerCase()).join(' ');

  if (catNames.includes('viễn tưởng') || catNames.includes('khoa học') || catNames.includes('sci-fi')) {
    return '#06B6D4'; // Vibrant Cyan
  }
  if (catNames.includes('hoạt hình') || catNames.includes('anime')) {
    return '#8B5CF6'; // Vivid Purple
  }
  if (catNames.includes('kinh dị') || catNames.includes('rùng rợn')) {
    return '#E11D48'; // Crimson Rose
  }
  if (catNames.includes('tình cảm') || catNames.includes('lãng mạn')) {
    return '#EC4899'; // Vibrant Pink
  }
  if (catNames.includes('hài')) {
    return '#F59E0B'; // Amber Gold
  }
  if (catNames.includes('phiêu lưu') || catNames.includes('tài liệu')) {
    return '#10B981'; // Emerald Green
  }
  if (catNames.includes('chiến tranh') || catNames.includes('cổ trang') || catNames.includes('lịch sử')) {
    return '#D97706'; // Warm Bronze
  }
  if (catNames.includes('hành động')) {
    return '#F97316'; // Vivid Orange
  }

  // Fallback hash from movie slug or name
  const str = movieData.slug || movieData.name || 'cineverse';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 82, 54);
}

/**
 * Extracts the most vibrant, visually pleasing color from an image using canvas
 */
export function extractVibrantColorFromImage(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const size = 32;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const data = ctx.getImageData(0, 0, size, size).data;
    let bestHex: string | null = null;
    let highestScore = -1;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue;

      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const delta = max - min;
      const l = (max + min) / 2;
      const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

      // Skip overly dark, overly washed out, or low saturation pixels
      if (l < 0.18 || l > 0.88 || s < 0.22) continue;

      const lightnessDist = Math.abs(l - 0.52);
      const score = s * 2.0 - lightnessDist * 1.5;

      if (score > highestScore) {
        highestScore = score;
        const targetS = Math.max(s, 0.72);
        const targetL = Math.max(0.44, Math.min(0.62, l));
        
        let h = 0;
        if (delta !== 0) {
          if (max === rn) h = ((gn - bn) / delta) % 6;
          else if (max === gn) h = (bn - rn) / delta + 2;
          else h = (rn - gn) / delta + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
        }
        bestHex = hslToHex(h, targetS * 100, targetL * 100);
      }
    }

    return bestHex;
  } catch (err) {
    console.warn('Canvas color extraction failed:', err);
    return null;
  }
}

/**
 * Universal color extractor with multi-tier candidate resolution & CORS bypass
 */
export async function extractDominantColor(movie: any): Promise<string> {
  if (!movie) return '#E50914';

  const candidates: string[] = [];

  // Priority 1: TMDB poster (highest color vibrancy and native CORS support)
  const tmdbPoster = movie.poster_path || movie.tmdb?.poster_path;
  if (tmdbPoster) {
    const clean = tmdbPoster.startsWith('/') ? tmdbPoster : `/${tmdbPoster}`;
    candidates.push(`https://image.tmdb.org/t/p/w185${clean}`);
  }

  // Priority 2: TMDB backdrop
  const tmdbBackdrop = movie.backdrop_path || movie.tmdb?.backdrop_path;
  if (tmdbBackdrop) {
    const clean = tmdbBackdrop.startsWith('/') ? tmdbBackdrop : `/${tmdbBackdrop}`;
    candidates.push(`https://image.tmdb.org/t/p/w300${clean}`);
  }

  // Priority 3: poster_url
  if (movie.poster_url) {
    candidates.push(getImageUrl(movie.poster_url, 'poster'));
  }

  // Priority 4: thumb_url
  if (movie.thumb_url) {
    candidates.push(getImageUrl(movie.thumb_url, 'banner'));
  }

  // Tier 1: Fetch via CORS blob for TMDB images (which support CORS headers)
  for (const url of candidates) {
    if (!url.includes('image.tmdb.org')) continue;
    try {
      const corsUrl = url.includes('?') ? `${url}&cors=1` : `${url}?cors=1`;

      const res = await fetch(corsUrl, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();

        const color = await new Promise<string | null>((resolve) => {
          img.onload = () => {
            const extracted = extractVibrantColorFromImage(img);
            URL.revokeObjectURL(blobUrl);
            resolve(extracted);
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
          };
          img.src = blobUrl;
        });

        if (color) return color;
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Tier 2: Direct Image object for TMDB
  for (const url of candidates) {
    if (!url.includes('image.tmdb.org')) continue;
    try {
      const cacheBustUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      const color = await new Promise<string | null>((resolve) => {
        img.onload = () => resolve(extractVibrantColorFromImage(img));
        img.onerror = () => resolve(null);
        img.src = cacheBustUrl;
      });

      if (color) return color;
    } catch {
      // Continue
    }
  }

  // Tier 3: Deterministic fallback based on movie genres and title
  return getMovieThemeColorFallback(movie);
}
