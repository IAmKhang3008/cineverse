const fs = require('fs');
const path = './src/components/MovieCard.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `          if (combinedData && !cancelled) {
            if (combinedData.title || combinedData.name) {
              setTmdbTitle(combinedData.title || combinedData.name);
            }
            if (combinedData.original_title || combinedData.original_name) {
              setTmdbOriginName(combinedData.original_title || combinedData.original_name);
            }
          }`;

const replacement = `          if (combinedData && !cancelled) {
            const tmdbName = combinedData.title || combinedData.name;
            if (tmdbName) {
              // Ignore foreign TMDB titles (Chinese, Thai, Korean, Japanese, etc.) and fallback to phimapi
              const hasForeignChars = /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\uFAFF\\uac00-\\ud7af\\u1100-\\u11ff\\u3130-\\u318f\\u0e00-\\u0e7f]/.test(tmdbName);
              if (!hasForeignChars) {
                setTmdbTitle(tmdbName);
              }
            }
            if (combinedData.original_title || combinedData.original_name) {
              setTmdbOriginName(combinedData.original_title || combinedData.original_name);
            }
          }`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
