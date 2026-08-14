const fs = require('fs');
const path = './src/lib/utils.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `export function cleanLangString(lang: string | null | undefined, isWatchPage = false): string {`;
const replacement = `export function cleanLangString(lang: string | null | undefined, isWatchPage = false, isVietnamese = false): string {`;

code = code.replace(target, replacement);

const target2 = `  // Always clean up any existing Multi-sub tags if they were cached
  cleaned = cleaned.replace(/🌐 Multi-sub/gi, 'Vietsub');

  if (!isWatchPage) {
    cleaned = cleaned.replace(/vietsub/gi, '🌐 Multi-sub');
  } else {
    // Keep it as Vietsub on Watch page
    cleaned = cleaned.replace(/vietsub/gi, 'Vietsub');
  }`;

const replacement2 = `  // Always clean up any existing Multi-sub tags if they were cached
  cleaned = cleaned.replace(/🌐 Multi-sub/gi, 'Vietsub');

  if (!isWatchPage && !isVietnamese) {
    cleaned = cleaned.replace(/vietsub/gi, '🌐 Multi-sub');
  } else {
    // Keep it as Vietsub on Watch page, or if it's a Vietnamese movie
    cleaned = cleaned.replace(/vietsub/gi, 'Vietsub');
  }`;

code = code.replace(target2, replacement2);
fs.writeFileSync(path, code);
