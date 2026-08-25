const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const listenerOld = `      // VidAPI
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

const listenerNew = `      // VidAPI
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
      }
      
      // EmbedMaster
      if (event.data && event.data.source === 'embedmaster_player') {
        if (event.data.event === 'time' && event.data.info) {
          // It doesn't send media details easily, so we just save with generic prefix based on URL or assume no auto-resume for now
          // We can optionally store it if we match with current TMDB id
        }
      }`;

code = code.replace(listenerOld, listenerNew);
fs.writeFileSync(path, code);
