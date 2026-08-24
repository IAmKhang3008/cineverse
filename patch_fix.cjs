const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /const getCleanedEmbedUrl = \(url: string\) => \{[\s\S]*?\}\n\s*\};\n/g;

const newFunc = `const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };
`;

code = code.replace(regex, newFunc);
fs.writeFileSync(path, code);
