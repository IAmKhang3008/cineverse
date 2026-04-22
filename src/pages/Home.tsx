import React, { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { api, getImageUrl } from "@/lib/api";
import { Play, Info, ChevronRight, Heart, X, Flame, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import { motion, AnimatePresence } from "motion/react";
import { HeroBannerSkeleton, MovieCardSkeleton } from "@/components/Skeleton";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { fetchWithCache, TTL } from "@/lib/cache";

const MovieCard = React.lazy(() => import("@/components/MovieCard"));

// ============================================================
// CẤU HÌNH TAB THỜI GIAN
// ============================================================
type TrendingWindow = 'day' | 'week';

interface TrendingTab {
  id:    TrendingWindow;
  label: string;
  icon:  React.ReactNode;
}

const TRENDING_TABS: TrendingTab[] = [
  { id: 'day',  label: 'Tiêu điểm ngày',     icon: <Flame      className="w-3.5 h-3.5" /> },
  { id: 'week', label: 'Bảng xếp hạng tuần', icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

const TMDB_KEY = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

// ============================================================
// HOOK: useTrendingMovies
// Tách logic ra hook riêng để Home.tsx gọn hơn
// ============================================================
function useTrendingMovies() {
  const [activeTab, setActiveTab]       = useState<TrendingWindow>('day');
  const [movies, setMovies]             = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);

  // Cache kết quả đã lookup theo từng tab — tránh gọi lại khi switch tab
  const resultCache = useRef<Partial<Record<TrendingWindow, any[]>>>({});

  const fetchTrending = useCallback(async (tab: TrendingWindow) => {
    // Đã có cache trong session → dùng ngay
    if (resultCache.current[tab]) {
      setMovies(resultCache.current[tab]!);
      return;
    }

    setLoading(true);
    setMovies([]); // reset để hiện skeleton

    try {
      const tmdbWindow = TRENDING_TABS.find(t => t.id === tab)?.tmdbKey || 'day';

      // Bước 1: Lấy danh sách trending từ TMDB — tab chính là time_window
      const tmdbCacheKey = `tmdb_trending_${tab}`;
      const tmdbData = await fetchWithCache(
        tmdbCacheKey,
        () => fetch(`https://api.themoviedb.org/3/trending/movie/${tab}?api_key=${TMDB_KEY}&language=vi-VN`)
              .then(r => r.json()),
        TTL.TMDB_STATIC
      );

      const tmdbList: any[] = tmdbData.results || [];

      // Bước 2: Không lọc thêm — day/week đều lấy toàn bộ danh sách TMDB trả về

      // Bước 3: Dò tìm song song trên phimapi.com (tối đa 10 phim)
      // Dùng Promise.allSettled để không bị fail toàn bộ nếu 1 phim không tìm thấy
      const lookupResults = await Promise.allSettled(
        tmdbList.slice(0, 20).map(async (tmdbMovie: any) => {
          const title = tmdbMovie.title || tmdbMovie.name || '';
          const cacheKey = `phimapi_lookup_${title.toLowerCase().replace(/\s+/g, '_')}`;

          const searchResult = await fetchWithCache(
            cacheKey,
            () => api.search(title, 1),
            TTL.SEARCH
          );

          const found = searchResult.items?.[0];
          if (!found) return null; // không có trên phimapi → loại bỏ

          // Dùng data từ phimapi (slug, poster thật) + ghép thêm vote_average từ TMDB
          return {
            ...found,
            tmdb: {
              ...found.tmdb,
              vote_average: tmdbMovie.vote_average,
            },
          };
        })
      );

      // Bước 4: Lọc null, lấy tối đa 15 phim hợp lệ
      const verified = lookupResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
        .slice(0, 15);

      // Lưu cache session
      resultCache.current[tab] = verified;
      setMovies(verified);
    } catch (err) {
      console.warn('[Trending] Fetch failed:', err);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch khi tab thay đổi
  useEffect(() => {
    fetchTrending(activeTab);
  }, [activeTab, fetchTrending]);

  return { activeTab, setActiveTab, movies, loading };
}

// ============================================================
// COMPONENT CHÍNH
// ============================================================
export default function Home() {
  useDocumentTitle("Cineverse - Vũ trụ điện ảnh của bạn");

  const [newMovies, setNewMovies]   = useState<any[]>([]);
  const [series, setSeries]         = useState<any[]>([]);
  const [hoatHinh, setHoatHinh]     = useState<any[]>([]);
  const [tvShows, setTvShows]       = useState<any[]>([]);
  const [thaiLan, setThaiLan]       = useState<any[]>([]);
  const [hongKong, setHongKong]     = useState<any[]>([]);
  const [auMy, setAuMy]             = useState<any[]>([]);
  const [vietNam, setVietNam]       = useState<any[]>([]);
  const [kinhDi, setKinhDi]         = useState<any[]>([]);
  const [heroMovies, setHeroMovies] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [heroSwiper, setHeroSwiper] = useState<any>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [showTrailer, setShowTrailer]         = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState('');
  const [isCardHolding, setIsCardHolding]     = useState(false);

  // Hook trending thông minh
  const { activeTab, setActiveTab, movies: trendingMovies, loading: trendingLoading } = useTrendingMovies();

  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  const handlePlayTrailer = (trailerUrl: string) => {
    if (!trailerUrl) { showToast("Trailer không khả dụng cho phim này.", "error"); return; }
    let embedUrl = trailerUrl;
    if (trailerUrl.includes('youtube.com/watch?v=')) embedUrl = trailerUrl.replace('watch?v=', 'embed/');
    else if (trailerUrl.includes('youtu.be/')) embedUrl = trailerUrl.replace('youtu.be/', 'youtube.com/embed/');
    embedUrl += embedUrl.includes('?') ? '&autoplay=1&mute=0' : '?autoplay=1&mute=0';
    setCurrentTrailerUrl(embedUrl);
    setShowTrailer(true);
  };

  const handleToggleFavorite = (movie: any) => {
    const success = toggleFavorite(movie);
    if (!success) showToast("Bạn cần đăng nhập để thêm phim vào yêu thích!", "error");
  };

  useEffect(() => {
    let isMounted = true;
    const fallbackRes = { items: [] };

    const fetchEssentialData = async () => {
      try {
        const [newRes, trendingRes, chieuRapRes, hanQuocRes, vietNamRes] = await Promise.all([
          api.getNewUpdated(1).catch(() => fallbackRes),
          api.getByCategory("phim-le", 1).catch(() => fallbackRes),
          api.getByCategory("phim-chieu-rap", 1).catch(() => fallbackRes),
          api.getByCountry("han-quoc", 1).catch(() => fallbackRes),
          api.getByCountry("viet-nam", 1).catch(() => fallbackRes),
        ]);
        if (!isMounted) return;

        setNewMovies(newRes.items || []);
        setVietNam(vietNamRes.items || []);

        const heroList = [
          { ...(newRes.items?.[0]      || {}), badge: "🔥 PHIM MỚI CẬP NHẬT" },
          { ...(trendingRes.items?.[0] || {}), badge: "⭐ PHIM NỔI BẬT" },
          { ...(chieuRapRes.items?.[0] || {}), badge: "🎬 PHIM CHIẾU RẠP" },
          { ...(hanQuocRes.items?.[0]  || {}), badge: "🇰🇷 PHIM HÀN QUỐC" },
          { ...(vietNamRes.items?.[0]  || {}), badge: "🇻🇳 PHIM VIỆT NAM" },
        ].filter(m => m && m.slug);

        const heroDetails = await Promise.all(
          heroList.map(async (movie) => {
            try {
              const detail = await api.getMovieDetail(movie.slug);
              let highQualityBanner = null;
              try {
                const apiKey = TMDB_KEY;
                let tmdbId   = detail.movie?.tmdb?.id;
                let tmdbType = detail.movie?.tmdb?.type || 'movie';
                if (!tmdbId) {
                  const searchUrl  = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
                  const searchData = await fetchWithCache(`tmdb_search_${movie.slug}`, () => fetch(searchUrl).then(r => r.json()), TTL.TMDB_STATIC);
                  if (searchData.results?.length > 0) {
                    tmdbId   = searchData.results[0].id;
                    tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
                  }
                }
                if (tmdbId) {
                  const imagesUrl  = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${apiKey}`;
                  const imagesData = await fetchWithCache(`tmdb_images_${tmdbType}_${tmdbId}`, () => fetch(imagesUrl).then(r => r.json()), TTL.TMDB_STATIC);
                  if (imagesData.backdrops?.length > 0) {
                    const sorted = imagesData.backdrops.sort((a: any, b: any) => b.width - a.width);
                    highQualityBanner = `https://image.tmdb.org/t/p/original${sorted[0].file_path}`;
                  }
                }
              } catch { /* silently fail */ }
              return {
                ...movie,
                content: detail.movie?.content || movie.content,
                highQualityBanner,
                trailer_url: detail.movie?.trailer_url || movie.trailer_url,
                _id: detail.movie?._id || movie._id,
              };
            } catch { return movie; }
          })
        );
        if (isMounted) setHeroMovies(heroDetails);
      } catch (error) {
        if (!isMounted) return;
        showToast("Không thể tải dữ liệu trang chủ.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchSecondaryData = async () => {
      const fallback = { items: [] };
      const [seriesRes, hoatHinhRes, tvShowsRes, thaiLanRes, hongKongRes, auMyRes, kinhDiRes] = await Promise.all([
        api.getByCategory("phim-bo",    1).catch(() => fallback),
        api.getByCategory("hoat-hinh",  1).catch(() => fallback),
        api.getByCategory("tv-shows",   1).catch(() => fallback),
        api.getByCountry("thai-lan",    1).catch(() => fallback),
        api.getByCountry("hong-kong",   1).catch(() => fallback),
        api.getByCountry("au-my",       1).catch(() => fallback),
        api.getByGenre("kinh-di",       1).catch(() => fallback),
      ]);
      if (!isMounted) return;
      setSeries(seriesRes.items   || []);
      setHoatHinh(hoatHinhRes.items || []);
      setTvShows(tvShowsRes.items  || []);
      setThaiLan(thaiLanRes.items  || []);
      setHongKong(hongKongRes.items || []);
      setAuMy(auMyRes.items        || []);
      setKinhDi(kinhDiRes.items    || []);
    };

    fetchEssentialData();
    fetchSecondaryData();
    return () => { isMounted = false; };
  }, [showToast]);

  if (loading) {
    return (
      <div className="-mt-16 md:-mt-20 pb-20">
        <HeroBannerSkeleton />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-12">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-8 w-48 bg-[#2A2A2A] rounded-md animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {[...Array(5)].map((_, j) => <MovieCardSkeleton key={j} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="-mt-16 md:-mt-20 pb-20"
    >
      {/* =============================================
          HERO BANNER
          ============================================= */}
      {heroMovies.length > 0 && (
        <div id="hero-banner" className="hero-banner bg-[#0A0A0A] group/hero">
          <Swiper
            modules={[Navigation, Pagination, Autoplay, EffectFade]}
            effect="fade"
            onSwiper={setHeroSwiper}
            onSlideChange={(swiper) => setActiveHeroIndex(swiper.realIndex)}
            navigation={{ nextEl: '.hero-next', prevEl: '.hero-prev' }}
            allowTouchMove={!isCardHolding}
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            loop={true}
            className="h-full w-full"
          >
            {heroMovies.map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'hero'}-${index}`} className="relative h-full w-full">
                <div className="absolute inset-0">
                  <img
                    src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                    alt={movie.name}
                    className="w-full h-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 h-[80%] pointer-events-none"
                    style={{ background: 'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.98) 15%, rgba(10,10,10,0.85) 35%, rgba(10,10,10,0.4) 70%, transparent 100%)' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-[#0A0A0A] pointer-events-none" />
                </div>
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 lg:px-24 mt-10 md:mt-0">
                    <div className="banner-info max-w-2xl rounded-xl">
                      <span className="inline-block bg-[#E50914] text-white text-[10px] md:text-[12px] font-bold px-2 py-1 md:px-3 md:py-1 rounded-sm tracking-[1px] mb-3 md:mb-4">{movie.badge}</span>
                      <h1 className="movie-title text-2xl sm:text-3xl md:text-5xl lg:text-[48px] font-heading font-bold text-white mb-2 md:mb-4 leading-tight drop-shadow-lg" dangerouslySetInnerHTML={{ __html: movie.name }} />
                      <p className="movie-description text-[14px] text-[#CCCCCC] max-w-[500px] text-justify leading-[21.5px] mb-4 md:mb-6 line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: movie.content?.replace(/<[^>]*>?/gm, '') || movie.origin_name }}
                      />
                      <div className="movie-meta flex flex-wrap items-center gap-2 text-[10px] sm:text-xs md:text-[14px] text-gray-400 mb-6 md:mb-8 font-medium">
                        <span>{movie.year || new Date().getFullYear()}</span>
                        <span>·</span>
                        <span className="movie-genres">{movie.category?.[0]?.name || 'Hành động'}</span>
                        <span>·</span>
                        <span>{movie.time || '120 phút'}</span>
                        <span>·</span>
                        <span className="text-white font-bold border border-white/20 px-1.5 py-0.5 rounded text-[10px] md:text-xs">{movie.quality || 'HD'}</span>
                      </div>
                      <div className="movie-actions flex flex-wrap items-center gap-2 md:gap-3">
                        <Link to={`/watch/${movie.slug}`} className="btn flex items-center justify-center gap-1.5 bg-[#E50914] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] font-bold text-xs md:text-sm transition-all hover:scale-105 shadow-[0_4px_15px_rgba(229,9,20,0.5)]">
                          <Play className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" /> Xem ngay
                        </Link>
                        {movie.trailer_url && (
                          <button onClick={() => handlePlayTrailer(movie.trailer_url)} className="btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20">
                            <Play className="w-3 h-3 md:w-4 md:h-4 text-[#E50914]" fill="currentColor" /> Trailer
                          </button>
                        )}
                        <button onClick={() => handleToggleFavorite(movie)} className={`btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20 ${isFavorite(movie._id || movie.slug) ? 'text-[#E50914]' : 'text-white'}`}>
                          <Heart className={`w-3 h-3 md:w-4 md:h-4 ${isFavorite(movie._id || movie.slug) ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">{isFavorite(movie._id || movie.slug) ? 'Bỏ yêu thích' : 'Yêu thích'}</span>
                        </button>
                        <Link to={`/movie/${movie.slug}`} className="btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20">
                          <Info className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">Chi tiết</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
          <button className="hero-prev absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-[32px] h-[32px] md:w-[48px] md:h-[48px] rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6 rotate-180" />
          </button>
          <button className="hero-next absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-[32px] h-[32px] md:w-[48px] md:h-[48px] rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
          </button>
          <div className="banner-thumbnails absolute bottom-4 md:bottom-8 right-4 md:right-8 z-20 flex gap-2 md:gap-4 justify-end w-full max-w-[calc(100vw-2rem)] md:max-w-[456px] overflow-x-auto no-scrollbar p-2">
            {heroMovies.map((movie, index) => (
              <button key={index} onClick={() => heroSwiper?.slideToLoop(index)}
                className={`thumbnail relative overflow-hidden transition-all duration-300 flex-shrink-0 ${activeHeroIndex === index ? 'border-2 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10' : 'border-2 border-transparent opacity-50 hover:opacity-100'} w-7 h-7 rounded-full md:w-[64px] md:h-[36px] md:rounded-md`}
              >
                <img src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')} alt={movie.name} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-16 md:space-y-24">

        {/* =============================================
            PHIM THỊNH HÀNH — NÂNG CẤP VỚI TIME FILTER
            ============================================= */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
            {/* Tiêu đề */}
            <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3 flex-shrink-0">
              <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block" />
              Phim Thịnh Hành
            </h2>

            {/* Toggle 2 tab — pill container, đối xứng */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 gap-0.5 flex-shrink-0">
              {TRENDING_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center justify-center gap-1.5
                      min-h-[44px] sm:min-h-[36px] px-4 sm:px-5
                      rounded-full text-xs font-bold whitespace-nowrap
                      transition-all duration-250
                      ${isActive
                        ? 'bg-[#F5C518] text-black shadow-[0_0_14px_rgba(245,197,24,0.5)] scale-[1.03]'
                        : 'text-secondary-text hover:text-white hover:bg-white/10 active:scale-95'
                      }
                    `}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-black' : 'text-[#F5C518]'}`}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nội dung: skeleton hoặc swiper */}
          <AnimatePresence mode="wait">
            {trendingLoading ? (
              <motion.div
                key="trending-skeleton"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
              >
                {[...Array(5)].map((_, i) => <MovieCardSkeleton key={i} />)}
              </motion.div>
            ) : trendingMovies.length > 0 ? (
              <motion.div
                key={`trending-${activeTab}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Swiper
                  modules={[Navigation, Autoplay]}
                  spaceBetween={16}
                  slidesPerView={2}
                  navigation
                  allowTouchMove={!isCardHolding}
                  autoplay={{ delay: 4000, disableOnInteraction: false }}
                  breakpoints={{
                    640:  { slidesPerView: 3, spaceBetween: 20 },
                    768:  { slidesPerView: 4, spaceBetween: 24 },
                    1024: { slidesPerView: 5, spaceBetween: 24 },
                  }}
                  className="pb-8 md:pb-12 !overflow-visible"
                >
                  {trendingMovies.map((movie, index) => (
                    <SwiperSlide key={`trending-${activeTab}-${movie.slug || index}`}>
                      <Suspense fallback={<MovieCardSkeleton />}>
                        <MovieCard movie={movie} onHoldChange={setIsCardHolding} />
                      </Suspense>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </motion.div>
            ) : (
              <motion.div
                key="trending-empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-center py-16 text-secondary-text text-sm"
              >
                Không tìm thấy phim thịnh hành trong khoảng thời gian này.
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Phim mới cập nhật */}
        <section>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
              <span className="w-1.5 h-6 md:h-8 bg-[#E50914] rounded-full inline-block" />
              Phim Mới Cập Nhật
            </h2>
            <Link to="/movies" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
            </Link>
          </div>
          <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 5000, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
            {newMovies.slice(1, 16).map((movie, index) => (
              <SwiperSlide key={`new-${movie.slug || index}`}>
                <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim bộ */}
        {series.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block" /> Phim Bộ Nổi Bật
              </h2>
              <Link to="/series" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 6000, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {series.slice(0, 15).map((movie, index) => (<SwiperSlide key={`series-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Hoạt Hình */}
        {hoatHinh.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#10B981] rounded-full inline-block" /> Phim Hoạt Hình</h2>
              <Link to="/genres?genre=hoat-hinh" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 5500, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {hoatHinh.slice(0, 15).map((movie, index) => (<SwiperSlide key={`hoathinh-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* TV Shows */}
        {tvShows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#8B5CF6] rounded-full inline-block" /> Chương trình TV</h2>
              <Link to="/genres?genre=tv-shows" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 6500, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {tvShows.slice(0, 15).map((movie, index) => (<SwiperSlide key={`tv-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Thái Lan */}
        {thaiLan.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#EC4899] rounded-full inline-block" /> Phim Thái Lan</h2>
              <Link to="/genres?country=thai-lan" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 4500, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {thaiLan.slice(0, 15).map((movie, index) => (<SwiperSlide key={`thai-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Hồng Kông */}
        {hongKong.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#F59E0B] rounded-full inline-block" /> Phim Hồng Kông</h2>
              <Link to="/genres?country=hong-kong" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 5000, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {hongKong.slice(0, 15).map((movie, index) => (<SwiperSlide key={`hk-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Âu Mỹ */}
        {auMy.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block" /> Phim Âu Mỹ</h2>
              <Link to="/genres?country=au-my" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 6000, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {auMy.slice(0, 15).map((movie, index) => (<SwiperSlide key={`aumy-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Việt Nam */}
        {vietNam.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#EF4444] rounded-full inline-block" /> Phim Việt Nam</h2>
              <Link to="/genres?country=viet-nam" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 4000, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {vietNam.slice(0, 15).map((movie, index) => (<SwiperSlide key={`vn-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}

        {/* Kinh Dị */}
        {kinhDi.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3"><span className="w-1.5 h-6 md:h-8 bg-[#6B7280] rounded-full inline-block" /> Phim Kinh Dị</h2>
              <Link to="/genres?genre=kinh-di" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" /></Link>
            </div>
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation allowTouchMove={!isCardHolding} autoplay={{ delay: 5500, disableOnInteraction: false }} breakpoints={{ 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 24 }, 1024: { slidesPerView: 5, spaceBetween: 24 } }} className="pb-8 md:pb-12 !overflow-visible">
              {kinhDi.slice(0, 15).map((movie, index) => (<SwiperSlide key={`kinhdi-${movie.slug || index}`}><Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} onHoldChange={setIsCardHolding} /></Suspense></SwiperSlide>))}
            </Swiper>
          </section>
        )}
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowTrailer(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowTrailer(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-[#E50914] text-white rounded-full transition-colors backdrop-blur-md">
                <X className="w-6 h-6" />
              </button>
              <iframe src={currentTrailerUrl} title="Trailer" className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}