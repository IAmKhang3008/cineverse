const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetState = `  const [movie, setMovie] = useState<any>(null);`;
const replaceState = `  const [movie, setMovie] = useState<any>(null);
  const [bestPosterUrl, setBestPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!movie) return;
    import('@/utils/imageUtils').then(({ getMoviePoster }) => {
      getMoviePoster(
        movie.tmdb?.poster_path || movie.poster_path,
        movie.name || movie.origin_name,
        movie.poster_url || movie.thumb_url,
        'w780'
      ).then(url => setBestPosterUrl(url));
    });
  }, [movie]);`;

code = code.replace(targetState, replaceState);

code = code.replace(/url\(\$\{getImageUrl\(movie\.poster_url\)\}\)/g, 'url(${bestPosterUrl || getImageUrl(movie.poster_url)})');

fs.writeFileSync(path, code);
