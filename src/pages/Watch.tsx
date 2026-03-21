import { useEffect, useState, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { api, getImageUrl } from "@/lib/api";
import { Play, Settings, SkipForward, Volume2, Maximize, AlertCircle, Film, Heart, ArrowLeft } from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml, cn } from "@/lib/utils";
import { motion } from "motion/react";

export default function Watch() {
  const { slug } = useParams<{ slug: string }>();
  const [movie, setMovie] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<any>(null);
  const [currentServer, setCurrentServer] = useState<string>("");
  const [loading, setLoading] = useState(true);
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
        setEpisodes(res.episodes || []);
        if (res.episodes?.[0]?.server_data?.[0]) {
          setCurrentEpisode(res.episodes[0].server_data[0]);
          setCurrentServer(res.episodes[0].server_name);
        }
        
        if (res.movie?.category?.[0]?.slug) {
          const relatedRes = await api.getByGenre(res.movie.category[0].slug, 1);
          setRelatedMovies(relatedRes.items?.filter((m: any) => m.slug !== slug).slice(0, 6) || []);
        }
      } catch (error) {
        console.error("Failed to fetch movie detail", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [slug]);

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
    toggleFavorite(movie);
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
      // Một số API lồng quảng cáo qua tham số ads=, chúng ta lọc bỏ
      newUrl.searchParams.delete('ads');
      newUrl.searchParams.delete('adt');
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
            Quay lại trang chủ
          </Link>
        )}
        
        {/* Player Section - ĐÃ NÂNG CẤP CHẶN QUẢNG CÁO */}
        <div 
          ref={playerRef}
          className={cn(
            "relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-4 transition-all duration-500 video-container",
            cinemaMode ? "z-50" : ""
          )}
        >
          <iframe
            src={getCleanedEmbedUrl(currentEpisode.link_embed)}
            title={currentEpisode.name}
            className="w-full h-full"
            allowFullScreen
            /* CHÌA KHÓA XÓA QUẢNG CÁO: 
               - allow-popups: BỊ LOẠI BỎ để chặn nhảy tab quảng cáo.
               - allow-modals: BỊ LOẠI BỎ để chặn các thông báo đẩy.
            */
            sandbox="allow-scripts allow-same-origin allow-forms"
            allow="autoplay; fullscreen; picture-in-picture"
            frameBorder="0"
          ></iframe>
          
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
                    <span>{movie.lang || 'Vietsub'}</span>
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
                {episodes.map((server: any, serverIdx: number) => (
                  <div key={serverIdx} className="mb-6 last:mb-0">
                    <h4 className="text-[#A0A0A0] text-[10px] md:text-xs font-bold uppercase mb-3 pl-1 tracking-wider">{server.server_name}</h4>
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
                            }}
                            className={`
                              h-[36px] md:h-[40px] rounded-[8px] text-xs md:text-sm font-medium transition-all flex items-center justify-center
                              ${isCurrent 
                                ? 'bg-[#E50914] text-white shadow-[0_4px_10px_rgba(229,9,20,0.3)]' 
                                : watched
                                ? 'bg-[#4A4A4A] text-[#E0E0E0]'
                                : 'bg-[#2A2A2A]  text-[#A0A0A0]  hover:bg-[#333] :bg-gray-200 hover:text-white :text-black'
                              }
                            `}
                          >
                            {ep.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                      <img 
                        src={getImageUrl(m.poster_url || m.thumb_url, 'poster')} 
                        alt={m.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
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
