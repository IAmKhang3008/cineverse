import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://i.ibb.co/6c2m0G5/logo.png';
const dest = path.join(__dirname, 'public', 'logo.png');

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to download: ${res.statusCode}`);
    return;
  }
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Logo downloaded successfully to public/logo.png');
  });
}).on('error', (err) => {
  console.error('Error downloading logo:', err.message);
});
