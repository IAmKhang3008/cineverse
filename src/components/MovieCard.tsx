import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Heart, Film } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";
import { getImageUrl } from "@/lib/api";
import { getMoviePosterSync, markPosterUrlFailed, LOCAL_PLACEHOLDER } from "@/utils/imageUtils";

// Bộ nhớ đệm toàn cục ghi nhận các URL ảnh đã tải thành công để hiển thị tức thì 0ms, không nhấp nháy
const loadedImages = new Set<string>();

interface MovieCardProps {
  movie: any;
  key?: React.Key;
  fromSearch?: boolean;
  onHoldChange?: (holding: boolean) => void;
  rating?: string;
  priority?: boolean;
}

export function MovieCard({ movie, fromSearch, onHoldChange, priority }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [mobileActive, setMobileActive] = useState(false);
  const [imgError, setImgError] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🚀 TỐI ƯU CỰC ĐẠI: Trích xuất poster đồng bộ 0ms, kích thước w342 siêu nhẹ, tải nhanh gấp 4 lần
  const initialPoster = useMemo(() => {
    if (!movie) return null;
    return getMoviePosterSync(
      movie.poster_path || movie.tmdb?.poster_path,
      movie.poster_url || movie.thumb_url,
      'w342'
    );
  }, [movie?.poster_path, movie?.tmdb?.poster_path, movie?.poster_url, movie?.thumb_url]);

  const [posterUrl, setPosterUrl] = useState<string | null>(initialPoster);
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    return initialPoster ? loadedImages.has(initialPoster) : false;
  });

  const tmdbTitle = movie?.name;
  const tmdbOriginName = movie?.origin_name;

  useEffect(() => {
    if (initialPoster) {
      setPosterUrl(initialPoster);
      if (loadedImages.has(initialPoster)) {
        setIsLoaded(true);
      }
    }
  }, [initialPoster]);

  // Touch event handlers
  const setActive = useCallback((val: boolean) => {
    setMobileActive(val);
    onHoldChange?.(val);
  }, [onHoldChange]);

  const handleTouchStart = useCallback(() => {
    holdTimerRef.current = setTimeout(() => setActive(true), 200);
  }, [setActive]);

  const handleTouchEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setActive(false);
  }, [setActive]);

  const handleTouchMove = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (mobileActive) setActive(false);
  }, [mobileActive, setActive]);

  if (!movie) return null;

  const handleFavoriteClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = toggleFavorite(movie);
    if (!success) {
      showToast('Bạn cần đăng nhập để thêm phim vào yêu thích!', 'error');
      return;
    }
    showToast(
      favorite ? 'Đã xóa khỏi danh sách yêu thích' : 'Đã thêm vào danh sách yêu thích',
      favorite ? 'info' : 'success',
    );
    setActive(false);
  };

  const finalPosterUrl = (!imgError && posterUrl && posterUrl !== LOCAL_PLACEHOLDER) ? posterUrl : null;
  const showSkeleton = !finalPosterUrl && !imgError;

  const imgProps: any = {
    src: finalPosterUrl || undefined,
    alt: tmdbTitle || movie.name || '',
    className: `w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-40 movie-poster ${
      isLoaded ? 'opacity-100' : 'opacity-90'
    }`,
    style: mobileActive ? { opacity: 0.4 } : {},
    decoding: "async",
    draggable: false,
    referrerPolicy: "no-referrer",
    onLoad: () => {
      if (finalPosterUrl) loadedImages.add(finalPosterUrl);
      setIsLoaded(true);
    },
    onError: () => {
      if (finalPosterUrl) markPosterUrlFailed(finalPosterUrl);
      const fallback = getImageUrl(movie.poster_url || movie.thumb_url, 'poster');
      if (fallback && posterUrl !== fallback && !fallback.includes('placehold.co')) {
        setPosterUrl(fallback);
      } else {
        setImgError(true);
      }
    }
  };

  if (priority) {
    imgProps.fetchPriority = "high";
    imgProps.loading = "eager";
  } else {
    imgProps.loading = "lazy";
    imgProps.fetchPriority = "low";
  }

  // Tối ưu srcSet responsive theo kích thước thực tế của thẻ (w185 trên mobile, w342 trên tablet/desktop)
  if (finalPosterUrl && finalPosterUrl.includes('image.tmdb.org/t/p/')) {
    const basePath = finalPosterUrl.substring(finalPosterUrl.lastIndexOf('/'));
    imgProps.srcSet = `https://image.tmdb.org/t/p/w185${basePath} 185w, https://image.tmdb.org/t/p/w342${basePath} 342w, https://image.tmdb.org/t/p/w500${basePath} 500w`;
    imgProps.sizes = "(max-width: 480px) 185px, (max-width: 1024px) 342px, 500px";
  }

  return (
    <div
      className="group relative block w-full flex flex-col items-center md:items-start select-none movie-card-content"
      style={{
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: mobileActive ? 'none' : 'auto',
        contain: 'layout style paint'
      }}
      onMouseEnter={() => {
        // Tải trước bản phân giải cao hơn khi người dùng hover
        if (finalPosterUrl && finalPosterUrl.includes('image.tmdb.org/t/p/')) {
          const basePath = finalPosterUrl.substring(finalPosterUrl.lastIndexOf('/'));
          const img = new Image();
          img.src = `https://image.tmdb.org/t/p/w500${basePath}`;
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <Link
        to={`/movie/${movie.slug}`}
        state={fromSearch ? { fromSearch: true } : undefined}
        onClick={e => { if (mobileActive) e.preventDefault(); }}
        className="block w-full rounded-2xl overflow-hidden aspect-[2/3] bg-[#141414] transition-all duration-300 group-hover:scale-[1.04] shadow-[0_8px_24px_rgba(0,0,0,0.6)] group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.85)] relative border border-white/[0.07] group-hover:border-white/20"
        style={mobileActive ? { transform: 'scale(1.04)', boxShadow: '0 16px 36px rgba(229,9,20,0.35)', borderColor: 'rgba(229,9,20,0.5)' } : {}}
      >
        {finalPosterUrl ? (
          <img {...imgProps} />
        ) : (
          <div className={`w-full h-full bg-[#161616] flex flex-col items-center justify-center gap-2 select-none ${showSkeleton ? 'animate-pulse' : ''}`}>
            <Film className="w-10 h-10 text-white/20" />
            <span className="text-[10px] text-white/40 font-medium px-2 text-center uppercase tracking-wider line-clamp-1">
              {tmdbTitle || movie.name || ''}
            </span>
          </div>
        )}

        {/* Poster Bottom Subtle Gradient for depth */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none opacity-80 group-hover:opacity-95 transition-opacity" />

        {/* Quality Badge */}
        {movie.quality && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="bg-black/70 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border border-white/15 shadow-md">
              {movie.quality}
            </span>
          </div>
        )}

        {/* Play Icon in Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className={`
            w-11 h-11 md:w-13 md:h-13 rounded-full bg-[#E50914]
            flex items-center justify-center
            shadow-[0_0_24px_rgba(229,9,20,0.65)]
            transition-all duration-300
            border border-white/20
            ${mobileActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}
          `}>
            <Play className="w-4 h-4 md:w-5 md:h-5 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onTouchEnd={e => { e.stopPropagation(); handleFavoriteClick(e); }}
          onClick={handleFavoriteClick}
          aria-label={favorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          className={`
            absolute top-2.5 right-2.5 z-30
            p-2 rounded-full
            bg-black/70 backdrop-blur-md border border-white/15
            hover:bg-[#E50914] hover:border-[#E50914]
            transition-all duration-300 shadow-md active:scale-90
            ${mobileActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
        >
          <Heart className={`w-3.5 h-3.5 ${favorite ? 'fill-white text-white' : 'text-white'}`} />
        </button>
      </Link>

      {/* Movie Meta Information */}
      <div className="mt-2.5 px-0.5 text-center md:text-left w-full">
        <h3
          className="text-white/95 font-heading font-semibold text-xs sm:text-sm line-clamp-1 group-hover:text-[#E50914] transition-colors"
          style={mobileActive ? { color: '#E50914' } : {}}
          title={decodeHtml(tmdbTitle || movie.name || '')}
          dangerouslySetInnerHTML={{ __html: tmdbTitle || movie.name || '' }}
        />
        <div className="flex items-center justify-center md:justify-start gap-1.5 text-white/45 text-[11px] sm:text-xs mt-1 line-clamp-1">
          <span className="font-medium text-white/60">{movie.year || 'N/A'}</span>
          {(tmdbOriginName || movie.origin_name) && (
            <>
              <span>•</span>
              <span className="truncate italic">{decodeHtml(tmdbOriginName || movie.origin_name || '')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(MovieCard);
