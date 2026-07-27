const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/export async function fetchTmdbSearch\(title: string, year: string, type: string\)/, 'export async function fetchTmdbSearch(title: string, year: string, type?: string)');
code = code.replace(/export async function fetchTmdbDetail\(type: string, id: string \| number\)/, 'export async function fetchTmdbDetail(id: string | number, type?: string)');
code = code.replace(/type\?: 'movie' \| 'tv';/, 'type?: string;');

fs.writeFileSync('src/lib/api.ts', code);
