import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface CineversePlayerProps {
  episode: any;
  slug: string;
}

export default function CineversePlayer({ episode, slug }: CineversePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [useIframe, setUseIframe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadVideo = async () => {
      setLoading(true);
      setError(false);
      setUseIframe(false);

      try {
        // 1. Try to use link_m3u8 directly if available
        if (episode.link_m3u8) {
          if (mounted) {
            playDirectVideo([{ url: episode.link_m3u8, type: 'hls' }]);
          }
          return;
        }

        // 2. Try to extract from embed link using a CORS proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(episode.link_embed)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
          const content = data.contents;
          const patterns = [
            /file:\s*["']([^"']+\.(mp4|m3u8))["']/,
            /src:\s*["']([^"']+\.(mp4|m3u8))["']/,
            /source\s+src=["']([^"']+)["']/
          ];

          const sources = [];
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              sources.push({
                url: match[1],
                type: match[1].includes('.m3u8') ? 'hls' : 'mp4'
              });
            }
          }

          if (sources.length > 0) {
            if (mounted) {
              playDirectVideo(sources);
            }
            return;
          }
        }

        // 3. Fallback to iframe
        if (mounted) {
          setUseIframe(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading video:', err);
        if (mounted) {
          setUseIframe(true);
          setLoading(false);
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
    };
  }, [episode]);

  const playDirectVideo = (sources: any[]) => {
    setLoading(false);
    
    // We need to wait for the next render cycle for the video element to be available
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;

      const hlsSource = sources.find(s => s.type === 'hls');
      
      if (hlsSource && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsSource.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Auto-play prevented', e));
        });
      } else {
        video.src = sources[0].url;
        video.play().catch(e => console.log('Auto-play prevented', e));
      }
    }, 100);
  };

  useEffect(() => {
    if (useIframe && iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.onload = () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const script = iframeDoc.createElement('script');
            script.textContent = `
              (function() {
                try { window.open = function() { return null; }; } catch(e) {}
                try { window.alert = function() {}; } catch(e) {}
                try { window.prompt = function() { return null; }; } catch(e) {}
                try { window.confirm = function() { return true; }; } catch(e) {}
                
                try {
                  const originalSetInterval = window.setInterval;
                  window.setInterval = function(callback, delay) {
                    if (callback && callback.toString().includes('ad') || callback.toString().includes('quang')) return null;
                    return originalSetInterval(callback, delay);
                  };
                } catch(e) {}
                
                try {
                  setInterval(function() {
                    document.querySelectorAll('*').forEach(el => {
                      const html = el.outerHTML.toLowerCase();
                      if (html.includes('ad') || html.includes('quang') || html.includes('popup') || html.includes('banner')) {
                        if (!el.closest('#video-player') && !el.closest('.video-js') && !el.closest('.vjs-control-bar')) {
                          el.remove();
                        }
                      }
                    });
                  }, 500);
                } catch(e) {}
                
                try {
                  const originalFetch = window.fetch;
                  window.fetch = function(url, options) {
                    const urlStr = url ? url.toString() : '';
                    if (urlStr.includes('doubleclick') || urlStr.includes('googlead') || urlStr.includes('quangcao')) {
                      return new Promise(resolve => resolve(new Response('', { status: 200 })));
                    }
                    return originalFetch(url, options);
                  };
                } catch(e) {}
              })();
            `;
            iframeDoc.body.appendChild(script);
          }
        } catch (e) {
          console.log('Cannot inject to iframe due to CORS');
        }
      };
    }
  }, [useIframe]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (useIframe) {
    return (
      <iframe
        ref={iframeRef}
        src={episode.link_embed}
        title={episode.name}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        frameBorder="0"
      ></iframe>
    );
  }

  return (
    <video
      ref={videoRef}
      className="w-full h-full bg-black"
      controls
      preload="auto"
      playsInline
    />
  );
}
