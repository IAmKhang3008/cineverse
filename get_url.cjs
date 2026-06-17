const https = require('https');

const urls = [
  'https://i.ibb.co/CKKky2tq/favicon-2.png',
];

function check(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      timeout: 2000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      console.log(url, '=> Status:', res.statusCode, 'Content-Type:', res.headers['content-type']);
      res.destroy();
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

function fetchMainPage() {
  return new Promise((resolve) => {
    https.get('https://ibb.co/DffxFpbN', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      console.log('Main Page Status:', res.statusCode);
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const match = data.match(/https:\/\/i\.ibb\.co\/[^"']+/g);
        console.log('Main page links found:', match);
        resolve(true);
      });
    }).on('error', (err) => {
      console.error('Error fetching main page:', err);
      resolve(false);
    });
  });
}

async function run() {
  console.log('Testing direct URL...');
  for (const url of urls) {
    await check(url);
  }
  console.log('Testing main page...');
  await fetchMainPage();
  process.exit(0);
}

run();












