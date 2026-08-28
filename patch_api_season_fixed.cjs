const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /export async function searchTmdbWithCache\(movie: any\) \{[\s\S]*?return null;\s*\}, TTL\.TMDB_STATIC\);\s*\}/;

const newSearchBlock = `export async function searchTmdbWithCache(movie: any) {
  if (!TMDB_ENABLED || !movie) return null;

  let extractedSeason: number | null = null;
  const isTv = movie.type === 'series' || movie.type === 'hoathinh' || movie.type === 'tvshows';
  const targetType = isTv ? 'tv' : 'movie';

  let searchName = movie.name || movie.title || '';
  let searchOrigin = movie.origin_name || '';

  // Extract season for TV shows
  if (isTv) {
    const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
    const trailingNumberRegex = /\\s+(\\d+)\\s*$/;
    
    let originMatch = searchOrigin.match(seasonRegex);
    if (!originMatch) originMatch = searchOrigin.match(trailingNumberRegex);
    
    if (originMatch) {
      extractedSeason = parseInt(originMatch[1], 10);
      searchOrigin = searchOrigin.replace(seasonRegex, '').replace(trailingNumberRegex, '').replace(/[\\(\\)-]+$/, '').trim();
    }
    
    let nameMatch = searchName.match(seasonRegex);
    if (!nameMatch) nameMatch = searchName.match(trailingNumberRegex);
    
    if (nameMatch) {
      if (!extractedSeason) extractedSeason = parseInt(nameMatch[1], 10);
      searchName = searchName.replace(seasonRegex, '').replace(trailingNumberRegex, '').replace(/[\\(\\)-]+$/, '').trim();
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
              if (sName.replace(/season \\d+/i, '').trim().length > 3) {
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
    const s = await resolveSeasonFromTmdb(Number(tmdbObj.id), tmdbObj.type || 'movie');
    return { id: Number(tmdbObj.id), media_type: tmdbObj.type || 'movie', season: tmdbObj.season || s };
  }

  // 2. Direct IMDb ID if present
  if (tmdbObj?.imdb_id) {
    const findResult = await fetchWithCache(\`tmdb_find_\${tmdbObj.imdb_id}\`, () => fetchTmdbByExternalId(tmdbObj.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
    if (findResult?.id) {
      const s = await resolveSeasonFromTmdb(findResult.id, findResult.media_type);
      return { ...findResult, season: s };
    }
  }

  // 3. Search by title
  const searchYear = String(movie.year || '');
  const cacheKey = \`tmdb_unified_search_v5_\${movie.slug || searchOrigin || searchName}_\${searchYear}\`;
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
}`;

code = code.replace(regex, newSearchBlock);
fs.writeFileSync(path, code);
