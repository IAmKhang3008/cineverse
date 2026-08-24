const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const eventListener = `
  useEffect(() => {
    const handlePeachifyMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://peachify.pro') return;
      
      if (event.data?.type === 'MEDIA_DATA') {
        const peachifyProgress = event.data.data;
        localStorage.setItem('peachifyProgress', JSON.stringify(peachifyProgress));
      }
      
      if (event.data?.type === 'PLAYER_EVENT') {
        const { event: playerEvent, currentTime, duration } = event.data.data;
        // You can handle player events here if needed
        // console.log(\`Player \${playerEvent} at \${currentTime}s of \${duration}s\`);
      }
    };

    window.addEventListener('message', handlePeachifyMessage);
    return () => {
      window.removeEventListener('message', handlePeachifyMessage);
    };
  }, []);
`;

// Insert it before the first useEffect
code = code.replace(
  "  useEffect(() => {\n    window.scrollTo(0, 0);\n",
  eventListener + "\n  useEffect(() => {\n    window.scrollTo(0, 0);\n"
);

fs.writeFileSync(path, code);
