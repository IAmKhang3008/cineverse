const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("const mediaType = (tmdbSearch.media_type === 'tv' || existingTmdb?.type === 'tv') ? 'tv' : 'movie';", "const mediaType = tmdbSearch.media_type === 'tv' ? 'tv' : 'movie';");

fs.writeFileSync(path, code);
