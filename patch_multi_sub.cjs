const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /let multiSubServerData: any\[\] = \[\];[\s\S]*?if \(fetchedEpisodes\?\.\[0\]\?\.server_data\?\.\[0\]\) \{/m;

const newLogic = `
        const isSeries = isTv || epsCount > 1;

        if (isSeries) {
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
                   ? \`https://vidfast.vc/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}?autoPlay=true\` 
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
                 ? \`https://vidfast.vc/tv/\${tmdbId || ''}/\${seasonNum}/1?autoPlay=true\` 
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
        } else {
          // Movie (Single episode)
          let multiSubServerData = [];
          
          multiSubServerData.push({
            name: '#1 Full',
            slug: 'full-1',
            filename: 'Full',
            link_embed: isMobileDevice 
              ? \`https://vidfast.vc/movie/\${tmdbId || ''}?autoPlay=true\` 
              : \`https://peachify.pro/embed/movie/\${tmdbId || ''}\`
          });
          
          multiSubServerData.push({
            name: '#2 Full',
            slug: 'full-2',
            filename: 'Full',
            link_embed: \`https://vidsrc.to/embed/movie/\${tmdbId || ''}\`
          });

          fetchedEpisodes.push({ server_name: "Multi-sub", server_data: multiSubServerData });
        }

        setEpisodes(fetchedEpisodes);
        if (fetchedEpisodes?.[0]?.server_data?.[0]) {
`;

code = code.replace(regex, newLogic);
fs.writeFileSync(path, code);
