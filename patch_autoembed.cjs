const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace Peachify with autoembed.co
code = code.replace(
  /\`https:\/\/peachify\.pro\/embed\/tv\/\$\{tmdbId \|\| ''\}\/\$\{seasonNum\}\/\$\{epNum\}\`/g,
  "\`https://autoembed.co/tv/tmdb/\${tmdbId || ''}-\${seasonNum}-\${epNum}\`"
);

code = code.replace(
  /\`https:\/\/peachify\.pro\/embed\/movie\/\$\{tmdbId \|\| ''\}\`/g,
  "\`https://autoembed.co/movie/tmdb/\${tmdbId || ''}\`"
);

code = code.replace(
  /\`https:\/\/peachify\.pro\/embed\/tv\/\$\{tmdbId \|\| ''\}\/\$\{fallbackSeason\}\/1\`/g,
  "\`https://autoembed.co/tv/tmdb/\${tmdbId || ''}-\${fallbackSeason}-1\`"
);

code = code.replace(
  /\`https:\/\/peachify\.pro\/embed\/tv\/\$\{tmdbId \|\| ''\}\/\$\{seasonNum\}\/1\`/g,
  "\`https://autoembed.co/tv/tmdb/\${tmdbId || ''}-\${seasonNum}-1\`"
);

// Remove the event listener for Peachify if it exists
// Let's just remove the specific peachify event listener code block if we can find it
const peachifyEffectRegex = /useEffect\(\(\) => \{\n\s*const handlePeachifyMessage = \(event: MessageEvent\) => \{[\s\S]*?window\.removeEventListener\('message', handlePeachifyMessage\);\n\s*\};\n\s*\}, \[\]\);\n/g;
code = code.replace(peachifyEffectRegex, "");

// Remove the auto-resume logic from getCleanedEmbedUrl
const autoResumeRegex = /\s*\/\/ Auto-resume injection for Peachify[\s\S]*?if \(newUrl\.hostname === 'peachify\.pro'\) \{[\s\S]*?\}\n/g;
code = code.replace(autoResumeRegex, "");

// If there are remaining 'peachify' references in comments, we can leave them or replace them
code = code.replace(/\/\/ Use Peachify for TV shows/g, "// Use autoembed for TV shows");
code = code.replace(/\/\/ Use Peachify for Movies/g, "// Use autoembed for Movies");

fs.writeFileSync(path, code);
