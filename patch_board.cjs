const fs = require('fs');
const path = './src/pages/Detail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /<span className="text-white font-medium">\{movie\.lang \|\| 'N\/A'\}<\/span>/g,
  '<span className="text-white font-medium">{movie.lang ? cleanLangString(movie.lang, false, isVietnameseMovie(movie)) : "N/A"}</span>'
);

fs.writeFileSync(path, code);
