const fs = require('fs');
const path = './src/lib/api.ts';
let code = fs.readFileSync(path, 'utf8');

const oldScoring = `        // Exact year match is crucial
        if (itemYear === targetYear) {
            score += 10;
        } else if (itemYear && Math.abs(itemYear - targetYear) === 1) {
            score += 5; // Sometimes TMDB year and PhimAPI year differ by 1
        }
        
        const nameMatch = item.title?.toLowerCase() === cleanTitle.toLowerCase() || item.name?.toLowerCase() === cleanTitle.toLowerCase();
        const originNameMatch = item.original_title?.toLowerCase() === cleanTitle.toLowerCase() || item.original_name?.toLowerCase() === cleanTitle.toLowerCase();
        
        if (nameMatch || originNameMatch) {
            score += 5;
        }`;

const newScoring = `        const nameMatch = item.title?.toLowerCase() === cleanTitle.toLowerCase() || item.name?.toLowerCase() === cleanTitle.toLowerCase();
        const originNameMatch = item.original_title?.toLowerCase() === cleanTitle.toLowerCase() || item.original_name?.toLowerCase() === cleanTitle.toLowerCase();
        
        // Name match is the most important
        if (nameMatch || originNameMatch) {
            score += 20;
        }

        // Exact year match is crucial for separating reboots, but for later seasons of TV shows, the year might be the season's year, not the show's premiere year.
        if (itemYear === targetYear) {
            score += 10;
        } else if (itemYear && Math.abs(itemYear - targetYear) === 1) {
            score += 5; // Sometimes TMDB year and PhimAPI year differ by 1
        } else if (type === 'tv' && itemYear && itemYear < targetYear) {
            // For TV shows, if the show premiered before the target year, it's very likely valid (e.g. Season 2 in 2023, premiered in 2021)
            score += 3;
        }`;

code = code.replace(oldScoring, newScoring);
fs.writeFileSync(path, code);
