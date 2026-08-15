const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `<img 
                        src={getMoviePosterSync(m.poster_path, m.poster_url || m.thumb_url)} 
                        alt={m.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />`;

const replacement = `<AsyncRelatedPoster movie={m} />`;

code = code.replace(target, replacement);

const extraComponent = `
function AsyncRelatedPoster({ movie }: { movie: any }) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBestPoster = async () => {
      try {
        const { getMoviePoster } = await import('@/utils/imageUtils');
        
        let tmdbCandidate = movie.poster_path || movie.tmdb?.poster_path;
        const isAlreadyTmdbUrl = movie.poster_url && movie.poster_url.includes('image.tmdb.org');
        
        if (tmdbCandidate || isAlreadyTmdbUrl) {
          const resolvedUrl = await getMoviePoster(
            tmdbCandidate,
            movie.name || movie.origin_name,
            movie.poster_url || movie.thumb_url,
            'w185'
          );
          if (resolvedUrl && !cancelled) {
            setPosterUrl(resolvedUrl);
            return;
          }
        }

        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId && (movie.origin_name || movie.name)) {
          const { searchTmdbWithCache } = await import('@/lib/api');
          const searchResult = await searchTmdbWithCache(movie);
          if (searchResult?.id) {
            tmdbId = searchResult.id;
            tmdbType = searchResult.media_type || 'movie';
          }
        }

        if (tmdbId) {
          const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
          const combinedUrl = \`https://api.themoviedb.org/3/\${tmdbType}/\${tmdbId}?api_key=\${apiKey}&language=en-US&append_to_response=images&include_image_language=en,null\`;
          const { fetchWithCache, TTL } = await import('@/lib/cache');
          const { extractBestPoster } = await import('@/lib/api');
          const combinedData = await fetchWithCache(\`tmdb_combined_\${tmdbType}_\${tmdbId}\`, () => fetch(combinedUrl).then(r => r.json()), TTL.TMDB_STATIC);
          const bestPoster = extractBestPoster(combinedData.images);
          if (bestPoster && !cancelled) {
            setPosterUrl(bestPoster);
            return;
          }
          if (combinedData.poster_path && !cancelled) {
            setPosterUrl(\`https://image.tmdb.org/t/p/w185\${combinedData.poster_path}\`);
            return;
          }
        }

        const { api } = await import('@/lib/api');
        const imagesData = await api.getMovieImages(movie.slug).catch(() => null);
        if (imagesData?.images?.length > 0) {
          const { getImageUrl } = await import('@/lib/api');
          const basePosterUrl = imagesData.image_sizes?.poster?.w500 || "https://image.tmdb.org/t/p/w500";
          const posterImg = imagesData.images.find((img: any) => img.aspect_ratio && img.aspect_ratio < 1.0);
          if (posterImg && !cancelled) {
            setPosterUrl(getImageUrl(\`\${basePosterUrl}\${posterImg.file_path}\`, 'poster'));
            return;
          }
        }

        if (!cancelled) {
          const { getImageUrl } = await import('@/lib/api');
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }

      } catch (err) {
        if (!cancelled) {
          const { getImageUrl } = await import('@/lib/api');
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }
      }
    };
    fetchBestPoster();
    return () => { cancelled = true; };
  }, [movie]);

  return (
    <img 
      src={posterUrl || ''} 
      alt={movie.name}
      className={\`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 \${!posterUrl ? 'opacity-0' : 'opacity-100'}\`}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
`;

code = code + '\n' + extraComponent;

fs.writeFileSync(path, code);
