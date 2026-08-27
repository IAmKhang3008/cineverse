const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldCheck = "const isMultiSubServer = server.server_name === 'Multi-sub' || server.server_name?.toLowerCase().includes('peachify');";
const newCheck = "const isMultiSubServer = server.server_name?.includes('Multi-sub') || server.server_name?.toLowerCase().includes('peachify');";
code = code.replace(oldCheck, newCheck);

fs.writeFileSync(path, code);
