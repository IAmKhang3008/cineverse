import React, {
  useEffect, useState, Suspense,
  useRef, useCallback, memo,
} from "react";
import { api, getImageUrl, NormalizedMovie } from "@/lib/api";
import { Play, Info, ChevronRight, Heart, X, Flame, TrendingUp, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/effect-fade";
import { motion, AnimatePresence } from "motion/react";
import { HeroBannerSkeleton, MovieCardSkeleton } from "@/components/Skeleton";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { fetchWithCache, TTL } from "@/lib/cache";
import ErrorBoundary from "@/components/ErrorBoundary";

const MovieCard = React.lazy(() => import("@/components/MovieCard"));

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const TMDB_KEY: string = (import.meta as any).env.VITE_TMDB_API_KEY || '';
const TMDB_ENABLED = TMDB_KEY.trim().length > 0;

type TrendingWindow = 'day' | 'week';

const TRENDING_TABS = [
  { id: 'day'  as TrendingWindow, label: 'Tiêu điểm ngày',     icon: <Flame      className="w-3.5 h-3.5" /> },
  { id: 'week' as TrendingWindow, label: 'Bảng xếp hạng tuần', icon: <TrendingUp className="w-3.5 h-3.5" /> },
] as const;

// Swiper breakpoints — dùng chung cho tất cả section
const SWIPER_BREAKPOINTS = {
  640:  { slidesPerView: 3, spaceBetween: 20 },
  768:  { slidesPerView: 4, spaceBetween: 24 },
  1024: { slidesPerView: 5, spaceBetween: 24 },
} as const;

// ─────────────────────────────────────────────────────────────
// [FIX 10] KEN BURNS IMAGE — component riêng + memo
// Tách ra khỏi Home để setKenBurnsKey không re-render toàn bộ trang
// ─────────────────────────────────────────────────────────────
interface KenBurnsImageProps {
  src: string;
  alt: string;
  isActive: boolean;
  priority?: boolean;
}

const KenBurnsImage = memo(({ src, alt, isActive, priority = false }: KenBurnsImageProps) => {
  const [animKey, setAnimKey] = useState(0);

  // Mỗi khi slide này trở thành active → restart animation
  useEffect(() => {
    if (isActive) setAnimKey(k => k + 1);
  }, [isActive]);

  return (
    <div
      key={animKey}
      className="absolute inset-0 will-change-transform"
      style={{ animation: isActive ? 'kenBurns 8s ease-out forwards' : 'none' }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </div>
  );
});
KenBurnsImage.displayName = 'KenBurnsImage';

// ─────────────────────────────────────────────────────────────
// [FIX 1] SWIPER SECTION — định nghĩa NGOÀI Home(), có memo
// Tránh tạo lại component mỗi render → Swiper không bị unmount
// ─────────────────────────────────────────────────────────────
interface SwiperSectionProps {
  title:      string;
  color:      string;
  link:       string;
  items:      any[];
  keyPrefix:  string;
  delay?:     number;
  isCardHolding: boolean;
}

const SwiperSection = memo(({
  title, color, link, items, keyPrefix, delay = 5000, isCardHolding,
}: SwiperSectionProps) => (
  <section>
    <div className="flex items-center justify-between mb-6 md:mb-8">
      <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
        {title}
      </h2>
      <Link to={link} className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1 flex-shrink-0">
        Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
      </Link>
    </div>
    <Swiper
      modules={[Navigation, Autoplay]}
      spaceBetween={16} slidesPerView={2} navigation
      allowTouchMove={!isCardHolding}
      autoplay={{ delay, disableOnInteraction: false }}
      breakpoints={SWIPER_BREAKPOINTS}
      className="pb-8 md:pb-12 !overflow-visible"
    >
      {items.slice(0, 15).map((movie: any, index: number) => (
        <SwiperSlide key={`${keyPrefix}-${movie.slug || index}`}>
          <Suspense fallback={<MovieCardSkeleton />}>
            <MovieCard movie={movie} onHoldChange={() => {}} />
          </Suspense>
        </SwiperSlide>
      ))}
    </Swiper>
  </section>
));
SwiperSection.displayName = 'SwiperSection';

// ─────────────────────────────────────────────────────────────
// [FIX 2] TRENDING — batch lookup 5 phim song song, không bắn 20 cùng lúc
// ─────────────────────────────────────────────────────────────
async function batchLookup(tmdbList: any[], batchSize = 5): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < tmdbList.length; i += batchSize) {
    const batch = tmdbList.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (tmdbMovie: any) => {
        const title    = tmdbMovie.title || tmdbMovie.name || '';
        if (!title) return null;
        const cacheKey = `phimapi_lookup_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const searchResult = await fetchWithCache(cacheKey, () => api.search(title, 1), TTL.SEARCH);
        const found = searchResult.items?.[0];
        if (!found) return null;
        return { ...found, tmdb: { ...found.tmdb, vote_average: tmdbMovie.vote_average } };
      })
    );
    settled.forEach(r => {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    });
    if (results.length >= 15) break; // đủ 15 rồi, dừng sớm
  }
  return results.slice(0, 15);
}

// ─────────────────────────────────────────────────────────────
// HOOK: useTrendingMovies
// ─────────────────────────────────────────────────────────────
function useTrendingMovies() {
  const [activeTab, setActiveTab] = useState<TrendingWindow>('day');
  const [movies, setMovies]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const resultCache = useRef<Partial<Record<TrendingWindow, any[]>>>({});

  const fetchTrending = useCallback(async (tab: TrendingWindow) => {
    if (resultCache.current[tab]) { setMovies(resultCache.current[tab]!); return; }
    setLoading(true);
    setMovies([]);
    try {
      if (!TMDB_ENABLED) throw new Error('TMDB disabled');
      const tmdbData = await fetchWithCache(
        `tmdb_trending_${tab}`,
        () => fetch(`https://api.themoviedb.org/3/trending/movie/${tab}?api_key=${TMDB_KEY}&language=vi-VN`)
              .then(r => { if (!r.ok) throw new Error(`TMDB ${r.status}`); return r.json(); }),
        TTL.TMDB_STATIC,
      );
      // [FIX 2] batch 5 thay vì 20 song song
      const verified = await batchLookup(tmdbData.results || []);
      resultCache.current[tab] = verified;
      setMovies(verified);
    } catch (err) {
      console.warn('[Trending] Fallback to local:', err);
      try {
        const res = tab === 'day'
          ? await api.getNewUpdated(1)
          : await api.getByCategory('phim-chieu-rap', 1);
        const list = (res.items || []).slice(0, 15);
        resultCache.current[tab] = list;
        setMovies(list);
      } catch { setMovies([]); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrending(activeTab); }, [activeTab, fetchTrending]);
  return { activeTab, setActiveTab, movies, loading };
}

// ─────────────────────────────────────────────────────────────
// [FIX 5] SECTIONS STATE — 1 object thay vì 10 useState riêng
// 10 state riêng = 10 lần set = 10 lần re-render khi fetch xong
// 1 object = 1 lần set = 1 lần re-render
// ─────────────────────────────────────────────────────────────
interface SectionsState {
  newMovies: any[];
  series:    any[];
  hoatHinh:  any[];
  tvShows:   any[];
  thaiLan:   any[];
  hongKong:  any[];
  auMy:      any[];
  vietNam:   any[];
  kinhDi:    any[];
}

const SECTIONS_INIT: SectionsState = {
  newMovies: [], series: [], hoatHinh: [], tvShows: [],
  thaiLan: [], hongKong: [], auMy: [], vietNam: [], kinhDi: [],
};

// ─────────────────────────────────────────────────────────────
// COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────
export default function Home() {
  useDocumentTitle('Cineverse - Vũ trụ điện ảnh của bạn');

  // [FIX 5] 1 state object cho tất cả section
  const [sections, setSections]   = useState<SectionsState>(SECTIONS_INIT);
  const [heroMovies, setHeroMovies] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [heroSwiper, setHeroSwiper] = useState<any>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [showTrailer, setShowTrailer]         = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState('');
  const [isCardHolding, setIsCardHolding]     = useState(false);

  const { activeTab, setActiveTab, movies: trendingMovies, loading: trendingLoading } = useTrendingMovies();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  // [FIX 6] showToast stable ref — tránh useEffect chạy lại vô hạn
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // [FIX 7] Ken Burns CSS — inject 1 lần duy nhất qua useEffect
  useEffect(() => {
    const id = 'cv-ken-burns-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes kenBurns {
        from { transform: scale(1.05); }
        to   { transform: scale(1);    }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes kenBurns { from { transform: none; } to { transform: none; } }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const handlePlayTrailer = useCallback((trailerUrl: string) => {
    if (!trailerUrl) { showToastRef.current('Trailer không khả dụng cho phim này.', 'error'); return; }
    let url = trailerUrl;
    if (url.includes('youtube.com/watch?v=')) url = url.replace('watch?v=', 'embed/');
    else if (url.includes('youtu.be/'))       url = url.replace('youtu.be/', 'youtube.com/embed/');
    url += url.includes('?') ? '&autoplay=1&mute=0' : '?autoplay=1&mute=0';
    setCurrentTrailerUrl(url);
    setShowTrailer(true);
  }, []);

  const handleToggleFavorite = useCallback((movie: any) => {
    const ok = toggleFavorite(movie);
    if (!ok) showToastRef.current('Bạn cần đăng nhập để thêm phim vào yêu thích!', 'error');
  }, [toggleFavorite]);

  // ─── DATA FETCH ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const empty = { items: [] as any[] };

    // ── ESSENTIAL: hero + newMovies + vietNam ──
    const fetchEssential = async () => {
      try {
        const [newRes, trendingRes, chieuRapRes, hanQuocRes, vietNamRes] = await Promise.all([
          api.getNewUpdated(1).catch(() => empty),
          api.getByCategory('phim-le', 1).catch(() => empty),
          api.getByCategory('phim-chieu-rap', 1).catch(() => empty),
          api.getByCountry('han-quoc', 1).catch(() => empty),
          api.getByCountry('viet-nam', 1).catch(() => empty),
        ]);
        if (!isMounted) return;

        // Update newMovies + vietNam ngay — không cần chờ hero
        setSections(prev => ({
          ...prev,
          newMovies: newRes.items || [],
          vietNam:   vietNamRes.items || [],
        }));

        const heroList = [
          { ...(newRes.items?.[0]      || {}), badge: '🔥 PHIM MỚI CẬP NHẬT' },
          { ...(trendingRes.items?.[0] || {}), badge: '⭐ PHIM NỔI BẬT' },
          { ...(chieuRapRes.items?.[0] || {}), badge: '🎬 PHIM CHIẾU RẠP' },
          { ...(hanQuocRes.items?.[0]  || {}), badge: '🇰🇷 PHIM HÀN QUỐC' },
          { ...(vietNamRes.items?.[0]  || {}), badge: '🇻🇳 PHIM VIỆT NAM' },
        ].filter(m => m?.slug);

        // [FIX 3] Promise.allSettled cho hero — 1 phim fail không block cả banner
        const heroSettled = await Promise.allSettled(
          heroList.map(async (movie) => {
            try {
              const detail = await api.getMovieDetail(movie.slug);
              let highQualityBanner: string | null = null;

              if (TMDB_ENABLED) {
                try {
                  let tmdbId   = detail.movie?.tmdb?.id;
                  let tmdbType = detail.movie?.tmdb?.type || 'movie';

                  if (!tmdbId) {
                    const sd = await fetchWithCache(
                      `tmdb_search_${movie.slug}`,
                      () => fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(movie.name)}&language=vi-VN`)
                            .then(r => r.json()),
                      TTL.TMDB_STATIC,
                    );
                    if (sd.results?.length > 0) {
                      tmdbId   = sd.results[0].id;
                      tmdbType = sd.results[0].media_type || (sd.results[0].first_air_date ? 'tv' : 'movie');
                    }
                  }

                  if (tmdbId) {
                    const imgData = await fetchWithCache(
                      `tmdb_images_${tmdbType}_${tmdbId}`,
                      () => fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${TMDB_KEY}`)
                            .then(r => r.json()),
                      TTL.TMDB_STATIC,
                    );
                    if (imgData.backdrops?.length > 0) {
                      const best = [...imgData.backdrops].sort((a: any, b: any) => b.width - a.width)[0];
                      highQualityBanner = `https://image.tmdb.org/t/p/original${best.file_path}`;
                    }
                  }
                } catch { /* TMDB fail silently */ }
              }

              return {
                ...movie,
                content:          detail.movie?.content       || movie.content,
                vote_average:     detail.movie?.tmdb?.vote_average ?? null,
                highQualityBanner,
                trailer_url:      detail.movie?.trailer_url   || movie.trailer_url || '',
                _id:              detail.movie?._id            || movie._id,
              };
            } catch {
              // Phim này fail → giữ nguyên data gốc (không throw, không block banner)
              return movie;
            }
          })
        );

        if (!isMounted) return;

        // Lọc ra những phim settled thành công (hoặc giữ nguyên khi catch)
        const heroDetails = heroSettled
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(m => m?.slug); // chắc chắn có slug

        setHeroMovies(heroDetails);
      } catch {
        if (!isMounted) return;
        showToastRef.current('Không thể tải dữ liệu trang chủ.', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // ── SECONDARY: 7 section còn lại ──
    // [FIX 5] 1 setSections duy nhất thay vì 7 setState riêng
    const fetchSecondary = async () => {
      const [seriesRes, hoatHinhRes, tvShowsRes, thaiLanRes, hongKongRes, auMyRes, kinhDiRes] =
        await Promise.all([
          api.getByCategory('phim-bo',   1).catch(() => empty),
          api.getByCategory('hoat-hinh', 1).catch(() => empty),
          api.getByCategory('tv-shows',  1).catch(() => empty),
          api.getByCountry('thai-lan',   1).catch(() => empty),
          api.getByCountry('hong-kong',  1).catch(() => empty),
          api.getByCountry('au-my',      1).catch(() => empty),
          api.getByGenre('kinh-di',      1).catch(() => empty),
        ]);
      if (!isMounted) return;
      setSections(prev => ({
        ...prev,
        series:   seriesRes.items    || [],
        hoatHinh: hoatHinhRes.items  || [],
        tvShows:  tvShowsRes.items   || [],
        thaiLan:  thaiLanRes.items   || [],
        hongKong: hongKongRes.items  || [],
        auMy:     auMyRes.items      || [],
        kinhDi:   kinhDiRes.items    || [],
      }));
    };

    fetchEssential();
    fetchSecondary();
    return () => { isMounted = false; };
  }, []); // [FIX 6] dependency array rỗng — showToast dùng ref

  // ─── LOADING STATE ────────────────────────────────────────
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

  const { newMovies, series, hoatHinh, tvShows, thaiLan, hongKong, auMy, vietNam, kinhDi } = sections;

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="-mt-16 md:-mt-20 pb-20"
    >
      {/* ═══════════════════════════════════════════════════
          HERO BANNER
          ═══════════════════════════════════════════════════ */}
      {heroMovies.length > 0 && (
        <div id="hero-banner" className="hero-banner bg-[#0A0A0A] group/hero relative">
          <Swiper
            modules={[Navigation, Autoplay, EffectFade]}
            effect="fade"
            onSwiper={setHeroSwiper}
            onSlideChange={(swiper) => setActiveHeroIndex(swiper.realIndex)}
            navigation={{ nextEl: '.hero-next', prevEl: '.hero-prev' }}
            allowTouchMove={!isCardHolding}
            autoplay={{ delay: 7000, disableOnInteraction: false }}
            loop={true}
            className="h-full w-full"
          >
            {heroMovies.map((movie, index) => (
              <SwiperSlide
                key={`hero-${movie.slug || movie._id || 'banner'}-${index}`}
                className="relative h-full w-full overflow-hidden"
              >
                {/* [FIX 10] Ken Burns — component riêng, không re-render Home */}
                <KenBurnsImage
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                  alt={movie.name || ''}
                  isActive={activeHeroIndex === index}
                  priority={index === 0}
                />

                {/* Gradient trái → phải (giảm từ 90→85, to transparent) */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent pointer-events-none" />

                {/* Gradient đỏ Cineverse — nhẹ bên trái */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(105deg, rgba(229,9,20,0.12) 0%, transparent 45%)' }}
                />

                {/* Gradient bottom → nối nền */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{ height: '70%', background: 'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.9) 20%, rgba(10,10,10,0.6) 50%, transparent 100%)' }}
                />
                <div className="absolute inset-x-0 bottom-0 h-8 bg-[#0A0A0A] pointer-events-none" />

                {/* Content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 lg:px-24 mt-10 md:mt-0">
                    <div className="banner-info max-w-2xl">

                      {/* Badge */}
                      <span className="inline-block bg-[#E50914] text-white text-[10px] md:text-[12px] font-bold px-2 py-1 md:px-3 md:py-1 rounded-sm tracking-[1px] mb-3 md:mb-4">
                        {movie.badge}
                      </span>

                      {/* Title */}
                      <h1
                        className="text-2xl sm:text-3xl md:text-5xl lg:text-[48px] font-heading font-bold text-white mb-2 md:mb-3 leading-tight drop-shadow-lg"
                        dangerouslySetInnerHTML={{ __html: movie.name || '' }}
                      />

                      {/* Meta — rating + info */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs md:text-[13px] text-gray-400 mb-3 md:mb-4 font-medium">
                        {movie.vote_average != null && (
                          <>
                            <span className="flex items-center gap-1 text-[#F5C518] font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              {Number(movie.vote_average) === 0 ? 'Đang cập nhật' : Number(movie.vote_average).toFixed(1)}
                            </span>
                            <span className="text-white/30">·</span>
                          </>
                        )}
                        <span>{movie.year || new Date().getFullYear()}</span>
                        <span className="text-white/30">·</span>
                        <span>{movie.category?.[0]?.name || 'Hành động'}</span>
                        <span className="text-white/30">·</span>
                        <span>{movie.time || '120 phút'}</span>
                        <span className="text-white/30">·</span>
                        <span className="text-white font-bold border border-white/20 px-1.5 py-0.5 rounded text-[10px] md:text-xs">
                          {movie.quality || 'HD'}
                        </span>
                      </div>

                      {/* Description — 4 dòng, max-w rộng hơn */}
                      <p
                        className="text-[13px] md:text-[14px] text-[#C8C8C8] max-w-[650px] text-justify leading-[22px] mb-5 md:mb-7"
                        style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{
                          __html: (movie.content || movie.origin_name || '').replace(/<[^>]*>?/gm, ''),
                        }}
                      />

                      {/* CTA — 4 nút phân cấp rõ */}
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        {/* PRIMARY */}
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="flex items-center gap-1.5 bg-[#E50914] text-white px-5 py-2.5 md:px-7 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all hover:scale-105 hover:brightness-110 shadow-[0_4px_20px_rgba(229,9,20,0.55)] active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor" />
                          Xem ngay
                        </Link>

                        {/* SECONDARY — chỉ hiện khi có trailer */}
                        {movie.trailer_url && (
                          <button
                            onClick={() => handlePlayTrailer(movie.trailer_url)}
                            className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all hover:bg-white/20 active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#E50914]" fill="currentColor" />
                            Trailer
                          </button>
                        )}

                        {/* TERTIARY — outline yêu thích */}
                        <button
                          onClick={() => handleToggleFavorite(movie)}
                          className={`flex items-center gap-1.5 border px-5 py-2.5 md:px-6 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all active:scale-95 ${
                            isFavorite(movie._id || movie.slug)
                              ? 'border-[#E50914] text-[#E50914] bg-[#E50914]/10 hover:bg-[#E50914]/20'
                              : 'border-white/30 text-white hover:border-white/60 hover:bg-white/10'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isFavorite(movie._id || movie.slug) ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">
                            {isFavorite(movie._id || movie.slug) ? 'Bỏ yêu thích' : 'Yêu thích'}
                          </span>
                        </button>

                        {/* GHOST — chi tiết */}
                        <Link
                          to={`/movie/${movie.slug}`}
                          className="flex items-center gap-1.5 text-white/70 hover:text-white px-3 py-2.5 md:py-3 font-bold text-xs md:text-sm transition-all active:scale-95 underline-offset-4 hover:underline"
                        >
                          <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">Chi tiết</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Nav arrows */}
          <button className="hero-prev absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6 rotate-180" />
          </button>
          <button className="hero-next absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 rounded-full bg-black/50 flex items-center justify-center text-white z-20 opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-black/80 backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
          </button>

          {/* Thumbnails — 16:9, lớn hơn */}
          <div className="absolute bottom-5 md:bottom-9 right-4 md:right-8 z-20 flex gap-2 md:gap-3 items-end overflow-x-auto no-scrollbar px-1 py-1">
            {heroMovies.map((movie, index) => (
              <button
                key={`thumb-${index}`}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`relative overflow-hidden flex-shrink-0 rounded-md transition-all duration-300 w-[52px] h-[30px] md:w-[80px] md:h-[46px] ${
                  activeHeroIndex === index
                    ? 'ring-2 ring-white scale-110 shadow-[0_0_18px_rgba(255,255,255,0.45)] z-10 opacity-100'
                    : 'ring-1 ring-white/20 opacity-45 hover:opacity-80 hover:scale-105'
                }`}
              >
                <img
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                  alt={movie.name || ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTIONS
          ═══════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-16 md:space-y-24">

        {/* Phim Thịnh Hành */}
        <section>
          <ErrorBoundary name="Phim Thịnh Hành">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3 flex-shrink-0">
                <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block" />
                Phim Thịnh Hành
              </h2>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 gap-0.5 flex-shrink-0">
                {TRENDING_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-4 sm:px-5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-[#F5C518] text-black shadow-[0_0_14px_rgba(245,197,24,0.5)] scale-[1.03]'
                          : 'text-white/50 hover:text-white hover:bg-white/10 active:scale-95'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${isActive ? 'text-black' : 'text-[#F5C518]'}`}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {trendingLoading ? (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {[...Array(5)].map((_, i) => <MovieCardSkeleton key={i} />)}
                </motion.div>
              ) : trendingMovies.length > 0 ? (
                <motion.div key={`trending-${activeTab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation
                    allowTouchMove={!isCardHolding}
                    autoplay={{ delay: 4000, disableOnInteraction: false }}
                    breakpoints={SWIPER_BREAKPOINTS}
                    className="pb-8 md:pb-12 !overflow-visible">
                    {trendingMovies.map((movie, i) => (
                      <SwiperSlide key={`trending-${activeTab}-${movie.slug || i}`}>
                        <Suspense fallback={<MovieCardSkeleton />}>
                          <MovieCard movie={movie} onHoldChange={setIsCardHolding} />
                        </Suspense>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center justify-center py-16 text-white/40 text-sm">
                  Không tìm thấy phim thịnh hành trong khoảng thời gian này.
                </motion.div>
              )}
            </AnimatePresence>
          </ErrorBoundary>
        </section>

        {/* Phim mới cập nhật — dùng thẳng Swiper vì có isCardHolding từ Home */}
        {newMovies.length > 0 && (
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
            <Swiper modules={[Navigation, Autoplay]} spaceBetween={16} slidesPerView={2} navigation
              allowTouchMove={!isCardHolding}
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              breakpoints={SWIPER_BREAKPOINTS}
              className="pb-8 md:pb-12 !overflow-visible">
              {newMovies.slice(1, 16).map((movie, i) => (
                <SwiperSlide key={`new-${movie.slug || i}`}>
                  <Suspense fallback={<MovieCardSkeleton />}>
                    <MovieCard movie={movie} onHoldChange={setIsCardHolding} />
                  </Suspense>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        )}

        {/* [FIX 1] SwiperSection đã định nghĩa ngoài Home — không re-mount */}
        {series.length   > 0 && <SwiperSection title="Phim Bộ Nổi Bật"    color="#3B82F6" link="/series"                   items={series}   keyPrefix="series"   delay={6000} isCardHolding={isCardHolding} />}
        {hoatHinh.length > 0 && <SwiperSection title="Phim Hoạt Hình"      color="#10B981" link="/genres?genre=hoat-hinh"   items={hoatHinh} keyPrefix="hoathinh" delay={5500} isCardHolding={isCardHolding} />}
        {tvShows.length  > 0 && <SwiperSection title="Chương trình TV"      color="#8B5CF6" link="/genres?genre=tv-shows"    items={tvShows}  keyPrefix="tv"       delay={6500} isCardHolding={isCardHolding} />}
        {thaiLan.length  > 0 && <SwiperSection title="Phim Thái Lan"        color="#EC4899" link="/genres?country=thai-lan"  items={thaiLan}  keyPrefix="thai"     delay={4500} isCardHolding={isCardHolding} />}
        {hongKong.length > 0 && <SwiperSection title="Phim Hồng Kông"       color="#F59E0B" link="/genres?country=hong-kong" items={hongKong} keyPrefix="hk"       delay={5000} isCardHolding={isCardHolding} />}
        {auMy.length     > 0 && <SwiperSection title="Phim Âu Mỹ"           color="#3B82F6" link="/genres?country=au-my"    items={auMy}     keyPrefix="aumy"     delay={6000} isCardHolding={isCardHolding} />}
        {vietNam.length  > 0 && <SwiperSection title="Phim Việt Nam"        color="#EF4444" link="/genres?country=viet-nam" items={vietNam}  keyPrefix="vn"       delay={4000} isCardHolding={isCardHolding} />}
        {kinhDi.length   > 0 && <SwiperSection title="Phim Kinh Dị"         color="#6B7280" link="/genres?genre=kinh-di"    items={kinhDi}   keyPrefix="kinhdi"   delay={5500} isCardHolding={isCardHolding} />}
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setShowTrailer(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
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
                src={currentTrailerUrl} title="Trailer" className="w-full h-full" allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}