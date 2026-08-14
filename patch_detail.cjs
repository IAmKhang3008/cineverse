const fs = require('fs');
const path = './src/pages/Detail.tsx';
let code = fs.readFileSync(path, 'utf8');

// Import isVietnameseMovie
code = code.replace(
  /import { decodeHtml, DEFAULT_AVATAR, CAST_PLACEHOLDER, cleanLangString } from "@\/lib\/utils";/g,
  'import { decodeHtml, DEFAULT_AVATAR, CAST_PLACEHOLDER, cleanLangString, isVietnameseMovie } from "@/lib/utils";'
);

// Update getAudioIcon
const oldAudioIcon = `  const getAudioIcon = (lang: string) => {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l.includes('vietsub')) return ''; // Icon is embedded in Multi-sub tag
    if (l.includes('thuyết minh') || l.includes('lồng tiếng')) return '🎙️';
    return '🔤';
  };`;

const newAudioIcon = `  const getAudioIcon = (lang: string) => {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l.includes('multi-sub')) return ''; // Icon is already in the tag
    if (l.includes('vietsub')) return '🇻🇳';
    if (l.includes('thuyết minh') || l.includes('lồng tiếng')) return '🎙️';
    return '🔤';
  };`;
code = code.replace(oldAudioIcon, newAudioIcon);

// Update render
code = code.replace(
  /\{getAudioIcon\(movie.lang\) \? \`\$\{getAudioIcon\(movie.lang\)\} \` : ""\}\{cleanLangString\(movie.lang\)\}/g,
  `{(() => {
                  const displayLang = cleanLangString(movie.lang, false, isVietnameseMovie(movie));
                  const icon = getAudioIcon(displayLang);
                  return <>{icon ? \`\${icon} \` : ""}{displayLang}</>;
                })()}`
);

fs.writeFileSync(path, code);
