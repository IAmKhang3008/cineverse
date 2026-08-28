const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `      // ── STAGE 2: Get TMDB ID ─────────────────────────────────
      let tmdbSearch: TmdbMovieInfo | null = null;
      if (TMDB_ENABLED) {
        const rawMovie = primaryData.movie || primaryData.item || {};
        const existingTmdb = extractTmdbObj(rawMovie);

        if (existingTmdb?.id) {
          // 1. Phimapi provided TMDb ID directly
          tmdbSearch = { id: Number(existingTmdb.id), media_type: existingTmdb.type || 'movie', season: existingTmdb.season || 1, vote_average: 0, vote_count: 0 };
        } else if (existingTmdb?.imdb_id) {
          // 2. Phimapi provided IMDb ID -> lookup TMDb /find endpoint directly
          const findRes = await fetchWithCache(\`tmdb_find_\${existingTmdb.imdb_id}\`, () => fetchTmdbByExternalId(existingTmdb.imdb_id, 'imdb_id'), TTL.TMDB_STATIC);
          if (findRes?.id) {
            tmdbSearch = { ...findRes, season: existingTmdb.season || 1 };
          }
        }

        // 3. Fallback to unified TMDB search
        if (!tmdbSearch && (rawMovie.name || rawMovie.origin_name)) {
          tmdbSearch = await searchTmdbWithCache(rawMovie) as TmdbMovieInfo | null;
        }
      }`;

const replacement = `      // ── STAGE 2: Get TMDB ID & Extract Exact Season ────────
      let tmdbSearch: TmdbMovieInfo | null = null;
      if (TMDB_ENABLED) {
        const rawMovie = primaryData.movie || primaryData.item || {};
        // Always pass through our robust searchTmdbWithCache
        // It handles Direct ID, IMDb ID, and fallback title searches perfectly
        // WHILE also extracting the exact season from the raw titles!
        tmdbSearch = await searchTmdbWithCache(rawMovie) as TmdbMovieInfo | null;
      }`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
