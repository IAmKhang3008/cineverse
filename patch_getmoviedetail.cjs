const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const targetDetail = `      if (TMDB_ENABLED) {
        if (existingTmdb?.id) {
          // 1. Phimapi provided TMDB ID directly -> use it instantly
          tmdbSearch = { id: Number(existingTmdb.id), title: rawMovie.name || '', original_title: rawMovie.origin_name || '', media_type: existingTmdb.type || 'movie' };
        } else if (existingTmdb?.imdb_id) {
          // 2. Phimapi provided IMDb ID -> lookup TMDb /find endpoint directly
          const findRes = await fetchWithCache(\`tmdb_find_\${existingTmdb.imdb_id}\`, () => fetchTmdbByExternalId(existingTmdb.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
          if (findRes?.id) {
            tmdbSearch = findRes;
          }
        }`;

const replaceDetail = `      if (TMDB_ENABLED) {
        if (existingTmdb?.id) {
          // 1. Phimapi provided TMDB ID directly -> use it instantly
          tmdbSearch = { id: Number(existingTmdb.id), title: rawMovie.name || '', original_title: rawMovie.origin_name || '', media_type: existingTmdb.type || 'movie', season: existingTmdb.season || 1 };
        } else if (existingTmdb?.imdb_id) {
          // 2. Phimapi provided IMDb ID -> lookup TMDb /find endpoint directly
          const findRes = await fetchWithCache(\`tmdb_find_\${existingTmdb.imdb_id}\`, () => fetchTmdbByExternalId(existingTmdb.imdb_id!, 'imdb_id'), TTL.TMDB_STATIC);
          if (findRes?.id) {
            tmdbSearch = { ...findRes, season: existingTmdb.season || 1 };
          }
        }`;

code = code.replace(targetDetail, replaceDetail);
fs.writeFileSync(path, code);
