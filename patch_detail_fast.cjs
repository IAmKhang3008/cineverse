const fs = require('fs');
const path = './src/pages/Detail.tsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `              const sortedParts = [...collectionData.parts].sort((a: any, b: any) => {
                if (!a.release_date) return 1;
                if (!b.release_date) return -1;
                return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
              });
              const allPartsPromises = sortedParts.map(async (part: any) => {`;

const replacement1 = `              const sortedParts = [...collectionData.parts].sort((a: any, b: any) => {
                if (!a.release_date) return 1;
                if (!b.release_date) return -1;
                return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
              });

              // BLAAAZINGLY FAST: Set TMDB parts immediately for instant render
              const initialParts = sortedParts.map((part: any) => ({
                    _id: part.id.toString(),
                    name: part.title,
                    origin_name: part.original_title,
                    thumb_url: getTmdbPosterUrl(part.backdrop_path || part.poster_path, 'w500'),
                    poster_url: getTmdbPosterUrl(part.poster_path, 'w500'),
                    year: part.release_date ? parseInt(part.release_date.substring(0, 4)) : null,
                    slug: part.id === tmdbId ? movie.slug : '', 
                    tmdb: { type: 'movie', id: part.id, vote_average: part.vote_average }
              }));
              if (isMounted) setCollection({ ...collectionData, parts: initialParts });

              const allPartsPromises = sortedParts.map(async (part: any) => {`;

code = code.replace(target1, replacement1);

fs.writeFileSync(path, code);
