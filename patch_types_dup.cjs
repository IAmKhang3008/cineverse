const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("  type: string;\n  season?: number;", "  type: string;");

fs.writeFileSync(path, code);
