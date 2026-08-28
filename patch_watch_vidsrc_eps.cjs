const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `            // VidSrc Picker (single button for series)
            multiSub2Data.push({
              name: 'Trình chọn tập (Picker)',
              slug: 'vidsrc-picker',
              filename: 'Picker',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}\`
            });`;
const replacement1 = ``;
code = code.replace(target1, replacement1);

const target2 = `               multiSub3Data.push({
                 ...ep,
                 slug: ep.slug + '-embedmaster',
                 link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });`;
const replacement2 = `               multiSub2Data.push({
                 ...ep,
                 slug: ep.slug + '-vidsrc',
                 link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });

               multiSub3Data.push({
                 ...ep,
                 slug: ep.slug + '-embedmaster',
                 link_embed: \`https://embedmaster.link/tv/\${tmdbId || ''}/\${seasonNum}/\${epNum}\`
               });`;
code = code.replace(target2, replacement2);

const target3 = `            multiSub2Data.push({
              name: 'Trình chọn tập (Picker)',
              slug: 'vidsrc-picker',
              filename: 'Picker',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}\`
            });`;
const replacement3 = `            multiSub2Data.push({
              name: 'Tập 1',
              slug: 'tap-1-vidsrc',
              filename: 'Tập 1',
              link_embed: \`https://vidsrc.tw/embed/tv/\${tmdbId || ''}/\${seasonNum}/1\`
            });`;
code = code.replace(target3, replacement3);

fs.writeFileSync(path, code);
