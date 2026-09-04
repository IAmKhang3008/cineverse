const fs = require('fs');
const path = './src/components/MovieCard.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add state for tmdbTitle and tmdbOriginName
const stateTarget = `  const [posterLoading, setPosterLoading] = useState(!getMoviePosterSync(movie.poster_url || movie.thumb_url));`;
const stateReplacement = `  const [posterLoading, setPosterLoading] = useState(!getMoviePosterSync(movie.poster_url || movie.thumb_url));
  const [tmdbTitle, setTmdbTitle] = useState(movie.name);
  const [tmdbOriginName, setTmdbOriginName] = useState(movie.origin_name);

  // Sync state if movie prop changes
  useEffect(() => {
    setTmdbTitle(movie.name);
    setTmdbOriginName(movie.origin_name);
  }, [movie.name, movie.origin_name]);`;
code = code.replace(stateTarget, stateReplacement);

// 2. Set TMDB title from combinedData
const combinedDataTarget = `          const bestPoster = extractBestPoster(combinedData.images);`;
const combinedDataReplacement = `          if (combinedData && !cancelled) {
            if (combinedData.title || combinedData.name) {
              setTmdbTitle(combinedData.title || combinedData.name);
            }
            if (combinedData.original_title || combinedData.original_name) {
              setTmdbOriginName(combinedData.original_title || combinedData.original_name);
            }
          }
          
          const bestPoster = extractBestPoster(combinedData.images);`;
code = code.replace(combinedDataTarget, combinedDataReplacement);

// 3. Replace movie.name with tmdbTitle in rendering
code = code.replace(/movie\.name \|\| ''/g, "tmdbTitle || movie.name || ''");
code = code.replace(/movie\.origin_name \|\| ''/g, "tmdbOriginName || movie.origin_name || ''");
// Note: this will also replace in alt="tmdbTitle || movie.name || ''" and title="{decodeHtml(tmdbTitle || movie.name || '')}"

fs.writeFileSync(path, code);
