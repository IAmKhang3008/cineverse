const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

// Replace parallelFetch implementation with Promise.any for extreme optimization
const newParallelFetch = `
async function parallelFetch(endpoint: string, canFallback = true): Promise<{ res: Response; source: 'primary' | 'fallback' }> {
  if (!canFallback) {
    const res = await fetchWithTimeout(\`\${PRIMARY_URL}\${endpoint}\`, PRIMARY_TIMEOUT);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return { res, source: 'primary' };
  }

  return Promise.any([
    fetchWithTimeout(\`\${PRIMARY_URL}\${endpoint}\`, PRIMARY_TIMEOUT).then(res => {
      if (!res.ok) throw new Error(\`Primary HTTP \${res.status}\`);
      return { res, source: 'primary' as const };
    }),
    fetchWithTimeout(\`\${FALLBACK_URL}\${endpoint}\`, PRIMARY_TIMEOUT).then(res => {
      if (!res.ok) throw new Error(\`Fallback HTTP \${res.status}\`);
      return { res, source: 'fallback' as const };
    })
  ]);
}
`;

code = code.replace(/async function parallelFetch\(endpoint: string, canFallback = true\): Promise<\{ res: Response; source: 'primary' \| 'fallback' \}> \{[\s\S]*?async function apiFetch/m, newParallelFetch + '\nasync function apiFetch');

fs.writeFileSync('src/lib/api.ts', code);
