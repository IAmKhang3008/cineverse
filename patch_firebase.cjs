const fs = require('fs');
const path = './src/lib/firebase.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/experimentalForceLongPolling:\s*true/g, 'experimentalAutoDetectLongPolling: true');

fs.writeFileSync(path, code);
