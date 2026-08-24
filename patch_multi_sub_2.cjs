const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. isMultiSub and vietsubServer logic
const oldLogic1 = "const isMultiSub = currentServer === 'Multi-sub' || currentServer?.toLowerCase().includes('peachify');";
const newLogic1 = "const isMultiSub = currentServer === 'Multi-sub' || currentServer === 'Multi-sub #1' || currentServer === 'Multi-sub #2' || currentServer?.toLowerCase().includes('peachify');";

const oldLogic2 = "const vietsubServer = episodes.find(s => s.server_name !== 'Multi-sub' && !s.server_name?.toLowerCase().includes('peachify')) || episodes[0];";
const newLogic2 = "const vietsubServer = episodes.find(s => !s.server_name?.includes('Multi-sub') && !s.server_name?.toLowerCase().includes('peachify')) || episodes[0];";

code = code.replace(oldLogic1, newLogic1);
code = code.replace(oldLogic2, newLogic2);

// 2. isOnlyTrailer check
const oldTrailerCheck = `    !episodes.some(s => 
      s.server_name !== 'Multi-sub' && 
      !s.server_name?.toLowerCase().includes('peachify') && `;
const newTrailerCheck = `    !episodes.some(s => 
      !s.server_name?.includes('Multi-sub') && 
      !s.server_name?.toLowerCase().includes('peachify') && `;

code = code.replace(oldTrailerCheck, newTrailerCheck);

// 3. triggerMultiSubAuto logic
const oldTrigger = "let multiSubServerObj = episodes.find(s => s.server_name === 'Multi-sub' || s.server_name?.toLowerCase().includes('peachify'));";
const newTrigger = "let multiSubServerObj = episodes.find(s => s.server_name?.includes('Multi-sub') || s.server_name?.toLowerCase().includes('peachify'));";

code = code.replace(oldTrigger, newTrigger);

fs.writeFileSync(path, code);
