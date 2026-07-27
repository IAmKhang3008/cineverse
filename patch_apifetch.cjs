const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const newApiFetch = `
async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  const canFallback = isEndpointSupportedOnFallback(endpoint);
  
  // Race both APIs to get the absolute fastest response
  const { res, source } = await parallelFetch(endpoint, canFallback);
  const data = await res.json();
  return { data, source };
}
`;

code = code.replace(/async function apiFetch\(endpoint: string\): Promise<\{ data: any; source: 'primary' \| 'fallback' \}> \{[\s\S]*?return \{ data, source \};\n\}/m, newApiFetch.trim());

// Remove apiState completely as it's no longer needed since we race them
code = code.replace(/const apiState = \{[\s\S]*?\}\n/m, '');
code = code.replace(/apiState\.[^;]+;/g, '');

fs.writeFileSync('src/lib/api.ts', code);
