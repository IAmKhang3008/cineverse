const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldCleanUrl = `  const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      // Một số API lồng quảng cáo qua tham số ads=, chúng ta lọc bỏ
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };`;

const newCleanUrl = `  const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      
      // Auto-resume injection for Peachify
      if (newUrl.hostname === 'peachify.pro') {
        try {
          const savedProgress = JSON.parse(localStorage.getItem('peachifyProgress') || '{}');
          const tmdbId = movie?.tmdb?.id;
          const isTv = movie?.tmdb?.type === 'tv' || movie?.type === 'series' || movie?.type === 'hoathinh';
          
          if (tmdbId && savedProgress[tmdbId]) {
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
            
            if (watched > 0) {
              // Usually resume slightly before (e.g. 3 seconds) for context, but Peachify handles exact seconds
              newUrl.searchParams.set('startAt', Math.floor(watched).toString());
            }
          }
        } catch (e) {
          console.error("Error reading peachify progress", e);
        }
      }
      
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };`;

code = code.replace(oldCleanUrl, newCleanUrl);
fs.writeFileSync(path, code);
