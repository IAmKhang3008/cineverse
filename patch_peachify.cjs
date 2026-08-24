const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace vidsrc embed logic
code = code.replace(
  /link_embed = \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&episode=\$\{epNum\}&ds_lang=en,vi&autoplay=1\`; \/\/ Omit season for VidSrc native picker, keep exact episode/g,
  "link_embed = `https://peachify.pro/embed/tv/${tmdbId || ''}/${seasonNum}/${epNum}`; // Use Peachify for TV shows"
);

code = code.replace(
  /link_embed = \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/g,
  "link_embed = `https://peachify.pro/embed/movie/${tmdbId || ''}`; // Use Peachify for Movies"
);

code = code.replace(
  /let link_embed = isTv\n\s*\? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`\n\s*: \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/g,
  "let link_embed = isTv\n            ? `https://peachify.pro/embed/tv/${tmdbId || ''}/${fallbackSeason}/1`\n            : `https://peachify.pro/embed/movie/${tmdbId || ''}`;"
);

code = code.replace(
  /const fallbackUrl = isTv \? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\` : \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/g,
  "const seasonNum = movie?.tmdb?.season || 1; const fallbackUrl = isTv ? `https://peachify.pro/embed/tv/${tmdbId || ''}/${seasonNum}/1` : `https://peachify.pro/embed/movie/${tmdbId || ''}`;"
);

code = code.replace(/isVidsrcServer/g, "isMultiSubServer");
code = code.replace(/vidsrcServerData/g, "multiSubServerData");
code = code.replace(/isVidsrc/g, "isMultiSub");
code = code.replace(/triggerVidsrcAuto/g, "triggerMultiSubAuto");
code = code.replace(/vidsrcServerObj/g, "multiSubServerObj");
code = code.replace(/tap-1-vidsrc/g, "tap-1-multisub");
code = code.replace(/includes\('vidsrc'\)/g, "includes('peachify')");

fs.writeFileSync(path, code);
