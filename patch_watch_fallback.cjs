const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /let link_embed = isTv\n\s*\? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&season=1&episode=1&ds_lang=en,vi&autoplay=1\`\n\s*: \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/,
  "const fallbackSeason = res.movie?.tmdb?.season || 1;\n          let link_embed = isTv\n            ? `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&season=${fallbackSeason}&episode=1&ds_lang=en,vi&autoplay=1`\n            : `https://vidsrc.tw/embed/movie?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`;"
);

fs.writeFileSync(path, code);
