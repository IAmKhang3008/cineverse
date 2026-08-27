const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const iframeOld = `              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"`;
const iframeNew = `              allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"`;

code = code.replace(iframeOld, iframeNew);
fs.writeFileSync(path, code);
