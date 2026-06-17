const https = require('https');

const urls = [
  'https://i.ibb.co/pv65tCvj/favicon.png',
  'https://i.ibb.co/pv65tCvj/logo.png',
  'https://i.ibb.co/pv65tCvj/image.png',
  'https://i.ibb.co/pv65tCvj/icon.png',
  'https://i.ibb.co/pv65tCvj/favicon.ico',
];

function check(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      timeout: 2000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      console.log(url, '=> Status:', res.statusCode, 'Content-Type:', res.headers['content-type']);
      res.destroy(); // stop the request to avoid timeouts
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(url, '=> Error:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function run() {
  console.log('Testing direct URLs...');
  for (const url of urls) {
    await check(url);
  }
  console.log('Done.');
  process.exit(0);
}

run();











