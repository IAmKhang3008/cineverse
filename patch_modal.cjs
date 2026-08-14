const fs = require('fs');
const path = './src/components/MovieModal.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /import { cleanLangString } from "\.\.\/lib\/utils";/g,
  'import { cleanLangString, isVietnameseMovie } from "../lib/utils";'
);

code = code.replace(
  /cleanLangString\(detail.lang\)/g,
  'cleanLangString(detail.lang, false, isVietnameseMovie(detail))'
);

fs.writeFileSync(path, code);
