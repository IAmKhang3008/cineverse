import { useEffect, useState } from "react";
import { api, getImageUrl } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { Play, Info, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import { motion } from "motion/react";

export default function Home() {
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          newRes, trendingRes, seriesRes, hoatHinhRes, tvShowsRes, 
          thaiLanRes, hongKongRes, auMyRes, vietNamRes, kinhDiRes,
          chieuRapRes, hanQuocRes
        ] = await Promise.all([
          api.getNewUpdated(1),
          api.getByCategory("phim-le", 1),
          api.getByCategory("phim-bo", 1),
          api.getByCategory("hoat-hinh", 1),
          api.getByCategory("tv-shows", 1),
          api.getByCountry("thai-lan", 1),
          api.getByCountry("hong-kong", 1),
          api.getByCountry("au-my", 1),
          api.getByCountry("viet-nam", 1),
          api.getByGenre("kinh-di", 1),
          api.getByCategory("phim-chieu-rap", 1),
          api.getByCountry("han-quoc", 1),
        ]);
        
        setNewMovies(newRes.items || []);
        setTrending(trendingRes.items || []);
        setSeries(seriesRes.items || []);
        setHoatHinh(hoatHinhRes.items || []);
        setTvShows(tvShowsRes.items || []);
        setThaiLan(thaiLanRes.items || []);
        setHongKong(hongKongRes.items || []);
        setAuMy(auMyRes.items || []);
        setVietNam(vietNamRes.items || []);
        setKinhDi(kinhDiRes.items || []);

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
                highQualityBanner: highQualityBanner
              };
            } catch (e) {
              return movie;
            }
          })
        );
        setHeroMovies(heroDetails);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-20"
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
                  />
                  {/* Gradient overlay from left to right (70% -> 30%) */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
                  {/* Bottom gradient to fade into background */}
                  <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--color-cine-bg)] to-transparent" />
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
                      
                      <div className="movie-actions flex flex-wrap items-center gap-3 md:gap-4">
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="btn flex items-center justify-center gap-2 bg-[#E50914] text-white px-6 py-2.5 md:px-[32px] md:py-[12px] rounded-[40px] font-bold text-sm md:text-[16px] transition-all hover:scale-105 shadow-[0_4px_15px_rgba(229,9,20,0.5)]"
                        >
                          <Play className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
                          Xem ngay
                        </Link>
                        <Link
                          to={`/movie/${movie.slug}`}
                          className="btn flex items-center justify-center gap-2 bg-transparent backdrop-blur-[8px] !border !border-solid !border-[#4f4444] text-white px-6 py-2.5 md:px-[32px] md:py-[12px] rounded-[8px] font-bold text-sm md:text-[16px] transition-all hover:bg-white/20"
                        >
                          <Info className="w-4 h-4 md:w-5 md:h-5" />
                          Chi tiết phim
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
          <div className="banner-thumbnails absolute bottom-4 md:bottom-8 right-4 md:right-8 z-20 flex gap-2 md:gap-4 justify-end">
            {heroMovies.map((movie, index) => (
              <button
                key={index}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`thumbnail relative overflow-hidden transition-all duration-300 ${
                  activeHeroIndex === index 
                    ? 'border-2 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10' 
                    : 'border-2 border-transparent opacity-50 hover:opacity-100'
                } w-8 h-8 rounded-full md:w-[80px] md:h-[45px] md:rounded-md`}
              >
                <img 
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')} 
                  alt={movie.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-6 mt-12 space-y-24">
        {/* Phim thịnh hành (Carousel) */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-heading font-bold text-white  tracking-wider flex items-center gap-3">
              <span className="w-1.5 h-8 bg-[#F5C518] rounded-full inline-block"></span>
              Phim Thịnh Hành
            </h2>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3 },
              768: { slidesPerView: 4 },
              1024: { slidesPerView: 5 },
            }}
            className="pb-12 !overflow-visible"
          >
            {trending.slice(0, 15).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'trending'}-${index}`}>
                <MovieCard movie={movie} />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim mới cập nhật */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-heading font-bold text-white  tracking-wider flex items-center gap-3">
              <span className="w-1.5 h-8 bg-[#E50914] rounded-full inline-block"></span>
              Phim Mới Cập Nhật
            </h2>
            <Link to="/movies" className="text-sm text-[#3B82F6] hover:text-white :text-black transition-colors flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3 },
              768: { slidesPerView: 4 },
              1024: { slidesPerView: 5 },
            }}
            className="pb-12 !overflow-visible"
          >
            {newMovies.slice(1, 16).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'new'}-${index}`}>
                <MovieCard movie={movie} />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim bộ nổi bật */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-heading font-bold text-white  tracking-wider flex items-center gap-3">
              <span className="w-1.5 h-8 bg-[#3B82F6] rounded-full inline-block"></span>
              Phim Bộ Nổi Bật
            </h2>
            <Link to="/series" className="text-sm text-[#3B82F6] hover:text-white :text-black transition-colors flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={2}
            navigation
            autoplay={{ delay: 6000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 3 },
              768: { slidesPerView: 4 },
              1024: { slidesPerView: 5 },
            }}
            className="pb-12 !overflow-visible"
          >
            {series.slice(0, 15).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'series'}-${index}`}>
                <MovieCard movie={movie} />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>

        {/* Phim Hoạt Hình */}
        {hoatHinh.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#10B981] rounded-full inline-block"></span>
                Phim Hoạt Hình
              </h2>
              <Link to="/genres?genre=hoat-hinh" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {hoatHinh.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'hoathinh'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Chương trình TV */}
        {tvShows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#8B5CF6] rounded-full inline-block"></span>
                Chương trình TV
              </h2>
              <Link to="/genres?genre=tv-shows" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 6500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {tvShows.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'tvshows'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Thái Lan */}
        {thaiLan.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#EC4899] rounded-full inline-block"></span>
                Phim Thái Lan
              </h2>
              <Link to="/genres?country=thai-lan" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 4500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {thaiLan.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'thailan'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Hồng Kong */}
        {hongKong.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#F59E0B] rounded-full inline-block"></span>
                Phim Hồng Kong
              </h2>
              <Link to="/genres?country=hong-kong" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {hongKong.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'hongkong'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Âu Mỹ */}
        {auMy.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#3B82F6] rounded-full inline-block"></span>
                Phim Âu Mỹ
              </h2>
              <Link to="/genres?country=au-my" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 6000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {auMy.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'aumy'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Việt Nam */}
        {vietNam.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#EF4444] rounded-full inline-block"></span>
                Phim Việt Nam
              </h2>
              <Link to="/genres?country=viet-nam" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 4000, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {vietNam.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'vietnam'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* Phim Kinh Dị */}
        {kinhDi.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-8 bg-[#6B7280] rounded-full inline-block"></span>
                Phim Kinh Dị
              </h2>
              <Link to="/genres?genre=kinh-di" className="text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={24}
              slidesPerView={2}
              navigation
              autoplay={{ delay: 5500, disableOnInteraction: false }}
              breakpoints={{
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 },
              }}
              className="pb-12 !overflow-visible"
            >
              {kinhDi.slice(0, 15).map((movie, index) => (
                <SwiperSlide key={`${movie.slug || movie._id || 'kinhdi'}-${index}`}>
                  <MovieCard movie={movie} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}
      </div>
    </motion.div>
  );
}
