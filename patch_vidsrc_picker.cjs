const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex1 = /link_embed = \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&season=\$\{seasonNum\}&episode=\$\{epNum\}&ds_lang=en,vi&autoplay=1\`;/g;
code = code.replace(regex1, "link_embed = `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`; // Use VidSrc native picker for TV shows");

const regex2 = /let link_embed = isTv\n\s*\? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&season=\$\{fallbackSeason\}&episode=1&ds_lang=en,vi&autoplay=1\`\n\s*: \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/g;
code = code.replace(regex2, "let link_embed = isTv\n            ? `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`\n            : `https://vidsrc.tw/embed/movie?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`;");

const regex3 = /const seasonNum = movie\?\.tmdb\?\.season \|\| 1; const fallbackUrl = isTv \? \`https:\/\/vidsrc\.tw\/embed\/tv\?tmdb=\$\{tmdbId \|\| ''\}&season=\$\{seasonNum\}&episode=1&ds_lang=en,vi&autoplay=1\` : \`https:\/\/vidsrc\.tw\/embed\/movie\?tmdb=\$\{tmdbId \|\| ''\}&ds_lang=en,vi&autoplay=1\`;/g;
code = code.replace(regex3, "const fallbackUrl = isTv ? `https://vidsrc.tw/embed/tv?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1` : `https://vidsrc.tw/embed/movie?tmdb=${tmdbId || ''}&ds_lang=en,vi&autoplay=1`;");

fs.writeFileSync(path, code);
