const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/pages/Home.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/<MovieCard movie=\{movie\} \/>/g, '<Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>');

fs.writeFileSync(filePath, content);
console.log('Replaced all MovieCard with Suspense');
