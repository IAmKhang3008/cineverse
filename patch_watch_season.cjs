const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /res\.movie\.tmdb = \{ \.\.\.\(res\.movie\.tmdb \|\| \{\}\), id: tmdbId, type: tmdbRes\.media_type \};/,
  "res.movie.tmdb = { ...(res.movie.tmdb || {}), id: tmdbId, type: tmdbRes.media_type, season: tmdbRes.season || 1 };"
);

code = code.replace(
  /movie\.tmdb = \{ \.\.\.\(movie\.tmdb \|\| \{\}\), id: tmdbId, type: tmdbRes\.media_type \};/,
  "movie.tmdb = { ...(movie.tmdb || {}), id: tmdbId, type: tmdbRes.media_type, season: tmdbRes.season || 1 };"
);

// We should also replace the hardcoded fallbackUrl in triggerVidsrcAuto
code = code.replace(
  /const fallbackUrl = isTv \? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&season=1&episode=1&ds_lang=en,vi&autoplay=1\` : \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/,
  "const seasonNum = movie?.tmdb?.season || 1; const fallbackUrl = isTv ? `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&season=${seasonNum}&episode=1&ds_lang=en,vi&autoplay=1` : `https://vidsrc.tw/embed/movie?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`;"
);

fs.writeFileSync(path, code);
