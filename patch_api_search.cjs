const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const targetFetchTmdbSearch = `export async function fetchTmdbSearch(title: string, year?: string, type?: 'movie' | 'tv' | 'multi') {
  if (!TMDB_ENABLED || !title) return null;
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  try {
    let endpoint = '/3/search/multi';
    let yearParam = '';
    if (type === 'movie') {
      endpoint = '/3/search/movie';
      yearParam = year ? \`&year=\${year}&primary_release_year=\${year}\` : '';
    } else if (type === 'tv') {
      endpoint = '/3/search/tv';
      yearParam = year ? \`&first_air_date_year=\${year}\` : '';
    } else if (year) {
      yearParam = \`&year=\${year}\`;
    }

    const res = await fetch(\`https://api.themoviedb.org\${endpoint}?api_key=\${TMDB_KEY}&query=\${encodeURIComponent(cleanTitle)}\${yearParam}&language=en-US\`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) return null;

    const valid = results.filter((r: any) => r.media_type !== 'person');
    if (!valid.length) return null;

    const top = valid[0];
    if (!top.media_type) {
      top.media_type = type || (top.first_air_date ? 'tv' : 'movie');
    }
    return top;
  } catch {
    return null;
  }
}`;

const replacementFetchTmdbSearch = `export async function fetchTmdbSearch(title: string, year?: string, type?: 'movie' | 'tv' | 'multi') {
  if (!TMDB_ENABLED || !title) return null;
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  try {
    let endpoint = '/3/search/multi';
    let yearParam = '';
    if (type === 'movie') {
      endpoint = '/3/search/movie';
      // Do not strictly enforce year in query yet, we will filter manually to be safe
      yearParam = year ? \`&year=\${year}&primary_release_year=\${year}\` : '';
    } else if (type === 'tv') {
      endpoint = '/3/search/tv';
      yearParam = year ? \`&first_air_date_year=\${year}\` : '';
    }

    // Try with year param first
    let res = await fetch(\`https://api.themoviedb.org\${endpoint}?api_key=\${TMDB_KEY}&query=\${encodeURIComponent(cleanTitle)}\${yearParam}&language=en-US\`);
    let data = await res.json();
    let results = data.results || [];

    // If no results, fallback to search without year param
    if (!results.length && year) {
        res = await fetch(\`https://api.themoviedb.org\${endpoint}?api_key=\${TMDB_KEY}&query=\${encodeURIComponent(cleanTitle)}&language=en-US\`);
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
        
        // Exact year match is crucial
        if (itemYear === targetYear) {
            score += 10;
        } else if (itemYear && Math.abs(itemYear - targetYear) === 1) {
            score += 5; // Sometimes TMDB year and PhimAPI year differ by 1
        }
        
        const nameMatch = item.title?.toLowerCase() === cleanTitle.toLowerCase() || item.name?.toLowerCase() === cleanTitle.toLowerCase();
        const originNameMatch = item.original_title?.toLowerCase() === cleanTitle.toLowerCase() || item.original_name?.toLowerCase() === cleanTitle.toLowerCase();
        
        if (nameMatch || originNameMatch) {
            score += 5;
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
}`;

const targetSearchTmdbWithCache = `export async function searchTmdbWithCache(movie: any) {
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

  const cacheKey = \`tmdb_unified_search_\${movie.slug || searchOrigin || searchName}_\${searchYear}\`;

  return fetchWithCache(cacheKey, async () => {
    const searchPromises: Promise<any>[] = [];

    if (searchOrigin) {
      searchPromises.push(fetchTmdbSearch(searchOrigin, searchYear, targetType));
    }
    if (searchName && searchName !== searchOrigin) {
      searchPromises.push(fetchTmdbSearch(searchName, searchYear, targetType));
    }
    if (searchOrigin) {
      searchPromises.push(fetchTmdbSearch(searchOrigin, searchYear, 'multi'));
    }

    if (searchPromises.length === 0) return null;

    try {
      const result = await Promise.race([
        Promise.any(searchPromises.map(p => p.then(r => r ?? Promise.reject('null')))),
        new Promise<null>(r => setTimeout(() => r(null), 3500)),
      ]);
      return result;
    } catch {
      return null;
    }
  }, TTL.TMDB_STATIC);
}`;

const replacementSearchTmdbWithCache = `export async function searchTmdbWithCache(movie: any) {
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

  const cacheKey = \`tmdb_unified_search_\${movie.slug || searchOrigin || searchName}_\${searchYear}\`;

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

code = code.replace(targetFetchTmdbSearch, replacementFetchTmdbSearch);
code = code.replace(targetSearchTmdbWithCache, replacementSearchTmdbWithCache);
fs.writeFileSync(path, code);
