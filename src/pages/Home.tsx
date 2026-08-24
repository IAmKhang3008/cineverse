import React, {
  useEffect, useState, Suspense,
  useRef, useCallback, memo, useMemo,
} from "react";
import { api, getImageUrl, NormalizedMovie, extractBestBackdrop, extractBestPoster, searchTmdbWithCache } from "@/lib/api";
import { Play, Info, ChevronRight, Heart, X, Flame, TrendingUp, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, EffectFade } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
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
import MovieCard from "@/components/MovieCard";

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

const SWIPER_BREAKPOINTS = {
  640:  { slidesPerView: 3, spaceBetween: 20 },
  768:  { slidesPerView: 4, spaceBetween: 24 },
  1024: { slidesPerView: 5, spaceBetween: 24 },
} as const;

// ─────────────────────────────────────────────────────────────
// [UNIFIED] NAV ARROW — dùng chung cho cả Hero và SwiperSection
// ─────────────────────────────────────────────────────────────
interface NavArrowProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  className?: string;
}

const NavArrow = memo(({ direction, onClick, className = '' }: NavArrowProps) => (
  <button
    onClick={onClick}
    aria-label={direction === 'prev' ? 'Slide trước' : 'Slide tiếp'}
    className={[
      // Base: tròn, tối, blur
      'flex-shrink-0 flex items-center justify-center',
      'w-8 h-8 md:w-10 md:h-10 rounded-full',
      'bg-black/60 hover:bg-black/90 backdrop-blur-sm',
      'text-white border border-white/10',
      'transition-all duration-200 hover:scale-110 active:scale-95',
      'disabled:opacity-30 disabled:cursor-not-allowed',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
      className,
    ].join(' ')}
  >
    <ChevronRight
      className={`w-4 h-4 md:w-5 md:h-5 ${direction === 'prev' ? 'rotate-180' : ''}`}
    />
  </button>
));
NavArrow.displayName = 'NavArrow';

// ─────────────────────────────────────────────────────────────
// KEN BURNS IMAGE — component riêng + memo
// BUG FIX: không dùng React key để trigger animation,
// thay bằng CSS animation-name thay đổi theo animKey
// ─────────────────────────────────────────────────────────────
interface KenBurnsImageProps {
  src: string;
  alt: string;
  isActive: boolean;
  priority?: boolean;
}

const KenBurnsImage = memo(({ src, alt, isActive, priority = false }: KenBurnsImageProps) => {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (isActive) setAnimKey(k => k + 1);
  }, [isActive]);

  return (
    // BUG FIX: Không dùng React key (gây unmount/remount),
    // thay bằng animation-name duy nhất mỗi lần active để restart animation
    <div
      className="absolute inset-0 will-change-transform"
      style={{
        animationName:      isActive ? `kenBurns_${animKey}` : 'none',
        animationDuration:  '8s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards',
      }}
    >
      {/* Inject keyframe động mỗi lần animKey đổi */}
      {isActive && (
        <style>{`
          @keyframes kenBurns_${animKey} {
            from { transform: scale(1.06); }
            to   { transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes kenBurns_${animKey} { from { transform: none; } to { transform: none; } }
          }
        `}</style>
      )}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
KenBurnsImage.displayName = 'KenBurnsImage';

// ─────────────────────────────────────────────────────────────
// SWIPER SECTION — ngoài Home(), memo
// [SWIPE FIX] allowTouchMove luôn true, grabCursor
// [ARROW FIX] dùng swiperRef + NavArrow thay vì navigation prop
// ─────────────────────────────────────────────────────────────
interface SwiperSectionProps {
  title:         string;
  color:         string;
  link:          string;
  items:         any[];
  keyPrefix:     string;
  delay?:        number;
  onHoldChange:  (holding: boolean) => void;
}

const SwiperSection = memo(({
  title, color, link, items, keyPrefix, delay = 5000, onHoldChange,
}: SwiperSectionProps) => {
  const swiperRef = useRef<SwiperType | null>(null);

  // Deduplicate items to prevent duplicate rendering and key collisions
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    return (items || []).filter((m, idx) => {
      const id = m?.slug || m?._id || m?.id || idx;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [items]);

  return (
    <section>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
          <span className="w-1.5 h-6 md:h-8 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
          {title}
        </h2>
        {/* Link bên phải */}
        <div className="flex items-center flex-shrink-0">
          <Link
            to={link}
            className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1"
          >
            Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
          </Link>
        </div>
      </div>

      <div className="relative group/slider">
      <Swiper
        modules={[Autoplay]}
        onSwiper={s => { swiperRef.current = s; }}
        spaceBetween={16}
        slidesPerView={2}
        // [SWIPE FIX] Touch/drag luôn bật — người dùng có thể swipe
        allowTouchMove={true}
        grabCursor={true}
        autoplay={{ delay, disableOnInteraction: false, pauseOnMouseEnter: true }}
        breakpoints={SWIPER_BREAKPOINTS}
        className="pb-2 md:pb-4 !overflow-visible"
      >
        {uniqueItems.slice(0, 15).map((movie: any, index: number) => (
          <SwiperSlide key={`${keyPrefix}-${movie.slug || movie._id || index}-${index}`}>
            <MovieCard movie={movie} onHoldChange={onHoldChange} priority={index < 4} />
          </SwiperSlide>
        ))}
      </Swiper>
      
      {/* Nav arrows overlay */}
      <NavArrow 
        direction="prev" 
        onClick={() => swiperRef.current?.slidePrev()} 
        className="absolute -left-4 md:-left-5 top-1/2 -translate-y-1/2 z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
      />
      <NavArrow 
        direction="next" 
        onClick={() => swiperRef.current?.slideNext()} 
        className="absolute -right-4 md:-right-5 top-1/2 -translate-y-1/2 z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
      />
      </div>
    </section>
  );
});
SwiperSection.displayName = 'SwiperSection';

// ─────────────────────────────────────────────────────────────
// TRENDING BATCH LOOKUP
// ─────────────────────────────────────────────────────────────
async function batchLookup(tmdbList: any[], batchSize = 5): Promise<any[]> {
  const results: any[] = [];
  const seenSlugs = new Set<string>();
  for (let i = 0; i < tmdbList.length; i += batchSize) {
    const batch   = tmdbList.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (tmdbMovie: any) => {
        const title = tmdbMovie.title || tmdbMovie.name || '';
        if (!title) return null;
        const cacheKey     = `phimapi_lookup_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const searchResult = await fetchWithCache(cacheKey, () => api.search(title, 1), TTL.SEARCH);
        const found        = searchResult.items?.[0];
        if (!found) return null;
        return { ...found, tmdb: { ...found.tmdb, vote_average: tmdbMovie.vote_average } };
      })
    );
    settled.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        const slug = r.value.slug || r.value._id || r.value.name;
        if (slug && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          results.push(r.value);
        }
      }
    });
    if (results.length >= 15) break;
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
      const verified           = await batchLookup(tmdbData.results || []);
      resultCache.current[tab] = verified;
      setMovies(verified);
    } catch (err) {
      console.warn('[Trending] Fallback to local:', err);
      try {
        const res  = tab === 'day' ? await api.getNewUpdated(1) : await api.getByCategory('phim-chieu-rap', 1);
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
// SECTIONS STATE
// ─────────────────────────────────────────────────────────────
interface SectionsState {
  newMovies: any[]; series: any[]; hoatHinh: any[]; tvShows: any[];
  thaiLan:   any[]; hongKong: any[]; auMy: any[]; vietNam: any[]; kinhDi: any[];
  chieuRap:  any[];
}
const SECTIONS_INIT: SectionsState = {
  newMovies: [], series: [], hoatHinh: [], tvShows: [],
  thaiLan: [], hongKong: [], auMy: [], vietNam: [], kinhDi: [], chieuRap: [],
};

// ─────────────────────────────────────────────────────────────
// FETCH TMDB PHIM CHIẾU RẠP (NOW PLAYING / DISCOVER THEATRICAL)
// ─────────────────────────────────────────────────────────────
async function fetchChieuRap(): Promise<{ items: any[] }> {
  if (TMDB_ENABLED) {
    try {
      const tmdbData = await fetchWithCache(
        'tmdb_now_playing',
        () => fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=vi-VN&page=1`)
              .then(r => { if (!r.ok) throw new Error(`TMDB ${r.status}`); return r.json(); }),
        TTL.TMDB_STATIC,
      );

      let results = tmdbData.results || [];
      if (results.length === 0) {
        const discoverData = await fetchWithCache(
          'tmdb_discover_theatrical',
          () => fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_release_type=2|3&language=vi-VN&sort_by=popularity.desc`)
                .then(r => { if (!r.ok) throw new Error(`TMDB ${r.status}`); return r.json(); }),
          TTL.TMDB_STATIC,
        );
        results = discoverData.results || [];
      }

      if (results.length > 0) {
        const matched = await batchLookup(results, 5);
        if (matched.length > 0) {
          return { items: matched };
        }
      }
    } catch (err) {
      console.warn('[Phim Chiếu Rạp] TMDB fetch failed, fallback to local category:', err);
    }
  }
  return api.getByCategory('phim-chieu-rap', 1).catch(() => ({ items: [] }));
}

// ─────────────────────────────────────────────────────────────
// COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────
export default function Home() {
  useDocumentTitle('Cineverse - Vũ trụ điện ảnh của bạn');

  const [sections, setSections]     = useState<SectionsState>(SECTIONS_INIT);
  const [heroMovies, setHeroMovies] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [heroSwiper, setHeroSwiper] = useState<SwiperType | null>(null);
  const [activeHeroIndex, setActiveHeroIndex]   = useState(0);
  const [showTrailer, setShowTrailer]           = useState(false);
  const [currentTrailerUrl, setCurrentTrailerUrl] = useState('');
  const [isCardHolding, setIsCardHolding]       = useState(false);

  const { activeTab, setActiveTab, movies: trendingMovies, loading: trendingLoading } = useTrendingMovies();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast }                  = useToast();

  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

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
    const empty   = { items: [] as any[] };

    const fetchEssential = async () => {
      try {
        const [newRes, trendingRes, chieuRapRes, hanQuocRes, vietNamRes] = await Promise.all([
          api.getNewUpdated(1).catch(() => empty),
          api.getByCategory('phim-le', 1).catch(() => empty),
          fetchChieuRap().catch(() => empty),
          api.getByCountry('han-quoc', 1).catch(() => empty),
          api.getByCountry('viet-nam', 1).catch(() => empty),
        ]);
        if (!isMounted) return;

        setSections(prev => ({
          ...prev,
          newMovies: newRes.items    || [],
          chieuRap:  chieuRapRes.items || [],
          vietNam:   vietNamRes.items || [],
        }));

        const heroList = [
          { ...(newRes.items?.[0]      || {}), badge: '🔥 PHIM MỚI CẬP NHẬT' },
          { ...(trendingRes.items?.[0] || {}), badge: '⭐ PHIM NỔI BẬT' },
          { ...(chieuRapRes.items?.[0] || {}), badge: '🎬 PHIM CHIẾU RẠP' },
          { ...(hanQuocRes.items?.[0]  || {}), badge: '🇰🇷 PHIM HÀN QUỐC' },
          { ...(vietNamRes.items?.[0]  || {}), badge: '🇻🇳 PHIM VIỆT NAM' },
        ].filter(m => m?.slug);

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
                    const searchResult = await searchTmdbWithCache(movie);
                    if (searchResult) {
                      tmdbId = searchResult.id;
                      tmdbType = searchResult.media_type || (searchResult.first_air_date ? 'tv' : 'movie');
                    }
                  }
                  if (tmdbId) {
                    const imgData = await fetchWithCache(
                      `tmdb_images_${tmdbType}_${tmdbId}`,
                      () => fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${TMDB_KEY}&language=en-US&include_image_language=en,null`).then(r => r.json()),
                      TTL.TMDB_STATIC,
                    );
                    const bestBackdrop = extractBestBackdrop(imgData);
                    if (bestBackdrop) {
                      highQualityBanner = bestBackdrop;
                    }
                  }
                } catch { /* TMDB fail silently */ }
              }

              // Fallback to phimapi images endpoint if TMDB fails or is skipped
              if (!highQualityBanner) {
                try {
                  const imgData = await api.getMovieImages(movie.slug).catch(() => null);
                  if (imgData && imgData.images && imgData.images.length > 0) {
                    const backdrops = imgData.images.filter((img: any) => img.width && img.height && img.width > img.height);
                    if (backdrops.length > 0) {
                      const best = [...backdrops].sort((a: any, b: any) => b.width - a.width)[0];
                      highQualityBanner = `https://image.tmdb.org/t/p/w1280${best.file_path}`;
                    }
                  }
                } catch { /* Fallback fail silently */ }
              }

              return {
                ...movie,
                content:          detail.movie?.content            || movie.content,
                vote_average:     detail.movie?.tmdb?.vote_average ?? null,
                highQualityBanner,
                trailer_url:      detail.movie?.trailer_url        || movie.trailer_url || '',
                _id:              detail.movie?._id                || movie._id,
              };
            } catch { return movie; }
          })
        );

        if (!isMounted) return;
        setHeroMovies(
          heroSettled
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(m => m?.slug)
        );
      } catch {
        if (!isMounted) return;
        showToastRef.current('Không thể tải dữ liệu trang chủ.', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

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
  }, []);

  // ─── LOADING ──────────────────────────────────────────────
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

  const { newMovies, series, hoatHinh, tvShows, thaiLan, hongKong, auMy, vietNam, kinhDi, chieuRap } = sections;

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
        <div
          id="hero-banner"
          className={[
            'hero-banner bg-[#0A0A0A] relative',
            // [MOBILE FIX] Đảm bảo banner có đủ chiều cao trên mọi màn hình
            'min-h-[520px] sm:min-h-[600px] md:min-h-[680px] lg:min-h-[100vh]',
            // Group cho hover arrows
            'group/hero',
          ].join(' ')}
        >
          <Swiper
            modules={[Navigation, Autoplay, EffectFade]}
            effect="fade"
            onSwiper={setHeroSwiper}
            onSlideChange={s => setActiveHeroIndex(s.realIndex)}
            navigation={{ nextEl: '.hero-next', prevEl: '.hero-prev' }}
            // [SWIPE FIX] Touch luôn bật trên hero — mobile swipe để chuyển slide
            allowTouchMove={true}
            grabCursor={true}
            autoplay={{ delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true }}
            loop={true}
            className="h-full w-full absolute inset-0"
          >
            {heroMovies.map((movie, index) => (
              <SwiperSlide
                key={`hero-${movie.slug || movie._id || 'banner'}-${index}`}
                className="relative h-full w-full overflow-hidden"
              >
                <KenBurnsImage
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                  alt={movie.name || ''}
                  isActive={activeHeroIndex === index}
                  priority={index === 0}
                />

                {/* Gradient trái → phải */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent pointer-events-none" />
                {/* Gradient đỏ Cineverse nhẹ */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(105deg, rgba(229,9,20,0.10) 0%, transparent 50%)' }}
                />
                {/* Gradient bottom */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{ height: '65%', background: 'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.85) 25%, rgba(10,10,10,0.5) 55%, transparent 100%)' }}
                />
                <div className="absolute inset-x-0 bottom-0 h-6 bg-[#0A0A0A] pointer-events-none" />

                {/* ──── BANNER CONTENT ──────────────────── */}
                <div className="absolute inset-0 flex items-end sm:items-center">
                  <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 md:px-16 lg:px-24">
                    {/*
                      [MOBILE FIX] padding-bottom trên mobile agar content không bị
                      che bởi thumbnail bar phía dưới
                    */}
                    <div className="banner-info pb-[80px] sm:pb-0 pt-16 sm:pt-0 max-w-xl md:max-w-2xl">

                      {/* Badge */}
                      <span className="inline-block bg-[#E50914] text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-1 sm:px-3 rounded-sm tracking-[1.5px] mb-2 sm:mb-3 md:mb-4 uppercase">
                        {movie.badge}
                      </span>

                      {/* Title — [MOBILE FIX] cỡ chữ nhỏ hơn trên mobile */}
                      <h1
                        className="font-heading font-bold text-white leading-tight drop-shadow-lg mb-1.5 sm:mb-2 md:mb-3
                          text-[22px] sm:text-[30px] md:text-[42px] lg:text-[50px]"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        dangerouslySetInnerHTML={{ __html: movie.name || '' }}
                      />

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[12px] md:text-[13px] text-gray-400 mb-2 sm:mb-3 md:mb-4 font-medium">
                        {movie.vote_average != null && movie.vote_average > 0 && (
                          <>
                            <span className="flex items-center gap-1 text-[#F5C518] font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              {Number(movie.vote_average).toFixed(1)}
                            </span>
                            <span className="text-white/30">·</span>
                          </>
                        )}
                        <span>{movie.year || new Date().getFullYear()}</span>
                        <span className="text-white/30">·</span>
                        <span className="hidden xs:inline">{movie.category?.[0]?.name || 'Hành động'}</span>
                        <span className="hidden xs:inline text-white/30">·</span>
                        <span className="hidden sm:inline">{movie.time || '120 phút'}</span>
                        <span className="hidden sm:inline text-white/30">·</span>
                        <span className="text-white font-bold border border-white/20 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] md:text-xs">
                          {movie.quality || 'HD'}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        className="text-[12px] sm:text-[13px] md:text-[14px] text-[#C8C8C8] leading-[18px] sm:leading-[22px] mb-4 md:mb-6 max-w-full sm:max-w-[580px] line-clamp-2 sm:line-clamp-3"
                        dangerouslySetInnerHTML={{
                          __html: (movie.content || movie.origin_name || '').replace(/<[^>]*>?/gm, ''),
                        }}
                      />

                      {/* CTA Buttons in a single container */}
                      <div className="flex flex-row flex-wrap items-center gap-2.5 sm:gap-3.5">
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="flex items-center gap-1.5 bg-[#E50914] text-white px-4 py-2 sm:px-5 sm:py-2.5 md:px-7 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all hover:scale-105 hover:brightness-110 shadow-[0_4px_20px_rgba(229,9,20,0.55)] active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor" />
                          Xem ngay
                        </Link>
                        {movie.trailer_url && (
                          <button
                            onClick={() => handlePlayTrailer(movie.trailer_url)}
                            className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all hover:bg-white/20 active:scale-95 cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4 text-white">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            Trailer
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleFavorite(movie)}
                          className={`flex items-center gap-1.5 border px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all active:scale-95 ${
                            isFavorite(movie._id || movie.slug)
                              ? 'border-[#E50914] text-[#E50914] bg-[#E50914]/10 hover:bg-[#E50914]/20'
                              : 'border-white/30 text-white hover:border-white/60 hover:bg-white/10'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isFavorite(movie._id || movie.slug) ? 'fill-current' : ''}`} />
                          <span>{isFavorite(movie._id || movie.slug) ? 'Bỏ yêu thích' : 'Yêu thích'}</span>
                        </button>
                        <Link
                          to={`/movie/${movie.slug}`}
                          className="flex items-center gap-1.5 text-white/70 hover:text-white px-3 py-2 sm:py-2.5 md:py-3 font-bold text-xs md:text-sm transition-all active:scale-95 underline-offset-4 hover:underline"
                        >
                          <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Chi tiết</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* [ARROW FIX + MOBILE FIX] Nav arrows — ẩn trên mobile, dùng NavArrow chung */}
          <NavArrow
            direction="prev"
            onClick={() => heroSwiper?.slidePrev()}
            className="hero-prev absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover/hero:opacity-100 transition-opacity"
          />
          <NavArrow
            direction="next"
            onClick={() => heroSwiper?.slideNext()}
            className="hero-next absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover/hero:opacity-100 transition-opacity"
          />

          {/* [MOBILE FIX] Thumbnails — ẩn trên mobile nhỏ, hiện từ sm+ */}
          <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-5 md:right-8 z-20 hidden sm:flex gap-1.5 sm:gap-2 md:gap-3 items-end overflow-x-auto no-scrollbar py-1 max-w-[calc(100vw-6rem)]">
            {heroMovies.map((movie, index) => (
              <button
                key={`thumb-${index}`}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`relative overflow-hidden flex-shrink-0 rounded transition-all duration-300
                  w-[52px] h-[30px] sm:w-[64px] sm:h-[36px] md:w-[80px] md:h-[46px] ${
                  activeHeroIndex === index
                    ? 'ring-2 ring-white scale-110 shadow-[0_0_16px_rgba(255,255,255,0.4)] z-10 opacity-100'
                    : 'ring-1 ring-white/20 opacity-40 hover:opacity-80 hover:scale-105'
                }`}
              >
                <img
                  src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                  alt={movie.name || ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {activeHeroIndex === index && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#E50914]" />
                )}
              </button>
            ))}
          </div>

          {/* [MOBILE FIX] Dot indicators — chỉ hiện trên mobile thay cho thumbnails */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex sm:hidden gap-1.5">
            {heroMovies.map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`rounded-full transition-all duration-300 ${
                  activeHeroIndex === index
                    ? 'w-5 h-1.5 bg-[#E50914]'
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTIONS
          ═══════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-14 md:space-y-20">

        {/* Phim Thịnh Hành */}
        <section>
          <ErrorBoundary name="Phim Thịnh Hành">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 md:mb-7">
              <h2 className="text-lg md:text-2xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3 flex-shrink-0">
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
                      className={`flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-3 sm:px-5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
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
                  {/* Trending section cũng dùng swiperRef pattern */}
                  {(() => {
                    const trendingSwiperRef = { current: null as SwiperType | null };
                    return (
                      <div className="relative group/trending">
                        <Swiper
                          modules={[Autoplay]}
                          onSwiper={s => { trendingSwiperRef.current = s; }}
                          spaceBetween={16}
                          slidesPerView={2}
                          allowTouchMove={true}
                          grabCursor={true}
                          autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                          breakpoints={SWIPER_BREAKPOINTS}
                          className="pb-2 !overflow-visible"
                        >
                          {trendingMovies.map((movie, i) => (
                            <SwiperSlide key={`trending-${activeTab}-${movie.slug || movie._id || 'item'}-${i}`}>
                              <MovieCard movie={movie} onHoldChange={setIsCardHolding} priority={i < 4} />
                            </SwiperSlide>
                          ))}
                        </Swiper>
                        {/* Overlay Arrows - Similar to Hero Banner */}
                        <NavArrow 
                          direction="prev" 
                          onClick={() => trendingSwiperRef.current?.slidePrev()} 
                          className="absolute -left-4 md:-left-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
                        />
                        <NavArrow 
                          direction="next" 
                          onClick={() => trendingSwiperRef.current?.slideNext()} 
                          className="absolute -right-4 md:-right-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
                        />
                      </div>
                    );
                  })()}
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

        {/* Phim mới cập nhật */}
        {newMovies.length > 0 && (
          <SwiperSection
            title="Phim Mới Cập Nhật"
            color="#E50914"
            link="/movies"
            items={newMovies.slice(1, 16)}
            keyPrefix="new"
            delay={5000}
            onHoldChange={setIsCardHolding}
          />
        )}

        {chieuRap.length > 0 && <SwiperSection title="Phim Chiếu Rạp" color="#F59E0B" link="/genres?category=phim-chieu-rap" items={chieuRap} keyPrefix="chieurap" delay={4800} onHoldChange={setIsCardHolding} />}
        {series.length   > 0 && <SwiperSection title="Phim Bộ Nổi Bật"    color="#3B82F6" link="/series"                   items={series}   keyPrefix="series"   delay={6000} onHoldChange={setIsCardHolding} />}
        {hoatHinh.length > 0 && <SwiperSection title="Phim Hoạt Hình"      color="#10B981" link="/genres?genre=hoat-hinh"   items={hoatHinh} keyPrefix="hoathinh" delay={5500} onHoldChange={setIsCardHolding} />}
        {tvShows.length  > 0 && <SwiperSection title="Chương trình TV"      color="#8B5CF6" link="/genres?genre=tv-shows"    items={tvShows}  keyPrefix="tv"       delay={6500} onHoldChange={setIsCardHolding} />}
        {thaiLan.length  > 0 && <SwiperSection title="Phim Thái Lan"        color="#EC4899" link="/genres?country=thai-lan"  items={thaiLan}  keyPrefix="thai"     delay={4500} onHoldChange={setIsCardHolding} />}
        {hongKong.length > 0 && <SwiperSection title="Phim Hồng Kông"       color="#F59E0B" link="/genres?country=hong-kong" items={hongKong} keyPrefix="hk"       delay={5000} onHoldChange={setIsCardHolding} />}
        {auMy.length     > 0 && <SwiperSection title="Phim Âu Mỹ"           color="#3B82F6" link="/genres?country=au-my"    items={auMy}     keyPrefix="aumy"     delay={6000} onHoldChange={setIsCardHolding} />}
        {vietNam.length  > 0 && <SwiperSection title="Phim Việt Nam"        color="#EF4444" link="/genres?country=viet-nam" items={vietNam}  keyPrefix="vn"       delay={4000} onHoldChange={setIsCardHolding} />}
        {kinhDi.length   > 0 && <SwiperSection title="Phim Kinh Dị"         color="#6B7280" link="/genres?genre=kinh-di"    items={kinhDi}   keyPrefix="kinhdi"   delay={5500} onHoldChange={setIsCardHolding} />}
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
              {/* [BUG FIX] src không dùng || null (null không hợp lệ) */}
              <iframe
                src={currentTrailerUrl || undefined}
                title="Trailer"
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}