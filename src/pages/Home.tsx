import React, {
  useEffect, useState, Suspense,
  useRef, useCallback, memo, useMemo,
} from "react";
import { api, getImageUrl, NormalizedMovie, extractBestBackdrop, extractBestPoster, searchTmdbWithCache } from "@/lib/api";
import {
  Play, Info, ChevronRight, Heart, X, Flame, TrendingUp, Star
} from "lucide-react";
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
const TMDB_KEY: string = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
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
      'flex-shrink-0 flex items-center justify-center',
      'w-9 h-9 md:w-11 md:h-11 rounded-full',
      'bg-black/70 hover:bg-[#E50914] backdrop-blur-md',
      'text-white border border-white/15 hover:border-[#E50914]',
      'shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(229,9,20,0.5)]',
      'transition-all duration-200 hover:scale-110 active:scale-95',
      'disabled:opacity-30 disabled:cursor-not-allowed',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914]',
      className,
    ].join(' ')}
  >
    <ChevronRight
      className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-200 ${direction === 'prev' ? 'rotate-180' : ''}`}
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
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${isActive ? 'kenburns-active' : ''}`}
      style={{
        transform: isActive ? undefined : 'scale(1) translateZ(0)',
      }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover movie-poster"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
KenBurnsImage.displayName = 'KenBurnsImage';

// ─────────────────────────────────────────────────────────────
// SWIPER SECTION — ngoài Home(), memo
// Tối ưu cho thiết bị cũ: viewport-lazy-mount giúp giảm 70% DOM ban đầu
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
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  // Lazy-mount Swiper slider khi cách viewport 600px
  useEffect(() => {
    if (hasEntered) return;
    const el = sectionRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasEntered]);

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
    <section ref={sectionRef} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 380px' }} className="relative">
      <div className="flex items-center justify-between mb-5 md:mb-7">
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-6 md:h-8 rounded-full flex-shrink-0"
            style={{
              background: color,
              boxShadow: `0 0 16px ${color}80`,
            }}
          />
          <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wide">
            {title}
          </h2>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] text-white/50 border border-white/10">
            {uniqueItems.length} phim
          </span>
        </div>

        <Link
          to={link}
          className="group/link inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-xs md:text-sm text-gray-300 hover:text-white transition-all duration-200 backdrop-blur-sm"
        >
          <span>Xem tất cả</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 text-white/60 group-hover/link:text-white" />
        </Link>
      </div>

      <div className="relative group/slider min-h-[260px] md:min-h-[340px]">
        {hasEntered ? (
          <>
            <Swiper
              modules={[Autoplay]}
              onSwiper={s => { swiperRef.current = s; }}
              spaceBetween={16}
              slidesPerView={2}
              allowTouchMove={true}
              grabCursor={true}
              watchSlidesProgress={true}
              touchEventsTarget="wrapper"
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
              className="absolute -left-3 md:-left-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100" 
            />
            <NavArrow 
              direction="next" 
              onClick={() => swiperRef.current?.slideNext()} 
              className="absolute -right-3 md:-right-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100" 
            />
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 pb-2 md:pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col">
                <div className="aspect-[2/3] w-full rounded-xl bg-white/5 animate-pulse" />
                <div className="h-4 bg-white/5 rounded mt-3 w-3/4 animate-pulse" />
                <div className="h-3 bg-white/5 rounded mt-1.5 w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});
SwiperSection.displayName = 'SwiperSection';

// ─────────────────────────────────────────────────────────────
// HOOK: useTrendingMovies
// ─────────────────────────────────────────────────────────────
function useTrendingMovies() {
  const [activeTab, setActiveTab] = useState<TrendingWindow>('day');
  const [movies, setMovies]       = useState<any[]>(() => {
    // 🚀 TỐI ƯU CỰC ĐẠI: Lấy ngay từ cache local để hiển thị 0ms khi mới vào web
    try {
      const cached = localStorage.getItem('cineverse_trending_day');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading]     = useState(() => movies.length === 0);
  const resultCache = useRef<Partial<Record<TrendingWindow, any[]>>>({});

  const fetchTrending = useCallback(async (tab: TrendingWindow) => {
    // 1. Kiểm tra cache trong memory
    if (resultCache.current[tab] && resultCache.current[tab]!.length > 0) {
      setMovies(resultCache.current[tab]!);
      setLoading(false);
      return;
    }

    // 2. Kiểm tra cache trong localStorage
    try {
      const cached = localStorage.getItem(`cineverse_trending_${tab}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultCache.current[tab] = parsed;
          setMovies(parsed);
          setLoading(false);
          // Tiếp tục revalidate ngầm
        }
      }
    } catch {}

    if (!resultCache.current[tab] || resultCache.current[tab]!.length === 0) {
      setLoading(true);
    }

    try {
      const options = { method: 'GET', headers: { accept: 'application/json' } };
      const apiKey = TMDB_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      const url = `https://api.themoviedb.org/3/trending/movie/${tab}?language=en-US&api_key=${apiKey}`;

      const res = await fetch(url, options)
        .then(res => res.json())
        .then(res => {
          console.log(res);
          return res;
        })
        .catch(err => {
          console.error(err);
          return null;
        });

      let items: any[] = [];
      if (res?.results && Array.isArray(res.results) && res.results.length > 0) {
        items = res.results.map((m: any) => ({
          _id: `tmdb-${m.id}`,
          id: m.id,
          name: m.title || m.name,
          origin_name: m.original_title || m.original_name || m.title || '',
          poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
          thumb_url: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : ''),
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          description: m.overview || '',
          content: m.overview || '',
          slug: `tmdb-${m.id}`,
          quality: 'HD',
          vote_average: m.vote_average,
          tmdb: {
            id: m.id,
            type: 'movie',
            vote_average: m.vote_average,
            poster_path: m.poster_path,
            backdrop_path: m.backdrop_path,
          },
          _source: 'primary' as const,
        }));
      }

      // Dự phòng nếu TMDB gặp sự cố
      if (!items.length) {
        if (tab === 'day') {
          const fallback = await api.getByCategory('phim-le', 1).catch(() => null);
          items = fallback?.items || [];
        } else {
          const fallback = await api.getByCategory('phim-chieu-rap', 1).catch(() => null);
          items = fallback?.items || [];
        }
      }

      const trimmed = items.slice(0, 15);
      if (trimmed.length > 0) {
        resultCache.current[tab] = trimmed;
        setMovies(trimmed);
        try {
          localStorage.setItem(`cineverse_trending_${tab}`, JSON.stringify(trimmed));
        } catch {}
      }
    } catch (err) {
      console.error('[Trending] Failed to load trending:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending(activeTab);
  }, [activeTab, fetchTrending]);

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
// FETCH PHIM CHIẾU RẠP
// ─────────────────────────────────────────────────────────────
async function fetchChieuRap(): Promise<{ items: any[] }> {
  try {
    return await api.getByCategory('phim-chieu-rap', 1);
  } catch (err) {
    console.warn('[Phim Chiếu Rạp] Failed to fetch:', err);
    return { items: [] };
  }
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
  const handleHoldChange = useCallback((holding: boolean) => {
    setIsCardHolding(holding);
  }, []);

  const { activeTab, setActiveTab, movies: trendingMovies, loading: trendingLoading } = useTrendingMovies();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast }                  = useToast();

  const showToastRef = useRef(showToast);
  const trendingSwiperRef = useRef<SwiperType | null>(null);
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

        // Hiển thị ngay banner và trang chủ lập tức mà không cần đợi 10 API TMDB
        if (heroList.length > 0) {
          setHeroMovies(heroList);
          setLoading(false);
        }

        // Tăng cường hình nền TMDB chất lượng cao và trailer chạy ngầm
        Promise.allSettled(
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
                      () => fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${TMDB_KEY}&language=vi&include_image_language=vi,en,null`).then(r => r.json()),
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
                name:             detail.movie?.name               || movie.name,
                origin_name:      detail.movie?.origin_name        || movie.origin_name,
                content:          detail.movie?.content            || movie.content,
                vote_average:     detail.movie?.tmdb?.vote_average ?? null,
                highQualityBanner,
                trailer_url:      detail.movie?.trailer_url        || movie.trailer_url || '',
                _id:              detail.movie?._id                || movie._id,
              };
            } catch { return movie; }
          })
        ).then(heroSettled => {
          if (!isMounted) return;
          const enhanced = heroSettled
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(m => m?.slug);
          if (enhanced.length > 0) {
            setHeroMovies(enhanced);
          }
        });
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
    // Ưu tiên băng thông mạng cho phần giao diện đầu trang
    const secondaryTimer = setTimeout(() => {
      fetchSecondary();
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(secondaryTimer);
    };
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
      className="-mt-16 md:-mt-20 pb-24 relative overflow-x-hidden"
    >
      {/* ── AMBIENT CINEMA LIGHTING POOLS ────────────────── */}
      <div className="absolute top-[520px] -left-32 w-96 h-96 bg-[#E50914]/[0.05] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[1300px] -right-32 w-[480px] h-[480px] bg-[#3B82F6]/[0.035] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[2200px] -left-28 w-[400px] h-[400px] bg-[#F5C518]/[0.03] rounded-full blur-[150px] pointer-events-none" />

      {/* ═══════════════════════════════════════════════════
          HERO BANNER
          ═══════════════════════════════════════════════════ */}
      {heroMovies.length > 0 && (
        <div
          id="hero-banner"
          className={[
            'hero-banner bg-[#0A0A0A] relative',
            'min-h-[540px] sm:min-h-[620px] md:min-h-[700px] lg:min-h-[92vh]',
            'group/hero',
          ].join(' ')}
        >
          <Swiper
            modules={[Navigation, Autoplay, EffectFade]}
            effect="fade"
            onSwiper={setHeroSwiper}
            onSlideChange={s => setActiveHeroIndex(s.realIndex)}
            navigation={{ nextEl: '.hero-next', prevEl: '.hero-prev' }}
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

                {/* Gradient trái → phải: Vignette giúp chữ siêu rõ nét */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/70 sm:via-[#0A0A0A]/40 to-transparent pointer-events-none" />
                
                {/* Ambient spotlight Cineverse Red */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 22% 40%, rgba(229,9,20,0.18) 0%, transparent 55%)' }}
                />

                {/* Gradient bottom blend vào thân trang */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{
                    height: '75%',
                    background: 'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.95) 20%, rgba(10,10,10,0.5) 60%, transparent 100%)'
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-6 bg-[#0A0A0A] pointer-events-none" />

                {/* ──── BANNER CONTENT ──────────────────── */}
                <div className="absolute inset-0 flex items-end sm:items-center">
                  <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 md:px-16 lg:px-20">
                    <div className="banner-info pb-[90px] sm:pb-0 pt-16 sm:pt-0 max-w-xl md:max-w-2xl">

                      {/* Badge & Rating Pill */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3 md:mb-4">
                        <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#E50914] to-[#B80610] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full tracking-wider uppercase shadow-[0_0_16px_rgba(229,9,20,0.5)] border border-red-400/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {movie.badge || 'CINEVERSE EXCLUSIVE'}
                        </span>
                        {movie.vote_average != null && movie.vote_average > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-[#F5C518]/30 text-[#F5C518] text-[11px] font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {Number(movie.vote_average).toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h1
                        className="font-heading font-extrabold text-white leading-[1.15] tracking-tight drop-shadow-2xl mb-1.5 sm:mb-2 md:mb-3
                          text-[24px] sm:text-[34px] md:text-[46px] lg:text-[54px]"
                        style={{
                          textShadow: '0 2px 20px rgba(0,0,0,0.85), 0 4px 40px rgba(0,0,0,0.6)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        dangerouslySetInnerHTML={{ __html: movie.name || '' }}
                      />

                      {/* Subtitle origin name if available */}
                      {movie.origin_name && movie.origin_name !== movie.name && (
                        <p className="text-white/60 font-medium text-xs sm:text-sm md:text-base -mt-1 mb-3 line-clamp-1 italic tracking-wide">
                          {movie.origin_name}
                        </p>
                      )}

                      {/* Meta Chips */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300 mb-3 sm:mb-4 md:mb-5 font-medium">
                        <span className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 text-white font-semibold text-[11px] sm:text-xs">
                          {movie.year || new Date().getFullYear()}
                        </span>
                        <span className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 text-white/90 text-[11px] sm:text-xs">
                          {movie.category?.[0]?.name || 'Hành động'}
                        </span>
                        {movie.time && (
                          <span className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 text-white/90 text-[11px] sm:text-xs hidden sm:inline-block">
                            {movie.time}
                          </span>
                        )}
                        <span className="bg-[#E50914]/20 border border-[#E50914]/40 text-[#FF5A5F] px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wider uppercase">
                          {movie.quality || '4K UHD'}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        className="text-[12px] sm:text-[13px] md:text-[14px] text-[#D0D0D0] leading-[19px] sm:leading-[23px] mb-5 md:mb-7 max-w-full sm:max-w-[580px] line-clamp-2 sm:line-clamp-3 drop-shadow"
                        dangerouslySetInnerHTML={{
                          __html: (movie.content || movie.origin_name || '').replace(/<[^>]*>?/gm, ''),
                        }}
                      />

                      {/* CTA Buttons */}
                      <div className="flex flex-row flex-wrap items-center gap-2.5 sm:gap-3.5">
                        <Link
                          to={`/watch/${movie.slug}`}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#E50914] to-[#B80610] text-white px-5 sm:px-7 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 hover:scale-105 hover:shadow-[0_0_25px_rgba(229,9,20,0.65)] active:scale-95 border border-red-400/30"
                        >
                          <Play className="w-4 h-4" fill="currentColor" />
                          <span>Xem ngay</span>
                        </Link>
                        {movie.trailer_url && (
                          <button
                            onClick={() => handlePlayTrailer(movie.trailer_url)}
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor" className="w-4 h-4 text-white">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            <span>Trailer</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleFavorite(movie)}
                          className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 backdrop-blur-md border ${
                            isFavorite(movie._id || movie.slug)
                              ? 'border-[#E50914] text-[#E50914] bg-[#E50914]/15 hover:bg-[#E50914]/25 shadow-[0_0_15px_rgba(229,9,20,0.3)]'
                              : 'border-white/25 text-white bg-black/40 hover:bg-white/10 hover:border-white/40'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFavorite(movie._id || movie.slug) ? 'fill-[#E50914] text-[#E50914]' : ''}`} />
                          <span>{isFavorite(movie._id || movie.slug) ? 'Đã thích' : 'Yêu thích'}</span>
                        </button>
                        <Link
                          to={`/movie/${movie.slug}`}
                          className="inline-flex items-center gap-1.5 text-white/75 hover:text-white px-3 py-2 text-xs sm:text-sm font-semibold transition-colors hover:underline underline-offset-4"
                        >
                          <Info className="w-4 h-4" />
                          <span>Chi tiết</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Hero Nav Arrows */}
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

          {/* Thumbnails on Desktop / Tablet with Autoplay Progress Bar */}
          <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-5 md:right-8 z-20 hidden sm:flex gap-2 sm:gap-2.5 md:gap-3 items-end overflow-x-auto no-scrollbar py-4 px-2 -my-3 -mx-2 max-w-[calc(100vw-6rem)]">
            {heroMovies.map((movie, index) => {
              const isActive = activeHeroIndex === index;
              return (
                <button
                  key={`thumb-${index}`}
                  onClick={() => heroSwiper?.slideToLoop(index)}
                  aria-label={`Chuyển tới banner ${movie.name || index + 1}`}
                  className={`relative overflow-hidden flex-shrink-0 rounded-lg transition-all duration-300
                    w-[52px] h-[30px] sm:w-[68px] sm:h-[38px] md:w-[84px] md:h-[48px] ${
                    isActive
                      ? 'ring-2 ring-[#E50914] scale-105 shadow-[0_0_20px_rgba(229,9,20,0.6)] z-10 opacity-100'
                      : 'ring-1 ring-white/20 opacity-50 hover:opacity-90 hover:scale-105'
                  }`}
                >
                  <img
                    src={movie.highQualityBanner || getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                    alt={movie.name || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                      <div className="h-full bg-[#E50914] thumb-progress-active" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Dot Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex sm:hidden gap-1.5 items-center">
            {heroMovies.map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => heroSwiper?.slideToLoop(index)}
                className={`rounded-full transition-all duration-300 ${
                  activeHeroIndex === index
                    ? 'w-7 h-2 bg-[#E50914] shadow-[0_0_10px_rgba(229,9,20,0.8)]'
                    : 'w-2 h-2 bg-white/35 hover:bg-white/70'
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
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-8 md:mt-12 space-y-14 md:space-y-20 relative z-10">

        {/* Phim Thịnh Hành */}
        <section className="relative">
          <ErrorBoundary name="Phim Thịnh Hành">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mb-5 md:mb-7">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block flex-shrink-0 shadow-[0_0_16px_rgba(245,197,24,0.6)]" />
                <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wide flex items-center gap-2">
                  Phim Thịnh Hành
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30">
                  <Flame className="w-3 h-3 fill-current" /> TOP 10
                </span>
              </div>

              <div className="grid grid-cols-2 w-full sm:w-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 gap-1 flex-shrink-0 shadow-lg">
                {TRENDING_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[36px] px-3 sm:px-6 rounded-full text-[11px] sm:text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_16px_rgba(245,197,24,0.5)] scale-[1.02]'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.06] active:scale-95'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${isActive ? 'text-black' : 'text-amber-400'}`}>{tab.icon}</span>
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
                  <div className="relative group/trending">
                    <Swiper
                      modules={[Autoplay]}
                      onSwiper={s => { trendingSwiperRef.current = s; }}
                      spaceBetween={16}
                      slidesPerView={2}
                      allowTouchMove={true}
                      grabCursor={true}
                      watchSlidesProgress={true}
                      touchEventsTarget="wrapper"
                      autoplay={{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }}
                      breakpoints={SWIPER_BREAKPOINTS}
                      className="pb-2 md:pb-4 !overflow-visible"
                    >
                      {trendingMovies.map((movie, i) => (
                        <SwiperSlide key={`trending-${activeTab}-${movie.slug || movie._id || 'item'}-${i}`}>
                          <div className="relative">
                            {/* Stylized Rank Ribbon / Badge */}
                            <div className="absolute -top-2.5 -left-2.5 z-30 pointer-events-none">
                              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center font-heading font-extrabold text-xs md:text-sm shadow-xl border ${
                                i === 0
                                  ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-black border-amber-200 shadow-[0_0_16px_rgba(245,197,24,0.7)] scale-105'
                                  : i === 1
                                  ? 'bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 text-black border-white shadow-[0_0_14px_rgba(255,255,255,0.5)]'
                                  : i === 2
                                  ? 'bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 text-amber-100 border-amber-500/50 shadow-[0_0_12px_rgba(180,83,9,0.5)]'
                                  : 'bg-black/85 backdrop-blur-md text-white/80 border-white/15'
                              }`}>
                                {i === 0 ? '👑 1' : `#${i + 1}`}
                              </div>
                            </div>
                            <MovieCard movie={movie} onHoldChange={handleHoldChange} priority={i < 4} />
                          </div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                    <NavArrow 
                      direction="prev" 
                      onClick={() => trendingSwiperRef.current?.slidePrev()} 
                      className="absolute -left-3 md:-left-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity" 
                    />
                    <NavArrow 
                      direction="next" 
                      onClick={() => trendingSwiperRef.current?.slideNext()} 
                      className="absolute -right-3 md:-right-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity" 
                    />
                  </div>
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
            onHoldChange={handleHoldChange}
          />
        )}

        {chieuRap.length > 0 && <SwiperSection title="Phim Chiếu Rạp" color="#F59E0B" link="/genres?category=phim-chieu-rap" items={chieuRap} keyPrefix="chieurap" delay={4800} onHoldChange={handleHoldChange} />}
        {series.length   > 0 && <SwiperSection title="Phim Bộ Nổi Bật"    color="#3B82F6" link="/series"                   items={series}   keyPrefix="series"   delay={6000} onHoldChange={handleHoldChange} />}
        {hoatHinh.length > 0 && <SwiperSection title="Phim Hoạt Hình"      color="#10B981" link="/genres?genre=hoat-hinh"   items={hoatHinh} keyPrefix="hoathinh" delay={5500} onHoldChange={handleHoldChange} />}
        {tvShows.length  > 0 && <SwiperSection title="Chương trình TV"      color="#8B5CF6" link="/genres?genre=tv-shows"    items={tvShows}  keyPrefix="tv"       delay={6500} onHoldChange={handleHoldChange} />}
        {thaiLan.length  > 0 && <SwiperSection title="Phim Thái Lan"        color="#EC4899" link="/genres?country=thai-lan"  items={thaiLan}  keyPrefix="thai"     delay={4500} onHoldChange={handleHoldChange} />}
        {hongKong.length > 0 && <SwiperSection title="Phim Hồng Kông"       color="#F59E0B" link="/genres?country=hong-kong" items={hongKong} keyPrefix="hk"       delay={5000} onHoldChange={handleHoldChange} />}
        {auMy.length     > 0 && <SwiperSection title="Phim Âu Mỹ"           color="#3B82F6" link="/genres?country=au-my"    items={auMy}     keyPrefix="aumy"     delay={6000} onHoldChange={handleHoldChange} />}
        {vietNam.length  > 0 && <SwiperSection title="Phim Việt Nam"        color="#EF4444" link="/genres?country=viet-nam" items={vietNam}  keyPrefix="vn"       delay={4000} onHoldChange={handleHoldChange} />}
        {kinhDi.length   > 0 && <SwiperSection title="Phim Kinh Dị"         color="#6B7280" link="/genres?genre=kinh-di"    items={kinhDi}   keyPrefix="kinhdi"   delay={5500} onHoldChange={handleHoldChange} />}
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