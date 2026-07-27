const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

// Fix getByGenre, getByCountry, getByYear
code = code.replace(/pagination: data.data\?.pagination/g, 'pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.pagination)');

fs.writeFileSync('src/lib/api.ts', code);
