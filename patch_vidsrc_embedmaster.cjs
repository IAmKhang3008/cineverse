const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldSeriesBlock = `        if (isSeries) {
          let multiSub1Data = [];
          let multiSub2Data = [];
          let multiSub3Data = [];
          
          if (fetchedEpisodes[0]?.server_data?.length) {
            fetchedEpisodes[0].server_data.forEach((ep) => {
               const epMatch = ep.name.match(/\\d+/);
               const epNum = epMatch ? epMatch[0] : '1';
               const seasonNum = res.movie?.tmdb?.season || 1;
               
               multiSub1Data.push({
                 ...ep,
                 link_embed: isMobileDevice 
                   ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoplay=1\` 
                   : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });
               
               multiSub2Data.push({
                 ...ep,
                 slug: ep.slug + '-vidsrc',
                 link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });

               multiSub3Data.push({
                 ...ep,
                 slug: ep.slug + '-embedmaster',
                 link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });
            });
          } else {
            // Fallback for TV series with no fetched episodes
            const seasonNum = res.movie?.tmdb?.season || 1;
            multiSub1Data.push({
              name: 'Tập 1',
              slug: 'tap-1',
              filename: 'Tập 1',
              link_embed: isMobileDevice 
                 ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/1?autoplay=1\` 
                 : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
            multiSub2Data.push({
              name: 'Tập 1',
              slug: 'tap-1-vidsrc',
              filename: 'Tập 1',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
            multiSub3Data.push({
              name: 'Tập 1',
              slug: 'tap-1-embedmaster',
              filename: 'Tập 1',
              link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
          }`;

const newSeriesBlock = `        if (isSeries) {
          let multiSub1Data = [];
          let multiSub2Data = [];
          let multiSub3Data = [];
          
          if (fetchedEpisodes[0]?.server_data?.length) {
            fetchedEpisodes[0].server_data.forEach((ep) => {
               const epMatch = ep.name.match(/\\d+/);
               // Parse to integer to remove leading zeros for EmbedMaster
               const epNum = epMatch ? parseInt(epMatch[0], 10).toString() : '1';
               const seasonNum = res.movie?.tmdb?.season || 1;
               
               multiSub1Data.push({
                 ...ep,
                 link_embed: isMobileDevice 
                   ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoplay=1\` 
                   : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });

               multiSub3Data.push({
                 ...ep,
                 slug: ep.slug + '-embedmaster',
                 link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });
            });
            
            // VidSrc Picker (single button for series)
            multiSub2Data.push({
              name: 'Trình chọn tập (Picker)',
              slug: 'vidsrc-picker',
              filename: 'Picker',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}\`
            });
          } else {
            // Fallback for TV series with no fetched episodes
            const seasonNum = res.movie?.tmdb?.season || 1;
            multiSub1Data.push({
              name: 'Tập 1',
              slug: 'tap-1',
              filename: 'Tập 1',
              link_embed: isMobileDevice 
                 ? \`https://vaplayer.ru/embed/tv/\${tmdbId || ''}/\${seasonNum}/1?autoplay=1\` 
                 : \`https://peachify.pro/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
            multiSub2Data.push({
              name: 'Trình chọn tập (Picker)',
              slug: 'vidsrc-picker',
              filename: 'Picker',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}\`
            });
            multiSub3Data.push({
              name: 'Tập 1',
              slug: 'tap-1-embedmaster',
              filename: 'Tập 1',
              link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
          }`;

code = code.replace(oldSeriesBlock, newSeriesBlock);
fs.writeFileSync(path, code);
