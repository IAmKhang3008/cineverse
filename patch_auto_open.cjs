const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const effectOld = `  const isStreamBrokenOrTrailer = Boolean(!loading && movie && currentEpisode && !isMultiSub && (isLinkBroken || isOnlyTrailer));`;
const effectNew = `  const isStreamBrokenOrTrailer = Boolean(!loading && movie && currentEpisode && !isMultiSub && (isLinkBroken || isOnlyTrailer));

  const hasAutoOpenedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!loading && isMultiSub && currentEpisode?.link_embed && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      let urlToOpen = currentEpisode.link_embed;
      if (urlToOpen.includes('vaplayer.ru') || urlToOpen.includes('vidapi.ru')) {
        urlToOpen += (urlToOpen.includes('?') ? '&' : '?') + 'autoplay=1';
      }
      window.open(urlToOpen, '_blank', 'noopener,noreferrer');
    }
  }, [loading, isMultiSub, currentEpisode]);`;

code = code.replace(effectOld, effectNew);
fs.writeFileSync(path, code);
