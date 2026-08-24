const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/includes\('peachify'\)/g, "includes('autoembed')");
code = code.replace(/Peachify/gi, "Autoembed");
code = code.replace(/peachify/gi, "autoembed");

fs.writeFileSync(path, code);
