const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `        const extractFastSeason = (title1: string, title2: string) => {
          const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
          const trailingNumberRegex = /\\s+(\\d+)\\s*$/;
          let match = title1?.match(seasonRegex) || title1?.match(trailingNumberRegex) || title2?.match(seasonRegex) || title2?.match(trailingNumberRegex);
          return match ? parseInt(match[1], 10) : null;
        };
        const fastSeason = res.movie ? extractFastSeason(res.movie.origin_name, res.movie.name) : null;

        const isSeries = isTv || epsCount > 1;`;

const replacement1 = `        const fastSeason = res.movie?.season;
        const isSeries = isTv || epsCount > 1;`;

code = code.replace(target1, replacement1);

const target2 = `    const extractFastSeasonFb = (title1: string, title2: string) => {
      const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
      const trailingNumberRegex = /\\s+(\\d+)\\s*$/;
      let match = title1?.match(seasonRegex) || title1?.match(trailingNumberRegex) || title2?.match(seasonRegex) || title2?.match(trailingNumberRegex);
      return match ? parseInt(match[1], 10) : null;
    };
    const fastSeasonFb = movie ? extractFastSeasonFb(movie.origin_name, movie.name) : null;
    const seasonNum = fastSeasonFb || movie?.tmdb?.season || 1;`;

const replacement2 = `    const fastSeasonFb = movie?.season;
    const seasonNum = fastSeasonFb || movie?.tmdb?.season || 1;`;

code = code.replace(target2, replacement2);

fs.writeFileSync(path, code);
