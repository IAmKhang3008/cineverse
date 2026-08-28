const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const oldSearchBlock = `  // 1. Direct TMDB ID if present
  const tmdbObj = extractTmdbObj(movie);
  if (tmdbObj?.id) {
    const s = await resolveSeasonFromTmdb(Number(tmdbObj.id), tmdbObj.type || 'movie');
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: tmdbObj.season || s };
  }`;

const newSearchBlock = `  // 1. Direct TMDB ID if present
  const tmdbObj = extractTmdbObj(movie);
  if (tmdbObj?.id) {
    if (tmdbObj.season) {
      return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: tmdbObj.season };
    }
    const cacheKeyId = \`tmdb_season_resolve_\${tmdbObj.id}\`;
    const resolvedSeason = await fetchWithCache(cacheKeyId, () => resolveSeasonFromTmdb(Number(tmdbObj.id), tmdbObj.type || 'movie'), TTL.TMDB_STATIC);
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: resolvedSeason };
  }`;

code = code.replace(oldSearchBlock, newSearchBlock);
fs.writeFileSync(path, code);
