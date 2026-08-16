const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const targetObj = `export function extractTmdbObj(m: any): TmdbMovieInfo | undefined {
  if (!m) return undefined;
  const rawM = m.movie || m;
  
  let id = rawM.tmdb?.id || rawM.tmdb_id;
  if (!id && (typeof rawM.tmdb === 'number' || (typeof rawM.tmdb === 'string' && /^\\d+$/.test(rawM.tmdb)))) {
    id = rawM.tmdb;
  }

  let imdbId = rawM.imdb_id || rawM.imdb?.id;
  if (!imdbId && typeof rawM.imdb === 'string' && rawM.imdb.startsWith('tt')) {
    imdbId = rawM.imdb;
  }

  let type = rawM.tmdb?.type || (rawM.type === 'series' || rawM.type === 'hoathinh' || rawM.type === 'tvshows' ? 'tv' : 'movie');
  let season = rawM.tmdb?.season || rawM.season || 1;

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
}`;

const replacementObj = `export function extractTmdbObj(m: any): TmdbMovieInfo | undefined {
  if (!m) return undefined;
  const rawM = m.movie || m;
  
  let id = rawM.tmdb?.id || rawM.tmdb_id;
  if (!id && (typeof rawM.tmdb === 'number' || (typeof rawM.tmdb === 'string' && /^\\d+$/.test(rawM.tmdb)))) {
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
      const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
      
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
}`;

code = code.replace(targetObj, replacementObj);

// Also need to update searchTmdbWithCache to not duplicate the regex logic, or we can just leave it there as it also cleans the title for search
fs.writeFileSync(path, code);
