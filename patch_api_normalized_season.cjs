const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `      const normalized = normalizeBySource(primaryData, primarySource);

      // ── STAGE 5: Merge TMDB data vào normalized ──────────────`;

const replacement = `      const normalized = normalizeBySource(primaryData, primarySource);

      // Extract season from pure source titles BEFORE TMDB overwrites them
      const seasonRegex = /(?:phần|mùa|season|ss)\\s*(\\d+)/i;
      const trailingNumberRegex = /\\s+(\\d+)\\s*$/;
      let sMatch = normalized.origin_name?.match(seasonRegex) || normalized.origin_name?.match(trailingNumberRegex) || normalized.name?.match(seasonRegex) || normalized.name?.match(trailingNumberRegex);
      if (sMatch) {
         normalized.season = parseInt(sMatch[1], 10);
      }

      // ── STAGE 5: Merge TMDB data vào normalized ──────────────`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
