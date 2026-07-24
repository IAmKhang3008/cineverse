const fs = require('fs');
let code = fs.readFileSync('src/pages/Search.tsx', 'utf8');

code = code.replace(
  /const res = await api\.search\(query, page, 64, filters\);/,
  `const res = query 
        ? await api.search(query, page, 64, filters) 
        : await api.getNewMovies(page, filters);`
);

fs.writeFileSync('src/pages/Search.tsx', code);
console.log('patched search.tsx');
