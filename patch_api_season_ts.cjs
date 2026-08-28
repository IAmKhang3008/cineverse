const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("const resolveSeasonFromTmdb = async (tmdbId, mediaType) => {", "const resolveSeasonFromTmdb = async (tmdbId: number, mediaType: string) => {");

fs.writeFileSync(path, code);
