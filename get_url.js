const https = require('https');
https.get('https://ibb.co/pv65tCvj', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
}, (res) => {
  console.log('Status code:', res.statusCode);
  if (res.statusCode === 301 || res.statusCode === 302) {
    console.log('Redirecting to:', res.headers.location);
  }
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const match = data.match(/https:\/\/i\.ibb\.co\/[^"']+/g);
    if (match) {
      console.log('FOUND:', match);
    } else {
      console.log('No direct link found. Printing first 500 chars of body:');
      console.log(data.substring(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('HTTPS GET Error:', err);
});
