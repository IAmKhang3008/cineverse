import https from 'https';
https.get('https://ibb.co/S4XrsxM5', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const match = data.match(/https:\/\/i\.ibb\.co\/[^"']+/g);
    if (match) console.log('FOUND_URL:', match[0]);
  });
});
