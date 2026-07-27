const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/const PRIMARY_URL           = 'https:\/\/ophim1\.com';/, "const PRIMARY_URL           = 'https://phimapi.com';");
code = code.replace(/const FALLBACK_URL          = 'https:\/\/phimapi\.com';/, "const FALLBACK_URL          = 'https://ophim1.com';");

fs.writeFileSync('src/lib/api.ts', code);
