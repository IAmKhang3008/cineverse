import { useEffect, useState, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { api, getImageUrl, searchTmdbWithCache } from "@/lib/api";
import { getMoviePosterSync } from "@/utils/imageUtils";
import { Play, Settings, SkipForward, Volume2, Maximize, AlertCircle, Film, Heart, ArrowLeft, ExternalLink, Tv, Sparkles } from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml, cn, cleanLangString } from "@/lib/utils";
import { motion } from "motion/react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { toMovieTitleCase } from "@/lib/utils";

export default function Watch() {
  const { slug } = useParams<{ slug: string }>();
  const [movie, setMovie] = useState<any>(null);
  const [bestPosterUrl, setBestPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!movie) return;
    import('@/utils/imageUtils').then(({ getMoviePoster }) => {
      getMoviePoster(
        movie.tmdb?.poster_path || movie.poster_path,
        movie.name || movie.origin_name,
        movie.poster_url || movie.thumb_url,
        'w780'
      ).then(url => setBestPosterUrl(url));
    });
  }, [movie]);

  useEffect(() => {
    const vidfastOrigins = [
        'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io',
        'https://vidfast.me', 'https://vidfast.net', 'https://vidfast.pm',
        'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz'
    ];
    
    const handlePlayerMessage = (event: MessageEvent) => {
      // Peachify
      if (event.origin === 'https://peachify.pro') {
        if (event.data?.type === 'MEDIA_DATA') {
          localStorage.setItem('peachifyProgress', JSON.stringify(event.data.data));
        }
      }
      
      // VidFast
      if (vidfastOrigins.includes(event.origin)) {
        if (event.data?.type === 'MEDIA_DATA') {
          localStorage.setItem('vidFastProgress', JSON.stringify(event.data.data));
        }
      }
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => {
      window.removeEventListener('message', handlePlayerMessage);
    };
  }, []);

  const [episodes, setEpisodes] = useState<any[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<any>(null);
  
  const epDisplay = movie?.type === 'series' 
    ? `Tập ${currentEpisode?.name || ''}` 
    : 'Full';
    
  const pageTitle = movie 
    ? `Xem ${toMovieTitleCase(movie.name)} - ${epDisplay} | Cineverse` 
    : "Đang tải... | Cineverse";

  useDocumentTitle(pageTitle);

  const [currentServer, setCurrentServer] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const isMobileDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  
  const location = useLocation();
  const navigate = useNavigate();
  const fromSearch = location.state?.fromSearch;

  const { addToHistory, history } = useHistory();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await api.getMovieDetail(slug);
        setMovie(res.movie);
        
        // 1. Shallow copy to avoid mutating the cached res.episodes array
        // 2. Filter out any existing Multi-sub/vidsrc to prevent duplicate injections on re-renders/cache hits
        let fetchedEpisodes = [...(res.episodes || [])].filter(s => 
          !s.server_name?.includes('Multi-sub') && !s.server_name?.toLowerCase().includes('peachify')
        );
        
        // Inject VidSrc Server if TMDB ID is available or resolved
        let tmdbId = res.movie?.tmdb?.id;
        if (!tmdbId && res.movie) {
          const tmdbRes = await searchTmdbWithCache(res.movie);
          if (tmdbRes?.id) {
            tmdbId = String(tmdbRes.id);
            res.movie.tmdb = { ...(res.movie.tmdb || {}), id: tmdbId, type: tmdbRes.media_type, season: tmdbRes.season || 1 };
          }
        }

        const tmdbType = res.movie?.tmdb?.type;
        const localType = res.movie?.type;
        const epsCount = fetchedEpisodes[0]?.server_data?.length || 1;
        const totalEps = parseInt(res.movie?.episode_total || '1', 10);
        
        let isTv = false;
        if (tmdbType) {
          isTv = tmdbType === 'tv';
        } else {
          isTv = localType === 'series' || localType === 'tvshows' || epsCount > 1 || (localType === 'hoathinh' && totalEps > 1);
        }
        
        
        const isSeries = isTv || epsCount > 1;

        if (isSeries) {
          let multiSub1Data = [];
          let multiSub2Data = [];
          
          if (fetchedEpisodes[0]?.server_data?.length) {
            fetchedEpisodes[0].server_data.forEach((ep) => {
               const epMatch = ep.name.match(/\d+/);
               const epNum = epMatch ? epMatch[0] : '1';
               const seasonNum = res.movie?.tmdb?.season || 1;
               
               multiSub1Data.push({
                 ...ep,
                 link_embed: isMobileDevice 
                   ? `https://vidfast.vc/tv/${tmdbId || ''}/${seasonNum}/${epNum}?autoPlay=true` 
                   : `https://peachify.pro/embed/tv/${tmdbId || ''}/${seasonNum}/${epNum}`
               });
               
               multiSub2Data.push({
                 ...ep,
                 slug: ep.slug + '-vidsrc',
                 link_embed: `https://vidsrc.to/embed/tv/${tmdbId || ''}/${seasonNum}/${epNum}`
               });
            });
          } else {
            // Fallback for TV series with no fetched episodes
            const seasonNum = res.movie?.tmdb?.season || 1;
            multiSub1Data.push({
              name: 'Tập 1',
              slug: 'tap-1',
              filename: 'Tập 1',
              link_embed: isMobileDevice 
                 ? `https://vidfast.vc/tv/${tmdbId || ''}/${seasonNum}/1?autoPlay=true` 
                 : `https://peachify.pro/embed/tv/${tmdbId || ''}/${seasonNum}/1`
            });
            multiSub2Data.push({
              name: 'Tập 1',
              slug: 'tap-1-vidsrc',
              filename: 'Tập 1',
              link_embed: `https://vidsrc.to/embed/tv/${tmdbId || ''}/${seasonNum}/1`
            });
          }

          if (multiSub1Data.length > 0) {
            fetchedEpisodes.push({ server_name: "Multi-sub #1", server_data: multiSub1Data });
            fetchedEpisodes.push({ server_name: "Multi-sub #2", server_data: multiSub2Data });
          }
        } else {
          // Movie (Single episode)
          let multiSubServerData = [];
          
          multiSubServerData.push({
            name: '#1 Full',
            slug: 'full-1',
            filename: 'Full',
            link_embed: isMobileDevice 
              ? `https://vidfast.vc/movie/${tmdbId || ''}?autoPlay=true` 
              : `https://peachify.pro/embed/movie/${tmdbId || ''}`
          });
          
          multiSubServerData.push({
            name: '#2 Full',
            slug: 'full-2',
            filename: 'Full',
            link_embed: `https://vidsrc.to/embed/movie/${tmdbId || ''}`
          });

          fetchedEpisodes.push({ server_name: "Multi-sub", server_data: multiSubServerData });
        }

        setEpisodes(fetchedEpisodes);
        if (fetchedEpisodes?.[0]?.server_data?.[0]) {

          setCurrentEpisode(fetchedEpisodes[0].server_data[0]);
          setCurrentServer(fetchedEpisodes[0].server_name);
        }
        
        if (res.movie?.category?.[0]?.slug) {
          const relatedRes = await api.getByGenre(res.movie.category[0].slug, 1);
          setRelatedMovies(relatedRes.items?.filter((m: any) => m.slug !== slug).slice(0, 6) || []);
        }
      } catch (error) {
        console.warn("Failed to fetch movie detail", error);
        showToast("Không thể tải dữ liệu phim. Vui lòng kiểm tra kết nối mạng.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [slug, showToast]);

  useEffect(() => {
    if (movie && currentEpisode) {
      addToHistory(movie, currentEpisode.name, Math.random() * 100);
    }
  }, [movie, currentEpisode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cinemaMode) {
        setCinemaMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cinemaMode]);

  useEffect(() => {
    if (cinemaMode) {
      document.body.classList.add('cinema-mode');
    } else {
      document.body.classList.remove('cinema-mode');
    }
    return () => {
      document.body.classList.remove('cinema-mode');
    };
  }, [cinemaMode]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Try to detect video end if the iframe sends a message
      // Note: This depends on the specific video player implementation in the iframe
      if (autoPlay && (e.data === 'video_ended' || e.data?.event === 'ended')) {
        handleNextEpisode();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [autoPlay, currentEpisode, currentServer, episodes]);

  const handleNextEpisode = () => {
    if (!currentEpisode || !currentServer || !episodes.length) return;
    
    const server = episodes.find(s => s.server_name === currentServer);
    if (!server) return;
    
    const currentIndex = server.server_data.findIndex((ep: any) => ep.slug === currentEpisode.slug);
    if (currentIndex >= 0 && currentIndex < server.server_data.length - 1) {
      setCurrentEpisode(server.server_data[currentIndex + 1]);
    }
  };

  const formatServerDisplayName = (name: string) => {
    if (!name) return '#Vietsub';
    let clean = name.trim();
    if (/vietsub/i.test(clean)) {
      return '#Vietsub';
    }
    if (!clean.startsWith('#')) {
      clean = `#${clean}`;
    }
    return clean;
  };

  const isMultiSub = currentServer === 'Multi-sub' || currentServer === 'Multi-sub #1' || currentServer === 'Multi-sub #2' || currentServer?.toLowerCase().includes('peachify');
  const vietsubServer = episodes.find(s => !s.server_name?.includes('Multi-sub') && !s.server_name?.toLowerCase().includes('peachify')) || episodes[0];

  const handleSwitchToVietsub = () => {
    if (vietsubServer && vietsubServer.server_data?.[0]) {
      setCurrentServer(vietsubServer.server_name);
      setCurrentEpisode(vietsubServer.server_data[0]);
      showToast(`Đã chuyển sang server ${formatServerDisplayName(vietsubServer.server_name)}`, "info");
    }
  };

  // Kiểm tra nếu link bị hỏng, thiếu link hoặc chỉ có trailer
  const isLinkBroken = !currentEpisode?.link_embed || !currentEpisode.link_embed.includes('http');
  const isOnlyTrailer = Boolean(
    (currentEpisode?.name?.toLowerCase().trim() === 'trailer' || currentEpisode?.slug?.toLowerCase().trim() === 'trailer') &&
    !episodes.some(s => 
      !s.server_name?.includes('Multi-sub') && 
      !s.server_name?.toLowerCase().includes('peachify') && 
      s.server_data?.some((ep: any) => 
        ep.slug?.toLowerCase().trim() !== 'trailer' && 
        ep.name?.toLowerCase().trim() !== 'trailer'
      )
    )
  );

  const isStreamBrokenOrTrailer = Boolean(!loading && movie && currentEpisode && !isMultiSub && (isLinkBroken || isOnlyTrailer));

  const [autoRedirectTimer, setAutoRedirectTimer] = useState<number>(3);
  const hasTriggeredRef = useRef<boolean>(false);

  const triggerMultiSubAuto = async () => {
    let multiSubServerObj = episodes.find(s => s.server_name?.includes('Multi-sub') || s.server_name?.toLowerCase().includes('peachify'));
    let targetEp = multiSubServerObj?.server_data?.[0];
    let tmdbId = movie?.tmdb?.id;

    if (!tmdbId && movie) {
      const tmdbRes = await searchTmdbWithCache(movie);
      if (tmdbRes?.id) {
        tmdbId = String(tmdbRes.id);
        movie.tmdb = { ...(movie.tmdb || {}), id: tmdbId, type: tmdbRes.media_type, season: tmdbRes.season || 1 };
      }
    }

    const tmdbType = movie?.tmdb?.type;
    const localType = movie?.type;
    const epsCount = episodes[0]?.server_data?.length || 1;
    const totalEps = parseInt(movie?.episode_total || '1', 10);
    
    let isTv = false;
    if (tmdbType) {
      isTv = tmdbType === 'tv';
    } else {
      isTv = localType === 'series' || localType === 'tvshows' || epsCount > 1 || (localType === 'hoathinh' && totalEps > 1);
    }
    const seasonNum = movie?.tmdb?.season || 1; 
    const fallbackUrl = isTv 
      ? (isMobileDevice ? `https://vidfast.vc/tv/${tmdbId || ''}/${seasonNum}/1?autoPlay=true` : `https://peachify.pro/embed/tv/${tmdbId || ''}/${seasonNum}/1`) 
      : (isMobileDevice ? `https://vidfast.vc/movie/${tmdbId || ''}?autoPlay=true` : `https://peachify.pro/embed/movie/${tmdbId || ''}`);
    const urlToOpen = targetEp?.link_embed || fallbackUrl;

    if (multiSubServerObj && targetEp) {
      setCurrentServer(multiSubServerObj.server_name);
      setCurrentEpisode(targetEp);
    } else {
      setCurrentServer('Multi-sub');
      setCurrentEpisode({
        name: 'Tập 1 (Multi-sub)',
        slug: 'tap-1-multisub',
        filename: 'Multi-sub',
        link_embed: fallbackUrl,
        link_m3u8: '',
      });
    }

    if (urlToOpen) {
      let opened = false;
      try {
        const win = window.open(urlToOpen, '_blank', 'noopener,noreferrer');
        if (win && !win.closed && typeof win.closed !== 'undefined') {
          opened = true;
        }
      } catch (err) {
        console.warn('window.open failed:', err);
      }

      if (!opened) {
        try {
          const a = document.createElement('a');
          a.href = urlToOpen;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          console.warn('anchor click failed:', err);
        }
      }
    }
    showToast("Đã tự động chuyển sang trình phát Multi-sub", "info");
  };

  useEffect(() => {
    if (isStreamBrokenOrTrailer) {
      setAutoRedirectTimer(3);
      hasTriggeredRef.current = false;
      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setAutoRedirectTimer(0);
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            triggerMultiSubAuto();
          }
        } else {
          setAutoRedirectTimer(count);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isStreamBrokenOrTrailer, currentServer, currentEpisode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!movie || !currentEpisode) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-white">
        <h1 className="text-2xl font-heading">Không tìm thấy tập phim</h1>
      </div>
    );
  }

  const favorite = isFavorite(movie.slug);
  const handleFavoriteClick = () => {
    const success = toggleFavorite(movie);
    if (!success) {
      showToast("Bạn cần đăng nhập để thêm phim vào yêu thích!", "error");
      return;
    }
    if (!favorite) {
      showToast("Đã thêm vào danh sách yêu thích", "success");
    } else {
      showToast("Đã xóa khỏi danh sách yêu thích", "info");
    }
  };

  const isWatched = (epName: string) => {
    const historyItem = history.find(h => h?.slug === movie?.slug);
    return historyItem?.currentEpisode === epName;
  };

  // Hàm "Làm sạch" link Embed (Xử lý chuỗi quảng cáo nếu có)
  const getCleanedEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const newUrl = new URL(url);
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
      
      const tmdbId = movie?.tmdb?.id;
      const isTv = movie?.tmdb?.type === 'tv' || movie?.type === 'series' || movie?.type === 'hoathinh';

      if (!tmdbId) return newUrl.toString();

      // Peachify Auto-resume
      if (newUrl.hostname === 'peachify.pro') {
        try {
          const savedProgress = JSON.parse(localStorage.getItem('peachifyProgress') || '{}');
          if (savedProgress[tmdbId]) {
            const mediaData = savedProgress[tmdbId];
            let watched = 0;
            if (isTv) {
              const season = movie?.tmdb?.season || 1;
              const epMatch = currentEpisode?.name?.match(/\d+/);
              const episode = epMatch ? epMatch[0] : '1';
              const epKey = `s${season}e${episode}`;
              watched = mediaData.show_progress?.[epKey]?.progress?.watched || 0;
            } else {
              watched = mediaData.progress?.watched || 0;
            }
            if (watched > 5) {
              newUrl.searchParams.set('startAt', Math.floor(watched).toString());
            }
          }
        } catch (e) {
          console.error("Error reading peachify progress", e);
        }
      }
      
      // VidFast Auto-resume
      const vidfastOrigins = ['vidfast.pro', 'vidfast.in', 'vidfast.io', 'vidfast.me', 'vidfast.net', 'vidfast.pm', 'vidfast.xyz', 'vidfast.vc', 'vidfast.bz'];
      if (vidfastOrigins.includes(newUrl.hostname)) {
        try {
          const savedProgress = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
          const key = isTv ? `t${tmdbId}` : `m${tmdbId}`;
          
          if (savedProgress[key]) {
            const mediaData = savedProgress[key];
            let watched = 0;
            if (isTv) {
              const season = movie?.tmdb?.season || 1;
              const epMatch = currentEpisode?.name?.match(/\d+/);
              const episode = epMatch ? epMatch[0] : '1';
              const epKey = `s${season}e${episode}`;
              watched = mediaData.show_progress?.[epKey]?.progress?.watched || 0;
            } else {
              watched = mediaData.progress?.watched || 0;
            }
            if (watched > 5) {
              newUrl.searchParams.set('startAt', Math.floor(watched).toString());
            }
          }
        } catch (e) {
          console.error("Error reading vidfast progress", e);
        }
      }
      
      return newUrl.toString();
    } catch (e) {
      return url;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4 }}
      className="pb-20"
    >
      {/* Cinema Mode Overlay */}
      {cinemaMode && (
        <div className="fixed inset-0 bg-black/95 z-[40]"></div>
      )}
      
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 md:py-8 mt-16">
        {fromSearch ? (
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 md:mb-6 transition-colors font-medium cursor-pointer relative z-50 text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            Quay lại
          </button>
        ) : (
          <Link 
            to={`/movie/${slug}`} 
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 md:mb-6 transition-colors font-medium relative z-50 text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            Quay lại
          </Link>
        )}
        
        {/* Player Section */}
        <div 
          ref={playerRef}
          className={cn(
            "relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-4 transition-all duration-500 video-container",
            cinemaMode ? "z-50" : ""
          )}
        >
          {isMultiSub ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-6 text-center z-20 overflow-hidden">
              {/* Subtle blurred poster backdrop */}
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: `url(${bestPosterUrl || getImageUrl(movie.poster_url)})` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center px-4">
                {/* Glowing Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/40 text-[#E50914] text-xs font-semibold tracking-wide mb-5 shadow-[0_0_15px_rgba(229,9,20,0.25)] animate-pulse">
                  <Sparkles className="w-4 h-4 text-[#E50914]" />
                  <span>Nguồn: Multi-sub</span>
                </div>

                {/* Main Heading requested by user */}
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md">
                  Nguồn phụ đang mở ở cửa sổ mới.
                </h3>

                <p className="text-gray-300 text-xs sm:text-sm mb-6 max-w-sm leading-relaxed font-medium">
                  Nếu xảy ra sự cố trong quá trình phát, vui lòng thử lại nguồn chính.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (currentEpisode?.link_embed) {
                        window.open(currentEpisode.link_embed, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="bg-[#E50914] hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Mở lại tab mới</span>
                  </button>

                  {vietsubServer && (
                    <button
                      onClick={handleSwitchToVietsub}
                      className="bg-white/10 hover:bg-white/20 border border-white/15 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                    >
                      <Tv className="w-4 h-4 text-[#E50914]" />
                      <span>Về nguồn chính</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : isStreamBrokenOrTrailer ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-6 text-center z-20 overflow-hidden">
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: `url(${bestPosterUrl || getImageUrl(movie.poster_url)})` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center px-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-wide mb-5 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Tự động chuyển nguồn phát ({autoRedirectTimer}s)</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md text-center">
                  Nguồn phát chính không khả dụng.
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-gray-300 mb-6 text-center">
                  Đang tự động chuyển sang nguồn phụ...
                </p>

                <button
                  onClick={triggerMultiSubAuto}
                  className="bg-[#E50914] hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Chuyển nguồn ngay ({autoRedirectTimer}s)</span>
                </button>
              </div>
            </div>
          ) : currentEpisode?.link_embed ? (
            <iframe
              src={getCleanedEmbedUrl(currentEpisode.link_embed) || undefined}
              title={currentEpisode.name || "Video player"}
              className="w-full h-full"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-fullscreen"
              allow="autoplay; fullscreen; picture-in-picture"
              frameBorder="0"
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121212] p-8 text-center z-20">
              <p className="text-gray-400">Không tìm thấy nguồn phát cho tập này.</p>
            </div>
          )}
          
          {/* Overlay bảo vệ: Ngăn chặn click chuột phải hoặc click nhầm vào banner ẩn */}
          <div className="absolute inset-0 pointer-events-none border-[10px] border-transparent"></div>
        </div>

        {/* Cảnh báo nếu link chết (Ngắt tính năng nếu không sạch) */}
        {!currentEpisode.link_embed.includes('http') && (
          <div className="bg-[#E50914]/20 text-[#E50914] p-4 rounded-xl flex items-center gap-3 mb-6 border border-[#E50914]/30">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">Link phim có dấu hiệu bị hỏng hoặc chứa quảng cáo độc hại. Hệ thống đã tạm ngắt trình phát.</p>
          </div>
        )}

        {/* Player Controls Bar */}
        <div className={cn(
          "flex flex-wrap items-center justify-between bg-[#121212] p-4 rounded-xl border border-white/5 shadow-sm mb-8 gap-4 transition-all duration-500",
          cinemaMode ? "relative z-50" : ""
        )}>
          {/* Nhóm bên trái: Settings & Cinema Mode */}
          <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
            <button className="flex items-center gap-2 text-sm font-medium text-[#A0A0A0] hover:text-white transition-colors whitespace-nowrap bg-[#2A2A2A] px-3 py-1.5 rounded-lg">
              <Settings className="w-4 h-4" /> 
              Chất lượng: {movie?.quality?.toUpperCase() === 'FHD' ? '1080p' : movie?.quality?.toUpperCase() === 'HD' ? '720p' : movie?.quality || 'Tự động'}
            </button>
            
            <button className="flex items-center gap-2 text-sm font-medium text-[#A0A0A0] hover:text-white transition-colors whitespace-nowrap bg-[#2A2A2A] px-3 py-1.5 rounded-lg">
              <Volume2 className="w-4 h-4" /> 
              Audio: Gốc
            </button>
            
            <button 
              onClick={() => setCinemaMode(!cinemaMode)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap px-3 py-1.5 rounded-lg",
                cinemaMode 
                  ? "bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.4)]" 
                  : "text-[#A0A0A0] hover:text-white bg-[#2A2A2A]"
              )}
            >
              <Film className="w-4 h-4" />
              Rạp phim: {cinemaMode ? 'Bật' : 'Tắt'}
            </button>

            {currentEpisode?.link_embed && (
              <button
                onClick={() => {
                  if (currentEpisode?.link_embed) {
                    window.open(currentEpisode.link_embed, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="flex items-center gap-2 text-sm font-medium text-[#A0A0A0] hover:text-white transition-colors whitespace-nowrap bg-[#2A2A2A] px-3 py-1.5 rounded-lg hover:bg-white/10"
                title="Mở trình phát trong tab mới nếu gặp sự cố iframe/sandbox"
              >
                <ExternalLink className="w-4 h-4 text-[#E50914]" />
                Mở trong tab mới
              </button>
            )}
          </div>
          
          {/* Nhóm bên phải: Status & Auto-play */}
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
            <div className="flex items-center gap-2 text-sm font-medium text-[#10B981]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
              </span>
              Đã lưu tiến trình
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-[#A0A0A0]">Tự động chuyển tập</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E50914]"></div>
              </div>
            </label>
          </div>
        </div>

        {/* Content Below Player */}
        <div className="flex flex-col lg:flex-row gap-8 transition-opacity duration-500 two-column-layout">
          
          {/* Left Column (70%) */}
          <div className="w-full lg:w-[70%]">
            {/* Movie Info & Actions */}
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div>
                  <h1 
                    className="text-xl md:text-[24px] font-heading font-bold text-white mb-1 tracking-tight"
                    dangerouslySetInnerHTML={{ __html: movie.name }}
                  />
                  <h2 
                    className="text-base md:text-[18px] text-[#A0A0A0] font-medium mb-2 italic"
                    dangerouslySetInnerHTML={{ __html: movie.origin_name }}
                  />
                  <p className="text-[#A0A0A0] text-xs md:text-sm font-medium flex flex-wrap items-center gap-2">
                    <span>
                      {currentEpisode.name.toLowerCase().includes('full') 
                        ? 'Tập Full' 
                        : `Tập ${currentEpisode.name.replace(/^Tập\s+/i, '')}${movie.episode_total && movie.episode_total !== "1" && movie.episode_total !== "Full" ? `/${movie.episode_total}` : ''}`}
                    </span>
                    <span>•</span>
                    <span className="text-white font-bold">{movie.quality || 'HD'}</span>
                    <span>•</span>
                    <span>{cleanLangString(movie.lang, true) || 'Vietsub'}</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={handleFavoriteClick}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 rounded-lg font-medium transition-colors border w-full md:w-auto ${
                      favorite 
                      ? 'bg-[#E50914]/10 border-[#E50914] text-[#E50914]' 
                      : 'bg-transparent border-gray-600 text-gray-300 hover:border-[#E50914] hover:text-[#E50914]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 md:w-5 md:h-5 ${favorite ? 'fill-current' : ''}`} />
                    {favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  </button>
                </div>
              </div>
            </div>

            {/* Episodes List */}
            <div className="bg-[#121212] rounded-xl p-4 md:p-6 border border-white/5 shadow-sm">
              <h3 className="text-base md:text-[18px] font-heading font-bold text-white tracking-wider mb-4 md:mb-6 pb-3 border-b border-white/10">
                DANH SÁCH TẬP
              </h3>
              
              <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {episodes.map((server: any, serverIdx: number) => {
                  const isMultiSubServer = server.server_name === 'Multi-sub' || server.server_name?.toLowerCase().includes('peachify');
                  return (
                    <div key={serverIdx} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between mb-3 pl-1">
                        <h4 className="text-[#A0A0A0] text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          <span>{formatServerDisplayName(server.server_name)}</span>
                        </h4>
                        {isMultiSubServer && (
                          <span className="text-[8px] sm:text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 px-2 py-0.5 rounded-full font-medium sm:font-semibold whitespace-nowrap" title="Nguồn phụ này không phải lúc nào cũng có sẵn phim">
                            Có thể không có sẵn
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {server.server_data.map((ep: any, idx: number) => {
                          const isCurrent = currentEpisode?.slug === ep.slug && currentServer === server.server_name;
                          const watched = isWatched(ep.name);
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setCurrentEpisode(ep);
                                setCurrentServer(server.server_name);
                                if (isMultiSubServer && ep.link_embed) {
                                  window.open(ep.link_embed, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              className={`
                                h-[36px] md:h-[40px] rounded-[8px] text-xs md:text-sm font-medium transition-all flex items-center justify-center cursor-pointer
                                ${isCurrent 
                                  ? 'bg-[#E50914] text-white shadow-[0_4px_12px_rgba(229,9,20,0.4)] ring-2 ring-[#E50914]/50 font-bold' 
                                  : isMultiSubServer
                                  ? 'bg-[#E50914]/15 text-[#E50914] border border-[#E50914]/30 hover:bg-[#E50914] hover:text-white font-semibold'
                                  : watched
                                  ? 'bg-[#4A4A4A] text-[#E0E0E0]'
                                  : 'bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333] hover:text-white'
                                }
                              `}
                            >
                              {ep.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (30%) */}
          <div className="w-full lg:w-[30%]">
            <div className="bg-[#121212] rounded-xl p-4 md:p-6 border border-white/5 shadow-sm">
              <h3 className="text-sm md:text-[16px] font-heading font-bold text-white tracking-wider mb-4 md:mb-6 pb-3 border-b border-white/10 uppercase">
                Có thể bạn muốn xem
              </h3>
              
              <div className="flex flex-col gap-3 md:gap-4">
                {relatedMovies.map((m, idx) => (
                  <Link 
                    key={idx} 
                    to={`/movie/${m.slug}`}
                    className="flex items-center gap-3 md:gap-4 p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors group"
                  >
                    <div className="w-[50px] h-[75px] md:w-[60px] md:h-[90px] rounded-md overflow-hidden flex-shrink-0 bg-gray-800 border border-white/10">
                      <AsyncRelatedPoster movie={m} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 
                        className="text-white font-medium text-xs md:text-sm line-clamp-2 group-hover:text-[#E50914] transition-colors mb-1"
                        title={decodeHtml(m.name)}
                        dangerouslySetInnerHTML={{ __html: m.name }}
                      />
                      <p className="text-[#A0A0A0] text-[10px] md:text-xs">
                        {m.year} • {decodeHtml(m.episode_current) || 'Full'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </motion.div>
  );
}


function AsyncRelatedPoster({ movie }: { movie: any }) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBestPoster = async () => {
      try {
        const { getMoviePoster } = await import('@/utils/imageUtils');
        
        let tmdbCandidate = movie.poster_path || movie.tmdb?.poster_path;
        const isAlreadyTmdbUrl = movie.poster_url && movie.poster_url.includes('image.tmdb.org');
        
        if (tmdbCandidate || isAlreadyTmdbUrl) {
          const resolvedUrl = await getMoviePoster(
            tmdbCandidate,
            movie.name || movie.origin_name,
            movie.poster_url || movie.thumb_url,
            'w185'
          );
          if (resolvedUrl && !cancelled) {
            setPosterUrl(resolvedUrl);
            return;
          }
        }

        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId && (movie.origin_name || movie.name)) {
          const { searchTmdbWithCache } = await import('@/lib/api');
          const searchResult = await searchTmdbWithCache(movie);
          if (searchResult?.id) {
            tmdbId = searchResult.id;
            tmdbType = searchResult.media_type || 'movie';
          }
        }

        if (tmdbId) {
          const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
          const combinedUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=en-US&append_to_response=images&include_image_language=en,null`;
          const { fetchWithCache, TTL } = await import('@/lib/cache');
          const { extractBestPoster } = await import('@/lib/api');
          const combinedData = await fetchWithCache(`tmdb_combined_${tmdbType}_${tmdbId}`, () => fetch(combinedUrl).then(r => r.json()), TTL.TMDB_STATIC);
          const bestPoster = extractBestPoster(combinedData.images);
          if (bestPoster && !cancelled) {
            setPosterUrl(bestPoster);
            return;
          }
          if (combinedData.poster_path && !cancelled) {
            setPosterUrl(`https://image.tmdb.org/t/p/w185${combinedData.poster_path}`);
            return;
          }
        }

        const { api } = await import('@/lib/api');
        const imagesData = await api.getMovieImages(movie.slug).catch(() => null);
        if (imagesData?.images?.length > 0) {
          const { getImageUrl } = await import('@/lib/api');
          const basePosterUrl = imagesData.image_sizes?.poster?.w500 || "https://image.tmdb.org/t/p/w500";
          const posterImg = imagesData.images.find((img: any) => img.aspect_ratio && img.aspect_ratio < 1.0);
          if (posterImg && !cancelled) {
            setPosterUrl(getImageUrl(`${basePosterUrl}${posterImg.file_path}`, 'poster'));
            return;
          }
        }

        if (!cancelled) {
          const { getImageUrl } = await import('@/lib/api');
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }

      } catch (err) {
        if (!cancelled) {
          const { getImageUrl } = await import('@/lib/api');
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }
      }
    };
    fetchBestPoster();
    return () => { cancelled = true; };
  }, [movie]);

  return (
    <img 
      src={posterUrl || undefined} 
      alt={movie.name}
      className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${!posterUrl ? 'opacity-0' : 'opacity-100'}`}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
