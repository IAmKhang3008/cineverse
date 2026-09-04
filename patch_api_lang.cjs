const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace language=en-US in API calls
code = code.replace(
  /language=en-US/g,
  'language=vi'
);

// We should also replace include_image_language=en,null with include_image_language=vi,en,null
code = code.replace(
  /include_image_language=en,null/g,
  'include_image_language=vi,en,null'
);

// We need to make sure the name replacement logic takes the Vietnamese title explicitly.
// Find:
//         // Tên — ưu tiên giữ tên tiếng Việt từ phimapi nếu đã có
//         if (!normalized.name && (tmdbDetail.name || tmdbDetail.title)) {
//           normalized.name = tmdbDetail.name || tmdbDetail.title || normalized.name;
//         }
//         if (tmdbDetail.original_title || tmdbDetail.original_name) {
//           normalized.origin_name = tmdbDetail.original_title || tmdbDetail.original_name || normalized.origin_name;
//         }
const oldMergeCode = `        // Tên — ưu tiên giữ tên tiếng Việt từ phimapi nếu đã có
        if (!normalized.name && (tmdbDetail.name || tmdbDetail.title)) {
          normalized.name = tmdbDetail.name || tmdbDetail.title || normalized.name;
        }
        if (tmdbDetail.original_title || tmdbDetail.original_name) {
          normalized.origin_name = tmdbDetail.original_title || tmdbDetail.original_name || normalized.origin_name;
        }`;

const newMergeCode = `        // Tên — Luôn ghi đè title đã được dịch sang tiếng Việt từ TMDB (do language=vi)
        if (tmdbDetail.name || tmdbDetail.title) {
          normalized.name = tmdbDetail.title || tmdbDetail.name || normalized.name;
        }
        // Giữ original title gốc chuẩn xác
        if (tmdbDetail.original_title || tmdbDetail.original_name) {
          normalized.origin_name = tmdbDetail.original_title || tmdbDetail.original_name || normalized.origin_name;
        }`;

code = code.replace(oldMergeCode, newMergeCode);

fs.writeFileSync(path, code);
