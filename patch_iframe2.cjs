const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const iframeOld = `            <iframe
              src={getCleanedEmbedUrl(currentEpisode.link_embed) || undefined}
              title={currentEpisode.name || "Video player"}
              className="w-full h-full"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-fullscreen"
              allow="autoplay; fullscreen; picture-in-picture"
              frameBorder="0"
            ></iframe>`;

const iframeNew = `            <iframe
              src={getCleanedEmbedUrl(currentEpisode.link_embed) || undefined}
              title={currentEpisode.name || "Video player"}
              className="w-full h-full"
              allowFullScreen
              sandbox={currentEpisode.link_embed?.includes('embedmaster') ? undefined : "allow-scripts allow-same-origin allow-fullscreen"}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              frameBorder="0"
            ></iframe>`;

code = code.replace(iframeOld, iframeNew);
fs.writeFileSync(path, code);
