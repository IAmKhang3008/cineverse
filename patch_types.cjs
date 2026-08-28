const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("  episode_total: string;\n  type: string;", "  episode_total: string;\n  type: string;\n  season?: number;");
code = code.replace("export type NormalizedMovie = {", "export interface NormalizedMovie {\n  season?: number;");

fs.writeFileSync(path, code);
