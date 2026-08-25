const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update Series Logic
const seriesOld = `        if (isSeries) {
          let multiSub1Data = [];
          let multiSub2Data = [];
          
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
                 link_embed: \`https://vidsrc.to/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
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
              link_embed: \`https://vidsrc.to/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
          }

          if (multiSub1Data.length > 0) {
            fetchedEpisodes.push({ server_name: "Multi-sub #1", server_data: multiSub1Data });
            fetchedEpisodes.push({ server_name: "Multi-sub #2", server_data: multiSub2Data });
          }
        }`;

const seriesNew = `        if (isSeries) {
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
                 link_embed: \`https://vidsrc.to/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
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
              link_embed: \`https://vidsrc.to/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
            multiSub3Data.push({
              name: 'Tập 1',
              slug: 'tap-1-embedmaster',
              filename: 'Tập 1',
              link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });
          }

          if (multiSub1Data.length > 0) {
            fetchedEpisodes.push({ server_name: "Multi-sub #1", server_data: multiSub1Data });
            fetchedEpisodes.push({ server_name: "Multi-sub #2", server_data: multiSub2Data });
            fetchedEpisodes.push({ server_name: "Multi-sub #3", server_data: multiSub3Data });
          }
        }`;

code = code.replace(seriesOld, seriesNew);

// 2. Update Movie Logic
const movieOld = `        } else {
          // Movie (Single episode)
          let multiSubServerData = [];
          
          multiSubServerData.push({
            name: '#1 Full',
            slug: 'full-1',
            filename: 'Full',
            link_embed: isMobileDevice 
              ? \`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1\` 
              : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`
          });
          
          multiSubServerData.push({
            name: '#2 Full',
            slug: 'full-2',
            filename: 'Full',
            link_embed: \`https://vidsrc.to/embed/movie/\${tmdbId || ''}\`
          });

          fetchedEpisodes.push({ server_name: "Multi-sub", server_data: multiSubServerData });
        }`;

const movieNew = `        } else {
          // Movie (Single episode)
          let multiSubServerData = [];
          
          multiSubServerData.push({
            name: '#1 Full',
            slug: 'full-1',
            filename: 'Full',
            link_embed: isMobileDevice 
              ? \`https://vaplayer.ru/embed/movie/\${tmdbId || ''}?autoplay=1\` 
              : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`
          });
          
          multiSubServerData.push({
            name: '#2 Full',
            slug: 'full-2',
            filename: 'Full',
            link_embed: \`https://vidsrc.to/embed/movie/\${tmdbId || ''}\`
          });
          
          multiSubServerData.push({
            name: '#3 Full',
            slug: 'full-3',
            filename: 'Full',
            link_embed: \`https://embedmaster.link/movie/\${tmdbId || ''}\`
          });

          fetchedEpisodes.push({ server_name: "Multi-sub", server_data: multiSubServerData });
        }`;

code = code.replace(movieOld, movieNew);

// 3. Update isMultiSub
const multiSubCheckOld = "const isMultiSub = currentServer === 'Multi-sub' || currentServer === 'Multi-sub #1' || currentServer === 'Multi-sub #2' || currentServer?.toLowerCase().includes('peachify');";
const multiSubCheckNew = "const isMultiSub = currentServer?.includes('Multi-sub') || currentServer?.toLowerCase().includes('peachify');";
code = code.replace(multiSubCheckOld, multiSubCheckNew);

fs.writeFileSync(path, code);
