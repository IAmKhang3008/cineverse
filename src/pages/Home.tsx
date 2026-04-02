import React, { useEffect, useState, Suspense } from "react";
import { api, getImageUrl } from "@/lib/api";
import { Play, Info, ChevronRight, Heart, X } from "lucide-react";
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

const MovieCard = React.lazy(() => import("@/components/MovieCard"));

export default function Home() {
  useDocumentTitle("Cineverse - Vũ trụ điện ảnh của bạn");
  
  const [newMovies, setNewMovies] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [hoatHinh, setHoatHinh] = useState<any[]>([]);
  const [tvShows, setTvShows] = useState<any[]>([]);
  const [thaiLan, setThaiLan] = useState<any[]>([]);
  const [hongKong, setHongKong] = useState<any[]>([]);
  const [auMy, setAuMy] = useState<any[]>([]);
  const [vietNam, setVietNam] = useState<any[]>([]);
  const [kinhDi, setKinhDi] = useState<any[]>([]);
  const [heroMovies, setHeroMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroSwiper, setHeroSwiper] = useState<any>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState("");
  
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  const handlePlayTrailer = (trailerUrl: string) => {
    if (!trailerUrl) {
      showToast("Trailer không khả dụng cho phim này.", "error");
      return;
    }
    
    let embedUrl = trailerUrl;
    if (trailerUrl.includes('youtube.com/watch?v=')) {
      embedUrl = trailerUrl.replace('watch?v=', 'embed/');
    } else if (trailerUrl.includes('youtu.be/')) {
      embedUrl = trailerUrl.replace('youtu.be/', 'youtube.com/embed/');
    }
    
    // Xử lý tham số URL
    if (embedUrl.includes('?')) {
      embedUrl += '&autoplay=1&mute=0';
    } else {
      embedUrl += '?autoplay=1&mute=0';
    }
    
    setCurrentTrailerUrl(embedUrl);
    setShowTrailer(true);
  };

  const handleToggleFavorite = (movie: any) => {
    toggleFavorite(movie);
  };

  useEffect(() => {
    const fetchEssentialData = async () => {
      try {
        const [newRes, trendingRes, chieuRapRes, hanQuocRes, vietNamRes] = await Promise.all([
          api.getNewUpdated(1),
          api.getByCategory("phim-le", 1),
          api.getByCategory("phim-chieu-rap", 1),
          api.getByCountry("han-quoc", 1),
          api.getByCountry("viet-nam", 1),
        ]);
        
        setNewMovies(newRes.items || []);
        setTrending(trendingRes.items || []);
        setVietNam(vietNamRes.items || []);

        const heroList = [
          { ...(newRes.items?.[0] || {}), badge: "🔥 PHIM MỚI CẬP NHẬT" },
          { ...(trendingRes.items?.[0] || {}), badge: "⭐ PHIM NỔI BẬT" },
          { ...(chieuRapRes.items?.[0] || {}), badge: "🎬 PHIM CHIẾU RẠP" },
          { ...(hanQuocRes.items?.[0] || {}), badge: "🇰🇷 PHIM HÀN QUỐC" },
          { ...(vietNamRes.items?.[0] || {}), badge: "🇻🇳 PHIM VIỆT NAM" },
        ].filter(m => m && m.slug);

        const heroDetails = await Promise.all(
          heroList.map(async (movie) => {
            try {
              const detail = await api.getMovieDetail(movie.slug);
              let highQualityBanner = null;
              
              // Try to fetch high quality banner from TMDb
              try {
                const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
                let tmdbId = detail.movie?.tmdb?.id;
                let tmdbType = detail.movie?.tmdb?.type || 'movie';
                
                if (!tmdbId) {
                  const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
                  const searchRes = await fetch(searchUrl);
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    tmdbId = searchData.results[0].id;
                    tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
                  }
                }

                if (tmdbId) {
                  const imagesUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${apiKey}`;
                  const imagesRes = await fetch(imagesUrl);
                  const imagesData = await imagesRes.json();
                  if (imagesData.backdrops && imagesData.backdrops.length > 0) {
                    const sorted = imagesData.backdrops.sort((a: any, b: any) => b.width - a.width);
                    highQualityBanner = `https://image.tmdb.org/t/p/original${sorted[0].file_path}`;
                  }
                }
              } catch (e) {
                // Silently fail if high quality banner cannot be fetched (e.g., due to adblockers or CORS)
              }

              return { 
                ...movie, 
                content: detail.movie?.content || movie.content,
                highQualityBanner: highQualityBanner,
                trailer_url: detail.movie?.trailer_url || movie.trailer_url,
                _id: detail.movie?._id || movie._id
              };
            } catch (e) {
              return movie;
            }
          })
        );
        setHeroMovies(heroDetails);
      } catch (error) {
        console.error("Failed to fetch essential data", error);
        showToast("Không thể tải dữ liệu trang chủ. Vui lòng kiểm tra kết nối mạng.", "error");
      } finally {
        setLoading(false);
      }
    };

    const fetchSecondaryData = async () => {
      try {
        const [seriesRes, hoatHinhRes, tvShowsRes, thaiLanRes, hongKongRes, auMyRes, kinhDiRes] = await Promise.all([
          api.getByCategory("phim-bo", 1),
          api.getByCategory("hoat-hinh", 1),
          api.getByCategory("tv-shows", 1),
          api.getByCountry("thai-lan", 1),
          api.getByCountry("hong-kong", 1),
          api.getByCountry("au-my", 1),
          api.getByGenre("kinh-di", 1),
        ]);
        
        setSeries(seriesRes.items || []);
        setHoatHinh(hoatHinhRes.items || []);
        setTvShows(tvShowsRes.items || []);
        setThaiLan(thaiLanRes.items || []);
        setHongKong(hongKongRes.items || []);
        setAuMy(auMyRes.items || []);
        setKinhDi(kinhDiRes.items || []);
      } catch (error) {
        console.error("Failed to fetch secondary data", error);
        // Silently fail for secondary data to not spam the user
      }
    };

    fetchEssentialData();
    fetchSecondaryData();
  }, [showToast]);

  if (loading) {
    return (
      <div className="-mt-16 md:-mt-20 pb-20">
        <HeroBannerSkeleton />
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 md:mt-12 space-y-12">
          {[...Array(4)].map((_, sectionIndex) => (
            <div key={sectionIndex} className="space-y-4">
              <div className="h-8 w-48 bg-[#2A2A2A] rounded-md animate-pulse"></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <MovieCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="-mt-16 md:-mt-20 pb-20"
    >
      {/* Hero Section */}
      {heroMovies.length > 0 && (
        <div id="hero-banner" className="hero-banner bg-[#0A0A0A] group/hero">
          <Swiper
            modules={[Navigation, Pagination, Autoplay, EffectFade]}
            effect="fade"
            onSwiper={setHeroSwiper}
            onSlideChange={(swiper) => setActiveHeroIndex(swiper.realIndex)}
            navigation={{
              nextEl: '.hero-next',
              prevEl: '.hero-prev',
            }}
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
                  />
                  {/* Gradient overlay from left to right (70% -> 30%) */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
                  {/* Bottom gradient to fade into background with a softer blur effect */}
                  <div 
                    className="absolute inset-x-0 bottom-0 h-[80%] pointer-events-none" 
                    style={{
                      background: 'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.98) 15%, rgba(10,10,10,0.85) 35%, rgba(10,10,10,0.4) 70%, transparent 100%)'
                    }}
                  />
                  {/* Extra solid block at the very bottom to ensure no sharp edges */}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-[#0A0A0A] pointer-events-none" />
                </div>

                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 lg:px-24 mt-10 md:mt-0">
                    <div className="banner-info max-w-2xl animate-in slide-in-from-left-8 duration-1000 rounded-xl">
                      <span className="inline-block bg-[#E50914] text-white text-[10px] md:text-[12px] font-bold px-2 py-1 md:px-3 md:py-1 rounded-sm tracking-[1px] mb-3 md:mb-4">
                        {movie.badge}
                      </span>
                      <h1 
                        className="movie-title text-2xl sm:text-3xl md:text-5xl lg:text-[48px] font-heading font-bold text-white mb-2 md:mb-4 leading-tight drop-shadow-lg"
                        dangerouslySetInnerHTML={{ __html: movie.name }}
                      />
                      <p 
                        className="movie-description text-[14px] text-[#CCCCCC] max-w-[500px] text-justify leading-[21.5px] mb-4 md:mb-6 line-clamp-3 md:line-clamp-3"
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
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="btn flex items-center justify-center gap-1.5 bg-[#E50914] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] font-bold text-xs md:text-sm transition-all hover:scale-105 shadow-[0_4px_15px_rgba(229,9,20,0.5)]"
                        >
                          <Play className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
                          Xem ngay
                        </Link>
                        
                        {movie.trailer_url && (
                          <button
                            onClick={() => handlePlayTrailer(movie.trailer_url)}
                            className="btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20"
                          >
                            <Play className="w-3 h-3 md:w-4 md:h-4 text-[#E50914]" fill="currentColor" />
                            Trailer
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleFavorite(movie)}
                          className={`btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20 ${isFavorite(movie._id || movie.slug) ? 'text-[#E50914]' : 'text-white'}`}
                        >
                          <Heart className={`w-3 h-3 md:w-4 md:h-4 ${isFavorite(movie._id || movie.slug) ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">{isFavorite(movie._id || movie.slug) ? 'Bỏ yêu thích' : 'Yêu thích'}</span>
                        </button>

                        <Link
                          to={`/movie/${movie.slug}`}
                          className="btn flex items-center justify-center gap-1.5 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] text-white px-4 py-2 md:px-6 md:py-2.5 rounded-[40px] md:rounded-[8px] font-bold text-xs md:text-sm transition-all hover:bg-white/20"
                        >
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

          {/* Custom Navigation */}
          <button className="hero-prev absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-[32px] h-[32px] md:w-[48px] md:h-[48px] rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6 rotate-180" />
          </button>
          <button className="hero-next absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-[32px] h-[32px] md:w-[48px] md:h-[48px] rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
          </button>

          {/* Custom Pagination (Thumbnails) */}
          <div className="banner-thumbnails absolute bottom-4 md:bottom-8 right-4 md:right-8 z-20 flex gap-2 md:gap-4 justify-end w-full max-w-[calc(100vw-2rem)] md:max-w-[456px] overflow-x-auto no-scrollbar p-2">
            {heroMovies.map((movie, index) => (
              <button
                key={index}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`thumbnail relative overflow-hidden transition-all duration-300 flex-shrink-0 ${
                  activeHeroIndex === index 
                    ? 'border-2 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10' 
                    : 'border-2 border-transparent opacity-50 hover:opacity-100'
                } w-7 h-7 rounded-full md:w-[64px] md:h-[36px] md:rounded-md`}
              >
                <img 
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')} 
                  alt={movie.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-16 md:space-y-24">
        {/* Phim thịnh hành (Carousel) */}
        <section>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
              <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block"></span>
              Phim Thịnh Hành
            </h2>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 20 },
              768: { slidesPerView: 4, spaceBetween: 24 },
              1024: { slidesPerView: 5, spaceBetween: 24 },
            }}
            className="pb-8 md:pb-12 !overflow-visible"
          >
            {trending.slice(0, 15).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'trending'}-${index}`}>
                <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim mới cập nhật */}
        <section>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
              <span className="w-1.5 h-6 md:h-8 bg-[#E50914] rounded-full inline-block"></span>
              Phim Mới Cập Nhật
            </h2>
            <Link to="/movies" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
            </Link>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 20 },
              768: { slidesPerView: 4, spaceBetween: 24 },
              1024: { slidesPerView: 5, spaceBetween: 24 },
            }}
            className="pb-8 md:pb-12 !overflow-visible"
          >
            {newMovies.slice(1, 16).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'new'}-${index}`}>
                <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim bộ nổi bật */}
        <section>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
              <span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block"></span>
              Phim Bộ Nổi Bật
            </h2>
            <Link to="/series" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
            </Link>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 6000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 20 },
              768: { slidesPerView: 4, spaceBetween: 24 },
              1024: { slidesPerView: 5, spaceBetween: 24 },
            }}
            className="pb-8 md:pb-12 !overflow-visible"
          >
            {series.slice(0, 15).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'series'}-${index}`}>
                <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim Hoạt Hình */}
        {hoatHinh.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#10B981] rounded-full inline-block"></span>
                Phim Hoạt Hình
              </h2>
              <Link to="/genres?genre=hoat-hinh" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {hoatHinh.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'hoathinh'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Chương trình TV */}
        {tvShows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#8B5CF6] rounded-full inline-block"></span>
                Chương trình TV
              </h2>
              <Link to="/genres?genre=tv-shows" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 6500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {tvShows.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'tvshows'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Thái Lan */}
        {thaiLan.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#EC4899] rounded-full inline-block"></span>
                Phim Thái Lan
              </h2>
              <Link to="/genres?country=thai-lan" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 4500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {thaiLan.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'thailan'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Hồng Kong */}
        {hongKong.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#F59E0B] rounded-full inline-block"></span>
                Phim Hồng Kông
              </h2>
              <Link to="/genres?country=hong-kong" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {hongKong.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'hongkong'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Âu Mỹ */}
        {auMy.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block"></span>
                Phim Âu Mỹ
              </h2>
              <Link to="/genres?country=au-my" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 6000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {auMy.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'aumy'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Việt Nam */}
        {vietNam.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#EF4444] rounded-full inline-block"></span>
                Phim Việt Nam
              </h2>
              <Link to="/genres?country=viet-nam" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 4000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {vietNam.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'vietnam'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Kinh Dị */}
        {kinhDi.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#6B7280] rounded-full inline-block"></span>
                Phim Kinh Dị
              </h2>
              <Link to="/genres?genre=kinh-di" className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={16}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3, spaceBetween: 20 },
                768: { slidesPerView: 4, spaceBetween: 24 },
                1024: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="pb-8 md:pb-12 !overflow-visible"
            >
              {kinhDi.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'kinhdi'}-${index}`}>
                  <Suspense fallback={<MovieCardSkeleton />}><MovieCard movie={movie} /></Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setShowTrailer(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowTrailer(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-[#E50914] text-white rounded-full transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
              <iframe
                src={currentTrailerUrl}
                title="Trailer"
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              ></iframe>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
