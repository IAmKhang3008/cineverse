const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const oldFallbackMerge = `      } else if (tmdbSearch) {
        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        if (!normalized.year && tmdbSearch.release_date) {`;

const newFallbackMerge = `      } else if (tmdbSearch) {
        // Có search result nhưng detail fetch fail — dùng search data tối thiểu
        if (tmdbSearch.name || tmdbSearch.title) {
          normalized.name = tmdbSearch.title || tmdbSearch.name || normalized.name;
        }
        if (tmdbSearch.original_title || tmdbSearch.original_name) {
          normalized.origin_name = tmdbSearch.original_title || tmdbSearch.original_name || normalized.origin_name;
        }
        if (!normalized.year && tmdbSearch.release_date) {`;

code = code.replace(oldFallbackMerge, newFallbackMerge);
fs.writeFileSync(path, code);
