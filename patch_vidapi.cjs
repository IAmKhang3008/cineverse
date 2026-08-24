const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace autoembed logic with vaplayer
code = code.replace(
  /\`https:\/\/autoembed\.co\/tv\/tmdb\/\$\{tmdbId \|\| ''\}-\$\{seasonNum\}-\$\{epNum\}\`/g,
  "\`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoplay=1&lang=vi\`"
);

code = code.replace(
  /\`https:\/\/autoembed\.co\/movie\/tmdb\/\$\{tmdbId \|\| ''\}\`/g,
  "\`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1&lang=vi\`"
);

code = code.replace(
  /\`https:\/\/autoembed\.co\/tv\/tmdb\/\$\{tmdbId \|\| ''\}-\$\{fallbackSeason\}-1\`/g,
  "\`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${fallbackSeason}/1?autoplay=1&lang=vi\`"
);

code = code.replace(
  /\`https:\/\/autoembed\.co\/tv\/tmdb\/\$\{tmdbId \|\| ''\}-\$\{seasonNum\}-1\`/g,
  "\`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/1?autoplay=1&lang=vi\`"
);

code = code.replace(/includes\('autoembed'\)/g, "includes('vaplayer')");

code = code.replace(/\/\/ Use autoembed for TV shows/g, "// Use vaplayer for TV shows");
code = code.replace(/\/\/ Use autoembed for Movies/g, "// Use vaplayer for Movies");

// Inject event listener for VidAPI
const eventListener = `
  useEffect(() => {
    const handleVidApiMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PLAYER_EVENT') return;
      
      const { player_info, player_status, player_progress, player_duration } = event.data.data;
      if (player_status === 'playing' || player_status === 'paused') {
        const id = player_info?.tmdb || player_info?.imdb;
        if (id) {
          let key = \`vidapi_progress_\${id}\`;
          if (player_info.mediaType === 'tv' && player_info.season && player_info.episode) {
            key = \`vidapi_progress_\${id}_s\${player_info.season}e\${player_info.episode}\`;
          }
          localStorage.setItem(key, player_progress.toString());
        }
      }
    };

    window.addEventListener('message', handleVidApiMessage);
    return () => {
      window.removeEventListener('message', handleVidApiMessage);
    };
  }, []);
`;

// Insert the event listener before the first useEffect (which is window.scrollTo(0,0))
code = code.replace(
  "  useEffect(() => {\n    window.scrollTo(0, 0);\n",
  eventListener + "\n  useEffect(() => {\n    window.scrollTo(0, 0);\n"
);

// Modify getCleanedEmbedUrl to add auto resume logic
const oldGetCleanedEmbedUrl = `  const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };`;

const newGetCleanedEmbedUrl = `  const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      
      // Auto-resume injection for VidAPI
      if (newUrl.hostname === 'vaplayer.ru') {
        try {
          const tmdbId = movie?.tmdb?.id;
          const isTv = movie?.tmdb?.type === 'tv' || movie?.type === 'series' || movie?.type === 'hoathinh';
          
          if (tmdbId) {
            let key = \`vidapi_progress_\${tmdbId}\`;
            
            if (isTv) {
              const season = movie?.tmdb?.season || 1;
              const epMatch = currentEpisode?.name?.match(/\\d+/);
              const episode = epMatch ? epMatch[0] : '1';
              key = \`vidapi_progress_\${tmdbId}_s\${season}e\${episode}\`;
            }
            
            const savedProgress = localStorage.getItem(key);
            if (savedProgress && parseFloat(savedProgress) > 5) {
              newUrl.searchParams.set('resumeAt', parseFloat(savedProgress).toFixed(0));
            }
          }
        } catch (e) {
          console.error("Error setting resumeAt for VidAPI", e);
        }
      }
      
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };`;

code = code.replace(oldGetCleanedEmbedUrl, newGetCleanedEmbedUrl);

fs.writeFileSync(path, code);
