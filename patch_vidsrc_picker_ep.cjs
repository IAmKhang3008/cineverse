const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /link_embed = \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`; \/\/ Use VidSrc native picker for TV shows/g,
  "link_embed = `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&episode=${epNum}&ds_lang=en,vi&autoplay=1`; // Omit season for VidSrc native picker, keep exact episode"
);

fs.writeFileSync(path, code);
