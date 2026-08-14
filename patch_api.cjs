const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/lang:\s*cleanLangString\(m.lang \|\| 'Vietsub'\),/g, "lang:            cleanLangString(m.lang || 'Vietsub', true),");
code = code.replace(/lang:\s*cleanLangString\(m.lang \|\| m.language \|\| 'Vietsub'\),/g, "lang:            cleanLangString(m.lang || m.language || 'Vietsub', true),");

fs.writeFileSync(path, code);
