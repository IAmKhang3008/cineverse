const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/getApiStatus: \(\) => \(\{\n    usingFallback:    \n    await tmdbRateLimiter.acquire\(\);/g, 
  "getApiStatus: () => ({\n    usingFallback: false,\n    consecutiveFails: 0,\n  }),\n\n  getTrendingTmdb: async () => {\n    await tmdbRateLimiter.acquire();"
);

fs.writeFileSync('src/lib/api.ts', code);
