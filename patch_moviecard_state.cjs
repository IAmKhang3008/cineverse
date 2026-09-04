const fs = require('fs');
const path = './src/components/MovieCard.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(true); // cho skeleton`;

const replacement = `  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(true); // cho skeleton

  const [tmdbTitle, setTmdbTitle] = useState(movie?.name);
  const [tmdbOriginName, setTmdbOriginName] = useState(movie?.origin_name);

  useEffect(() => {
    setTmdbTitle(movie?.name);
    setTmdbOriginName(movie?.origin_name);
  }, [movie?.name, movie?.origin_name]);`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
