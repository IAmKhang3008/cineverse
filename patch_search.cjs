const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const searchTmdbWithCacheOld = `export async function searchTmdbWithCache(movie: any) {
  if (!TMDB_ENABLED || !movie) return null;

  // 1. Direct TMDB ID if present
  const tmdbObj = extractTmdbObj(movie);
  if (tmdbObj?.id) {
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie' };
  }

  // 2. Direct IMDb ID if present
  if (tmdbObj?.imdb_id) {
    const findResult = await fetchWithCache(\`tmdb_find_\${tmdbObj.imdb_id}\`, () => fetchTmdbByExternalId(tmdbObj.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
    if (findResult?.id) {
      return findResult;
    }
  }

  // 3. Search by title
  const searchYear = String(movie.year || '');
  const searchName = movie.name || movie.title || '';
  const searchOrigin = movie.origin_name || '';
  const isTv = movie.type === 'series' || movie.type === 'hoathinh' || movie.type === 'tvshows';
  const targetType = isTv ? 'tv' : 'movie';

  const cacheKey = \`tmdb_unified_search_v2_\${movie.slug || searchOrigin || searchName}_\${searchYear}\`;

  return fetchWithCache(cacheKey, async () => {
    // Await sequentially to prioritize original name over localized name
    if (searchOrigin) {
      const res1 = await fetchTmdbSearch(searchOrigin, searchYear, targetType);
      if (res1) return res1;
    }
    if (searchName && searchName !== searchOrigin) {
      const res2 = await fetchTmdbSearch(searchName, searchYear, targetType);
      if (res2) return res2;
    }
    if (searchOrigin) {
      const res3 = await fetchTmdbSearch(searchOrigin, searchYear, 'multi');
      if (res3) return res3;
    }
    return null;
  }, TTL.TMDB_STATIC);
}`;

const searchTmdbWithCacheNew = `export async function searchTmdbWithCache(movie: any) {
  if (!TMDB_ENABLED || !movie) return null;

  let extractedSeason = 1;
  const isTv = movie.type === 'series' || movie.type === 'hoathinh' || movie.type === 'tvshows';
  const targetType = isTv ? 'tv' : 'movie';

  let searchName = movie.name || movie.title || '';
  let searchOrigin = movie.origin_name || '';

  // Extract season for TV shows
  if (isTv) {
    const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
    const originMatch = searchOrigin.match(seasonRegex);
    if (originMatch) {
      extractedSeason = parseInt(originMatch[1], 10);
      searchOrigin = searchOrigin.replace(seasonRegex, '').replace(/[\\(\\)-]+$/, '').trim();
    }
    const nameMatch = searchName.match(seasonRegex);
    if (nameMatch) {
      if (!originMatch) extractedSeason = parseInt(nameMatch[1], 10);
      searchName = searchName.replace(seasonRegex, '').replace(/[\\(\\)-]+$/, '').trim();
    }
  }

  // 1. Direct TMDB ID if present
  const tmdbObj = extractTmdbObj(movie);
  if (tmdbObj?.id) {
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: tmdbObj.season || extractedSeason };
  }

  // 2. Direct IMDb ID if present
  if (tmdbObj?.imdb_id) {
    const findResult = await fetchWithCache(\`tmdb_find_\${tmdbObj.imdb_id}\`, () => fetchTmdbByExternalId(tmdbObj.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
    if (findResult?.id) {
      return { ...findResult, season: extractedSeason };
    }
  }

  // 3. Search by title
  const searchYear = String(movie.year || '');

  const cacheKey = \`tmdb_unified_search_v3_\${movie.slug || searchOrigin || searchName}_\${searchYear}\`;

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
      return { ...finalResult, season: extractedSeason };
    }
    return null;
  }, TTL.TMDB_STATIC);
}`;

code = code.replace(searchTmdbWithCacheOld, searchTmdbWithCacheNew);
fs.writeFileSync(path, code);
