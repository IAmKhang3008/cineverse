const fs = require('fs');
const path = './src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `              return {
                ...movie,
                content:          detail.movie?.content            || movie.content,
                vote_average:     detail.movie?.tmdb?.vote_average ?? null,
                highQualityBanner,
                trailer_url:      detail.movie?.trailer_url        || movie.trailer_url || '',
                _id:              detail.movie?._id                || movie._id,
              };`;

const replacement = `              return {
                ...movie,
                name:             detail.movie?.name               || movie.name,
                origin_name:      detail.movie?.origin_name        || movie.origin_name,
                content:          detail.movie?.content            || movie.content,
                vote_average:     detail.movie?.tmdb?.vote_average ?? null,
                highQualityBanner,
                trailer_url:      detail.movie?.trailer_url        || movie.trailer_url || '',
                _id:              detail.movie?._id                || movie._id,
              };`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
