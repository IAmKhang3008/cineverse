const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const newUtils = `
export function upgradeImageUrl(url: string) {
  if (!url) return url;
  if (url.includes('image.tmdb.org') && url.includes('/w500')) {
    return url.replace('/w500', '/original');
  }
  if (url.includes('ophim.live') || url.includes('img.ophim')) {
    return url.replace('img.ophim.live', 'img.ophim.cc').replace('img.ophim.cc', 'img.ophim.live');
  }
  return url;
}

export function needsImageUpgrade(url: string) {
  return url.includes('placehold.co') || url.includes('/w500') || !url.includes('image.tmdb.org');
}

export function extractBestPoster(images: any) {
  if (!images?.posters?.length) return null;
  const vi = images.posters.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return \`https://image.tmdb.org/t/p/original\${vi.file_path}\`;
  const en = images.posters.find((i: any) => i.iso_639_1 === 'en');
  if (en) return \`https://image.tmdb.org/t/p/original\${en.file_path}\`;
  return \`https://image.tmdb.org/t/p/original\${images.posters[0].file_path}\`;
}

export function extractBestBackdrop(images: any) {
  if (!images?.backdrops?.length) return null;
  const vi = images.backdrops.find((i: any) => i.iso_639_1 === 'vi');
  if (vi) return \`https://image.tmdb.org/t/p/original\${vi.file_path}\`;
  const en = images.backdrops.find((i: any) => i.iso_639_1 === 'en');
  if (en) return \`https://image.tmdb.org/t/p/original\${en.file_path}\`;
  return \`https://image.tmdb.org/t/p/original\${images.backdrops[0].file_path}\`;
}

export function extractBestTrailer(videos: any) {
  if (!videos?.results?.length) return null;
  const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
  if (trailer) return \`https://www.youtube.com/watch?v=\${trailer.key}\`;
  return null;
}

export async function fetchTmdbSearch(title: string, year: string, type?: string) {
  if (!TMDB_ENABLED) return null;
  try {
    const res = await fetch(\`https://api.themoviedb.org/3/search/multi?api_key=\${TMDB_KEY}&query=\${encodeURIComponent(title)}&language=vi-VN\`);
    const data = await res.json();
    return data.results?.[0] || null;
  } catch { return null; }
}

export async function fetchTmdbDetail(id: string | number, type?: string) {
  if (!TMDB_ENABLED) return null;
  const t = type || 'movie';
  try {
    const res = await fetch(\`https://api.themoviedb.org/3/\${t}/\${id}?api_key=\${TMDB_KEY}&language=vi-VN&append_to_response=images,videos,credits\`);
    return await res.json();
  } catch { return null; }
}
`;

code = code.replace(/export function upgradeImageUrl.*?export async function fetchTmdbDetail.*?\}/s, newUtils.trim());

fs.writeFileSync('src/lib/api.ts', code);
