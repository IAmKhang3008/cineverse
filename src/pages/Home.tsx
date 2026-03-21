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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          newRes, trendingRes, seriesRes, hoatHinhRes, tvShowsRes, 
          thaiLanRes, hongKongRes, auMyRes, vietNamRes, kinhDiRes
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
          api.getByGenre("kinh-di", 1)
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
      {trending.length > 0 && (
        <div className="relative h-[60vh] md:h-[80vh] w-full bg-[#0A0A0A]">
          <Swiper
            modules={[Navigation, Pagination, Autoplay, EffectFade]}
            effect="fade"
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            loop={true}
            className="h-full w-full"
          >
            {trending.slice(0, 5).map((movie, index) => (
              <SwiperSlide key={`${movie.slug || movie._id || 'hero'}-${index}`} className="relative h-full w-full">
                <div className="absolute inset-0">
                  <img
                    src={getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                    alt={movie.name}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
                </div>
                
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-[1280px] w-full mx-auto px-6">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="max-w-2xl"
                    >
                      <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-4 leading-tight">
                        {movie.name}
                      </h1>
                      <div className="flex items-center gap-4 text-sm text-gray-300 mb-6">
                        <span>{movie.year}</span>
                        <span className="border border-gray-600 px-2 py-1 rounded">{movie.quality}</span>
                        <span>{movie.time}</span>
                      </div>
                      <p className="text-gray-300 text-lg mb-8 line-clamp-3">
                        {movie.content?.replace(/<[^>]*>?/gm, '') || movie.origin_name}
                      </p>
                      
                      <div className="flex items-center gap-4">
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="flex items-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-8 py-3 rounded-full font-semibold transition-colors"
                        >
                          <Play className="w-5 h-5 fill-current" />
                          Xem Ngay
                        </Link>
                        <Link
                          to={`/movie/${movie.slug}`}
                          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-semibold backdrop-blur-sm transition-colors"
                        >
                          <Info className="w-5 h-5" />
                          Chi Tiết
                        </Link>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
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
