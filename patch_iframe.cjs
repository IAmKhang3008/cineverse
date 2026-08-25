const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const iframeOld = `                <iframe
                  title={movie?.name || "Video Player"}
                  src={getIframeSrc(currentEpisode.link_embed)}
                  className="w-full h-full border-0 absolute top-0 left-0 bg-[#0d0d12]"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  scrolling="no"
                />`;

const iframeNew = `                <iframe
                  title={movie?.name || "Video Player"}
                  src={getIframeSrc(currentEpisode.link_embed)}
                  className="w-full h-full border-0 absolute top-0 left-0 bg-[#0d0d12]"
                  allowFullScreen
                  sandbox={currentEpisode.link_embed?.includes('embedmaster') ? undefined : "allow-scripts allow-same-origin allow-presentation allow-forms"}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  scrolling="no"
                />`;

code = code.replace(iframeOld, iframeNew);
fs.writeFileSync(path, code);
