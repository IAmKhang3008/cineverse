const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const newListMethod = `
  getNewMovies: async (page = 1, filters?: FilterOptions) =>
    fetchWithCache(\`new-movies:\${page}:\${JSON.stringify(filters || {})}\`, async () => {
      const { data, source } = await apiFetch(buildQuery(\`/v1/api/danh-sach\`, { page, ...filters }));
      const items = data.data?.items || data.items || [];
      return { 
        items: items.map((i: any) => normalizeBySource(i, source)), 
        pagination: data.data?.params?.pagination || data.pagination || null 
      };
    }, TTL.NEW_UPDATED),
`;

// Insert it after getNewUpdated
code = code.replace(
  /(getNewUpdated:[\s\S]*?}, TTL\.NEW_UPDATED),/,
  `$1\n${newListMethod}`
);

fs.writeFileSync('src/lib/api.ts', code);
console.log('done2');
