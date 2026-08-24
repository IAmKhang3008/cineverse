const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add device detection before fetchDetail in the Watch component
code = code.replace(
  "const [loading, setLoading] = useState(true);",
  "const [loading, setLoading] = useState(true);\n  const isMobileDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);"
);

// 2. Replace URL logic inside fetchDetail mapping
const oldMapping = `             let link_embed = '';
             if (isTv) {
               const seasonNum = res.movie?.tmdb?.season || 1; 
               link_embed = \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoplay=1&lang=vi\`; // Use vaplayer for TV shows
             } else {
               link_embed = \`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1&lang=vi\`; // Use vaplayer for Movies
             }`;

const newMapping = `             let link_embed = '';
             if (isTv) {
               const seasonNum = res.movie?.tmdb?.season || 1; 
               link_embed = isMobileDevice 
                 ? \`https://vidfast.vc/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoPlay=true\` 
                 : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`;
             } else {
               link_embed = isMobileDevice 
                 ? \`https://vidfast.vc/movie/\${tmdbId || ''}?autoPlay=true\` 
                 : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`;
             }`;
code = code.replace(oldMapping, newMapping);

const oldFallback = `        } else {
          const fallbackSeason = res.movie?.tmdb?.season || 1;
          let link_embed = isTv
            ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${fallbackSeason}/1?autoplay=1&lang=vi\`
            : \`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1&lang=vi\`;
          multiSubServerData = [{`;

const newFallback = `        } else {
          const fallbackSeason = res.movie?.tmdb?.season || 1;
          let link_embed = isTv
            ? (isMobileDevice ? \`https://vidfast.vc/tv/\${tmdbId || ''}/\${fallbackSeason}/1?autoPlay=true\` : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${fallbackSeason}/1\`)
            : (isMobileDevice ? \`https://vidfast.vc/movie/\${tmdbId || ''}?autoPlay=true\` : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`);
          multiSubServerData = [{`;
code = code.replace(oldFallback, newFallback);

// 3. Replace fallbackUrl logic
const oldFallbackUrl = `    const seasonNum = movie?.tmdb?.season || 1; const fallbackUrl = isTv ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/1?autoplay=1&lang=vi\` : \`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1&lang=vi\`;`;
const newFallbackUrl = `    const seasonNum = movie?.tmdb?.season || 1; 
    const fallbackUrl = isTv 
      ? (isMobileDevice ? \`https://vidfast.vc/tv/\${tmdbId || ''}/\${seasonNum}/1?autoPlay=true\` : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`) 
      : (isMobileDevice ? \`https://vidfast.vc/movie/\${tmdbId || ''}?autoPlay=true\` : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`);`;
code = code.replace(oldFallbackUrl, newFallbackUrl);


// 4. Inject Event Listener right after the first useEffect (which contains getMoviePoster)
// We didn't successfully remove handleVidApiMessage, so we can just add our new hook 
// before `const epDisplay`
const eventListener = `
  useEffect(() => {
    const vidfastOrigins = [
        'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io',
        'https://vidfast.me', 'https://vidfast.net', 'https://vidfast.pm',
        'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz'
    ];
    
    const handlePlayerMessage = (event: MessageEvent) => {
      // Peachify
      if (event.origin === 'https://peachify.pro') {
        if (event.data?.type === 'MEDIA_DATA') {
          localStorage.setItem('peachifyProgress', JSON.stringify(event.data.data));
        }
      }
      
      // VidFast
      if (vidfastOrigins.includes(event.origin)) {
        if (event.data?.type === 'MEDIA_DATA') {
          localStorage.setItem('vidFastProgress', JSON.stringify(event.data.data));
        }
      }
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => {
      window.removeEventListener('message', handlePlayerMessage);
    };
  }, []);
`;
code = code.replace(
  "  const [episodes, setEpisodes] = useState<any[]>([]);",
  eventListener + "\n  const [episodes, setEpisodes] = useState<any[]>([]);"
);

// 5. Replace Auto-Resume in getCleanedEmbedUrl
const oldResume = `      // Auto-resume injection for VidAPI
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
      }`;

const newResume = `      const tmdbId = movie?.tmdb?.id;
      const isTv = movie?.tmdb?.type === 'tv' || movie?.type === 'series' || movie?.type === 'hoathinh';

      if (!tmdbId) return newUrl.toString();

      // Peachify Auto-resume
      if (newUrl.hostname === 'peachify.pro') {
        try {
          const savedProgress = JSON.parse(localStorage.getItem('peachifyProgress') || '{}');
          if (savedProgress[tmdbId]) {
            const mediaData = savedProgress[tmdbId];
            let watched = 0;
            if (isTv) {
              const season = movie?.tmdb?.season || 1;
              const epMatch = currentEpisode?.name?.match(/\\d+/);
              const episode = epMatch ? epMatch[0] : '1';
              const epKey = \`s\${season}e\${episode}\`;
              watched = mediaData.show_progress?.[epKey]?.progress?.watched || 0;
            } else {
              watched = mediaData.progress?.watched || 0;
            }
            if (watched > 5) {
              newUrl.searchParams.set('startAt', Math.floor(watched).toString());
            }
          }
        } catch (e) {
          console.error("Error reading peachify progress", e);
        }
      }
      
      // VidFast Auto-resume
      const vidfastOrigins = ['vidfast.pro', 'vidfast.in', 'vidfast.io', 'vidfast.me', 'vidfast.net', 'vidfast.pm', 'vidfast.xyz', 'vidfast.vc', 'vidfast.bz'];
      if (vidfastOrigins.includes(newUrl.hostname)) {
        try {
          const savedProgress = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
          const key = isTv ? \`t\${tmdbId}\` : \`m\${tmdbId}\`;
          
          if (savedProgress[key]) {
            const mediaData = savedProgress[key];
            let watched = 0;
            if (isTv) {
              const season = movie?.tmdb?.season || 1;
              const epMatch = currentEpisode?.name?.match(/\\d+/);
              const episode = epMatch ? epMatch[0] : '1';
              const epKey = \`s\${season}e\${episode}\`;
              watched = mediaData.show_progress?.[epKey]?.progress?.watched || 0;
            } else {
              watched = mediaData.progress?.watched || 0;
            }
            if (watched > 5) {
              newUrl.searchParams.set('startAt', Math.floor(watched).toString());
            }
          }
        } catch (e) {
          console.error("Error reading vidfast progress", e);
        }
      }`;

code = code.replace(oldResume, newResume);

// Also remove the old vidapi string check if it's there
code = code.replace(/vaplayer/g, "peachify");

fs.writeFileSync(path, code);
