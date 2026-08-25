const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update URLs
code = code.replace(/https:\/\/vidfast\.vc\/tv\/\$\{tmdbId \|\| ''\}\/\$\{seasonNum\}\/\$\{epNum\}\?autoPlay=true/g, 'https://vaplayer.ru/embed/tv/${tmdbId || \'\'}/${seasonNum}/${epNum}?autoplay=1');
code = code.replace(/https:\/\/vidfast\.vc\/tv\/\$\{tmdbId \|\| ''\}\/\$\{seasonNum\}\/1\?autoPlay=true/g, 'https://vaplayer.ru/embed/tv/${tmdbId || \'\'}/${seasonNum}/1?autoplay=1');
code = code.replace(/https:\/\/vidfast\.vc\/movie\/\$\{tmdbId \|\| ''\}\?autoPlay=true/g, 'https://vaplayer.ru/embed/movie/${tmdbId || \'\'}?autoplay=1');

// 2. Update Message Listener
const oldListener = `      // VidFast
      if (vidfastOrigins.includes(event.origin)) {
        if (event.data?.type === 'MEDIA_DATA') {
          localStorage.setItem('vidFastProgress', JSON.stringify(event.data.data));
        }
      }`;
const newListener = `      // VidAPI
      if (event.origin === 'https://vaplayer.ru' || event.origin === 'https://vidapi.ru') {
        if (event.data?.type === 'PLAYER_EVENT') {
          const { player_info, player_status, player_progress } = event.data.data;
          if (player_status === 'playing') {
            const id = player_info.imdb || player_info.tmdb;
            if (id) {
               const key = player_info.mediaType === 'tv' 
                 ? \`vidapi_progress_\${id}_\${player_info.season}_\${player_info.episode}\`
                 : \`vidapi_progress_\${id}\`;
               localStorage.setItem(key, player_progress.toString());
            }
          }
        }
      }`;
code = code.replace(oldListener, newListener);

// Also remove const vidfastOrigins = [ ... ];
const vidfastOriginsArrayRegex = /const vidfastOrigins = \[\s*'https:\/\/vidfast\.pro'[\s\S]*?'https:\/\/vidfast\.bz'\s*\];\s*/;
code = code.replace(vidfastOriginsArrayRegex, '');

// 3. Update Auto-Resume Logic
const oldAutoResume = `      // VidFast Auto-resume
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

const newAutoResume = `      // VidAPI Auto-resume
      if (newUrl.hostname === 'vaplayer.ru' || newUrl.hostname === 'vidapi.ru') {
        try {
          const idMatch = newUrl.pathname.match(/\\/embed\\/(?:movie|tv)\\/([^/]+)/);
          if (idMatch && idMatch[1]) {
             const id = idMatch[1];
             let key = \`vidapi_progress_\${id}\`;
             if (isTv) {
               const season = movie?.tmdb?.season || 1;
               const epMatch = currentEpisode?.name?.match(/\\d+/);
               const episode = epMatch ? epMatch[0] : '1';
               key = \`vidapi_progress_\${id}_\${season}_\${episode}\`;
             }
             const savedProgress = localStorage.getItem(key);
             if (savedProgress && parseFloat(savedProgress) > 5) {
               newUrl.searchParams.set('resumeAt', Math.floor(parseFloat(savedProgress)).toString());
             }
          }
        } catch (e) {
          console.error("Error reading vidapi progress", e);
        }
      }`;

code = code.replace(oldAutoResume, newAutoResume);

fs.writeFileSync(path, code);
