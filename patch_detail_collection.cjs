const fs = require('fs');
const path = './src/pages/Detail.tsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `                const fallbackMovie = {
                    _id: part.id.toString(),
                    name: part.title,
                    origin_name: part.original_title,
                    thumb_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                    slug: '', 
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                };`;

const replacement1 = `                const fallbackMovie = {
                    _id: part.id.toString(),
                    name: part.title,
                    origin_name: part.original_title,
                    thumb_url: getTmdbPosterUrl(part.backdrop_path || part.poster_path, 'w500'),
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                    slug: '', 
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                };`;

code = code.replace(target1, replacement1);

const target2 = `                  return { part, resolved: matched || fallbackMovie };
                } catch { return { part, resolved: fallbackMovie }; }`;

const replacement2 = `                  const finalResolved = matched ? {
                    ...matched,
                    _id: part.id.toString(),
                    name: part.title || matched.name,
                    origin_name: part.original_title || matched.origin_name,
                    thumb_url: getTmdbPosterUrl(part.backdrop_path || part.poster_path, 'w500') || matched.thumb_url,
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500') || matched.poster_url,
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : matched.year,
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
                  } : fallbackMovie;
                  return { part, resolved: finalResolved };
                } catch { return { part, resolved: fallbackMovie }; }`;

code = code.replace(target2, replacement2);

fs.writeFileSync(path, code);
