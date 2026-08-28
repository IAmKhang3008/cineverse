const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /\/\/ ── STAGE 2: TMDB resolution ────────────────────────────[\s\S]*?\/\/ ── STAGE 3: Fetch TMDB full detail \(append_to_response\) ──/g;

const replacement = `// ── STAGE 2: Get TMDB ID & Extract Exact Season ────────
      let tmdbSearch: TmdbMovieInfo | null = null;
      if (TMDB_ENABLED) {
        const rawMovie = primaryData?.movie || primaryData || {};
        tmdbSearch = await searchTmdbWithCache(rawMovie) as TmdbMovieInfo | null;
      }

      // ── STAGE 3: Fetch TMDB full detail (append_to_response) ──`;

code = code.replace(regex, replacement);

fs.writeFileSync(path, code);
