const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const target1 = `        // Tên — Luôn ghi đè title đã được dịch sang tiếng Việt từ TMDB (do language=vi)
        if (tmdbDetail.name || tmdbDetail.title) {
          normalized.name = tmdbDetail.title || tmdbDetail.name || normalized.name;
        }`;

const replacement1 = `        // Tên — Luôn ghi đè title đã được dịch sang tiếng Việt từ TMDB (do language=vi)
        const tmdbName = tmdbDetail.title || tmdbDetail.name;
        if (tmdbName) {
          const hasForeignChars = /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\uFAFF\\uac00-\\ud7af\\u1100-\\u11ff\\u3130-\\u318f\\u0e00-\\u0e7f]/.test(tmdbName);
          if (!hasForeignChars) {
            normalized.name = tmdbName;
          }
        }`;

const target2 = `        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        if (tmdbSearch.name || tmdbSearch.title) {
          normalized.name = tmdbSearch.title || tmdbSearch.name || normalized.name;
        }`;

const replacement2 = `        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        const tmdbSearchName = tmdbSearch.title || tmdbSearch.name;
        if (tmdbSearchName) {
          const hasForeignChars = /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\uFAFF\\uac00-\\ud7af\\u1100-\\u11ff\\u3130-\\u318f\\u0e00-\\u0e7f]/.test(tmdbSearchName);
          if (!hasForeignChars) {
            normalized.name = tmdbSearchName;
          }
        }`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync(path, code);
