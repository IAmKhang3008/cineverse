const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `        let fetchedEpisodes = res.episodes || [];`;
const replacement = `        // 1. Shallow copy to avoid mutating the cached res.episodes array
        // 2. Filter out any existing Multi-sub/vidsrc to prevent duplicate injections on re-renders/cache hits
        let fetchedEpisodes = [...(res.episodes || [])].filter(s => 
          s.server_name !== 'Multi-sub' && !s.server_name?.toLowerCase().includes('vidsrc')
        );`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
