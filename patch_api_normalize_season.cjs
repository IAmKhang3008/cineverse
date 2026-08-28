const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const oldTmdbBlock1 = `        normalized.tmdb = {
          id:            String(tmdbInfo.id),
          type:          tmdbSearch!.media_type || (primarySource === 'primary' ? normalized.type : 'movie'),
          vote_average:  tmdbDetail.vote_average,
          vote_count:    tmdbDetail.vote_count,
          title:         tmdbDetail.title || tmdbDetail.name,
          original_title: tmdbDetail.original_title || tmdbDetail.original_name,
          genres:        tmdbDetail.genres?.map(g => g.name) || [],
          runtime:       tmdbDetail.runtime,
        };`;

const newTmdbBlock1 = `        normalized.tmdb = {
          id:            String(tmdbInfo.id),
          type:          tmdbSearch!.media_type || (primarySource === 'primary' ? normalized.type : 'movie'),
          season:        tmdbInfo.season,
          vote_average:  tmdbDetail.vote_average,
          vote_count:    tmdbDetail.vote_count,
          title:         tmdbDetail.title || tmdbDetail.name,
          original_title: tmdbDetail.original_title || tmdbDetail.original_name,
          genres:        tmdbDetail.genres?.map(g => g.name) || [],
          runtime:       tmdbDetail.runtime,
        };`;

code = code.replace(oldTmdbBlock1, newTmdbBlock1);

const oldTmdbBlock2 = `        normalized.tmdb = {
          id:           String(tmdbSearch.id),
          type:         tmdbSearch.media_type || normalized.type,
          vote_average: tmdbSearch.vote_average,
          vote_count:   tmdbSearch.vote_count,
        };`;

const newTmdbBlock2 = `        normalized.tmdb = {
          id:           String(tmdbSearch.id),
          type:         tmdbSearch.media_type || normalized.type,
          season:       tmdbSearch.season,
          vote_average: tmdbSearch.vote_average,
          vote_count:   tmdbSearch.vote_count,
        };`;

code = code.replace(oldTmdbBlock2, newTmdbBlock2);

fs.writeFileSync(path, code);
