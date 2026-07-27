const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/const PRIMARY_TIMEOUT       = 12_000;/g, 'const PRIMARY_TIMEOUT       = 8_000;');
code = code.replace(/const PARALLEL_THRESHOLD    = 6_000;/g, 'const PARALLEL_THRESHOLD    = 1_000;');

fs.writeFileSync('src/lib/api.ts', code);
