const fs = require('fs');
let code = fs.readFileSync('src/pages/Detail.tsx', 'utf8');

code = code.replace(
  /const \[peoplesData, imagesData\] = await Promise\.all\(\[\n\s*api\.getMoviePeoples\(movie\.slug\)\.catch\(\(\) => null\),\n\s*api\.getMovieImages\(movie\.slug\)\.catch\(\(\) => null\)\n\s*\]\);/g,
  'const imagesData = await api.getMovieImages(movie.slug).catch(() => null);\\n        const peoplesData: any = null;'
);

fs.writeFileSync('src/pages/Detail.tsx', code);
