const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const normalizePaginationFn = `
function normalizePagination(pagination: any) {
  if (!pagination) return { totalPages: 1, currentPage: 1 };
  let totalPages = pagination.totalPages;
  if (totalPages === undefined && pagination.totalItems !== undefined && pagination.totalItemsPerPage !== undefined) {
    totalPages = Math.ceil(pagination.totalItems / pagination.totalItemsPerPage);
  }
  return {
    ...pagination,
    totalPages: totalPages || 1,
  };
}
`;

code = code.replace(/export const api = {/, normalizePaginationFn + '\nexport const api = {');

// Fix getByCategory
code = code.replace(/pagination: data.data\?.params\?.pagination \|\| data.data\?.pagination \|\| data.pagination/g, 'pagination: normalizePagination(data.data?.params?.pagination || data.data?.pagination || data.pagination)');

// Fix getNewUpdated
code = code.replace(/pagination: data.data\?.params\?.pagination \|\| data.pagination \|\| data.data\?.pagination/g, 'pagination: normalizePagination(data.data?.params?.pagination || data.pagination || data.data?.pagination)');

// Fix search
code = code.replace(/pagination: data.data\?.params\?.pagination \|\| data.pagination \|\| null/g, 'pagination: normalizePagination(data.data?.params?.pagination || data.pagination)');

fs.writeFileSync('src/lib/api.ts', code);
