const fs = require('fs');
const path = './src/pages/Detail.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `              const allPartsPromises = sortedParts.map(async (part: any) => {

                if (part.id === tmdbId) return movie;
                try {
                  const searchInDB = await api.search(part.title);
                  if (searchInDB?.items && searchInDB.items.length > 0) return searchInDB.items[0];
                  if (part.original_title && part.original_title !== part.title) {
                    const searchInDBOriginal = await api.search(part.original_title);
                    if (searchInDBOriginal?.items && searchInDBOriginal.items.length > 0) return searchInDBOriginal.items[0];
                  }
                  return {
                    _id: part.id.toString(),
                    name: part.title,
                    origin_name: part.original_title,
                    thumb_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                    slug: '', 
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                  };
                } catch { return null; }
              });
              const resolvedParts = await Promise.all(allPartsPromises);
              if (isMounted) setCollection({ ...collectionData, parts: resolvedParts.filter(Boolean) });
              const uniqueResults: any[] = [];
              resolvedParts.forEach((m: any) => {
                if (m && m.slug && m.slug !== slug && !uniqueResults.some(u => u.slug === m.slug)) {
                  uniqueResults.push(m);
                }
              });
              relatedFromDB = uniqueResults;`;

const replacement = `              const allPartsPromises = sortedParts.map(async (part: any) => {
                const fallbackMovie = {
                    _id: part.id.toString(),
                    name: part.title,
                    origin_name: part.original_title,
                    thumb_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                    slug: '', 
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                };

                if (part.id === tmdbId) return { part, resolved: movie };

                try {
                  const partYear = part.release_date ? parseInt(part.release_date.substring(0, 4)) : null;
                  let matched = null;

                  const searchInDB = await api.search(part.title);
                  if (searchInDB?.items?.length) {
                    matched = searchInDB.items.find((item: any) => item.year === partYear || item.origin_name?.toLowerCase() === part.original_title?.toLowerCase()) || searchInDB.items[0];
                  }

                  if (!matched && part.original_title && part.original_title !== part.title) {
                    const searchInDBOriginal = await api.search(part.original_title);
                    if (searchInDBOriginal?.items?.length) {
                      matched = searchInDBOriginal.items.find((item: any) => item.year === partYear) || searchInDBOriginal.items[0];
                    }
                  }

                  return { part, resolved: matched || fallbackMovie };
                } catch { return { part, resolved: fallbackMovie }; }
              });

              const resolvedPairs = await Promise.all(allPartsPromises);
              
              const finalParts: any[] = [];
              const uniqueResults: any[] = [];
              const seenSlugs = new Set();
              
              resolvedPairs.forEach(({ part, resolved }) => {
                if (!resolved) return;
                
                if (resolved.slug) {
                  if (!seenSlugs.has(resolved.slug)) {
                    seenSlugs.add(resolved.slug);
                    finalParts.push(resolved);
                    if (resolved.slug !== slug) {
                        uniqueResults.push(resolved);
                    }
                  } else {
                    // Duplicated slug! Fallback to TMDB dummy item for this part so it renders correctly
                    finalParts.push({
                        _id: part.id.toString(),
                        name: part.title,
                        origin_name: part.original_title,
                        thumb_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                        poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                        year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                        slug: '', 
                        tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                    });
                  }
                } else {
                  finalParts.push(resolved);
                }
              });

              if (isMounted) setCollection({ ...collectionData, parts: finalParts });
              relatedFromDB = uniqueResults;`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
