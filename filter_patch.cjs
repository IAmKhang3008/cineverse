const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const filterInterface = `
export interface FilterOptions {
  category?: string;
  country?: string;
  year?: string | number;
  sort_field?: string;
  sort_type?: string;
  sort_lang?: string;
  limit?: number;
}

const buildQuery = (base: string, params: Record<string, any>) => {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => \`\${encodeURIComponent(k)}=\${encodeURIComponent(params[k])}\`)
    .join('&');
  
  if (!query) return base;
  return base.includes('?') ? \`\${base}&\${query}\` : \`\${base}?\${query}\`;
};
`;

code = code.replace("export interface NormalizedMovie", filterInterface + "\nexport interface NormalizedMovie");

// Replace getByCategory
code = code.replace(
  /getByCategory:\s*async\s*\(slug:\s*string,\s*page\s*=\s*1\)\s*=>([\s\S]*?)apiFetch\(`\/v1\/api\/danh-sach\/\$\{slug\}\?page=\$\{page\}`\);/,
  `getByCategory: async (slug: string, page = 1, filters?: FilterOptions) =>$1apiFetch(buildQuery(\`/v1/api/danh-sach/\${slug}\`, { page, ...filters }));`
);

// Replace getByGenre
code = code.replace(
  /getByGenre:\s*async\s*\(slug:\s*string,\s*page\s*=\s*1\)\s*=>([\s\S]*?)apiFetch\(`\/v1\/api\/the-loai\/\$\{slug\}\?page=\$\{page\}`\);/,
  `getByGenre: async (slug: string, page = 1, filters?: FilterOptions) =>$1apiFetch(buildQuery(\`/v1/api/the-loai/\${slug}\`, { page, ...filters }));`
);

// Replace getByCountry
code = code.replace(
  /getByCountry:\s*async\s*\(slug:\s*string,\s*page\s*=\s*1\)\s*=>([\s\S]*?)apiFetch\(`\/v1\/api\/quoc-gia\/\$\{slug\}\?page=\$\{page\}`\);/,
  `getByCountry: async (slug: string, page = 1, filters?: FilterOptions) =>$1apiFetch(buildQuery(\`/v1/api/quoc-gia/\${slug}\`, { page, ...filters }));`
);

// Replace getByYear
code = code.replace(
  /getByYear:\s*async\s*\(year:\s*string,\s*page\s*=\s*1\)\s*=>([\s\S]*?)apiFetch\(`\/v1\/api\/nam\/\$\{year\}\?page=\$\{page\}`\);/,
  `getByYear: async (year: string, page = 1, filters?: FilterOptions) =>$1apiFetch(buildQuery(\`/v1/api/nam/\${year}\`, { page, ...filters }));`
);

// Replace search
code = code.replace(
  /search:\s*async\s*\(keyword:\s*string,\s*page\s*=\s*1,\s*limit\s*=\s*64\)\s*=>([\s\S]*?)apiFetch\(`\/v1\/api\/tim-kiem\?keyword=\$\{encodeURIComponent\(keyword\)\}&page=\$\{page\}&limit=\$\{limit\}`\);/,
  `search: async (keyword: string, page = 1, limit = 64, filters?: FilterOptions) =>$1apiFetch(buildQuery(\`/v1/api/tim-kiem\`, { keyword, page, limit, ...filters }));`
);

fs.writeFileSync('src/lib/api.ts', code);
console.log('done');
