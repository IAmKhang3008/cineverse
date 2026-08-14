const fs = require('fs');
const path = './src/components/Header.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /import { cn, DEFAULT_USER_AVATAR, cleanLangString } from "@\/lib\/utils";/g,
  'import { cn, DEFAULT_USER_AVATAR, cleanLangString, isVietnameseMovie } from "@/lib/utils";'
);

code = code.replace(
  /cleanLangString\(movie.lang\)/g,
  'cleanLangString(movie.lang, false, isVietnameseMovie(movie))'
);

fs.writeFileSync(path, code);
