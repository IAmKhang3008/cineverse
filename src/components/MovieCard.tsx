import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Heart, Film } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";
import { api, getImageUrl, extractBestPoster, searchTmdbWithCache } from "@/lib/api";
import { getMoviePoster, getMoviePosterSync } from "@/utils/imageUtils";
import { fetchWithCache, TTL } from "@/lib/cache";

const rewriteTMDBUrl = (url: string) => url;

interface MovieCardProps {
  movie: any;
  key?: React.Key;
  fromSearch?: boolean;
  onHoldChange?: (holding: boolean) => void;
  rating?: string;
  priority?: boolean;
}

export function MovieCard({ movie, fromSearch, onHoldChange, rating, priority }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [mobileActive, setMobileActive] = useState(false);
  const [imgError, setImgError] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 📌 TỐI ƯU: Khởi tạo posterUrl đồng bộ ngay từ đầu, 0ms, không nháy skeleton
  const initialPoster = useMemo(() => {
    if (!movie) return null;
    return getMoviePosterSync(
      movie.poster_path || movie.tmdb?.poster_path,
      movie.poster_url || movie.thumb_url
    );
  }, [movie?.poster_path, movie?.tmdb?.poster_path, movie?.poster_url, movie?.thumb_url]);

  const [posterUrl, setPosterUrl] = useState<string | null>(initialPoster);
  const [posterLoading, setPosterLoading] = useState(!initialPoster);

  const [tmdbTitle, setTmdbTitle] = useState(movie?.name);
  const [tmdbOriginName, setTmdbOriginName] = useState(movie?.origin_name);

  useEffect(() => {
    setTmdbTitle(movie?.name);
    setTmdbOriginName(movie?.origin_name);
    if (initialPoster) {
      setPosterUrl(initialPoster);
      setPosterLoading(false);
    }
  }, [movie?.name, movie?.origin_name, initialPoster]);

  // 🚀 TỐI ƯU CHO THIẾT BỊ YẾU:
  // - Nếu đã có poster TMDB chuẩn hoặc poster hợp lệ, không spam TMDB search đồng loạt
  // - Ưu tiên các thẻ visible/priority; các thẻ khác dùng requestIdleCallback
  useEffect(() => {
    if (!movie) return;

    // Nếu đã có poster TMDB sắc nét sẵn, không cần tìm kiếm TMDB trên thẻ thông thường
    const hasValidTmdbPoster = posterUrl && posterUrl.includes('image.tmdb.org/t/p/');
    if (hasValidTmdbPoster && !priority) return;

    let cancelled = false;
    let idleTimer: any = null;

    const fetchBestPoster = async () => {
      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

        // 1. Kiểm tra TMDB candidate hoặc poster_url có sẵn
        const tmdbCandidate = movie.poster_path || movie.tmdb?.poster_path;
        const isAlreadyTmdbUrl = movie.poster_url && movie.poster_url.includes('image.tmdb.org');
        
        if (tmdbCandidate || isAlreadyTmdbUrl) {
          const resolvedUrl = await getMoviePoster(
            tmdbCandidate,
            movie.name || movie.origin_name,
            movie.poster_url || movie.thumb_url
          );

          if (resolvedUrl && !cancelled) {
            setPosterUrl(resolvedUrl);
            setPosterLoading(false);
            return;
          }
        }

        // 2. PRIMARY: Tìm kiếm hoặc lấy chi tiết TMDB để extract best poster đồng bộ
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';

        if (!tmdbId && (movie.origin_name || movie.name)) {
          const searchResult = await searchTmdbWithCache(movie);
          if (searchResult) {
            tmdbId = searchResult.id;
            tmdbType = searchResult.media_type || (searchResult.first_air_date ? 'tv' : 'movie');
          }
        }

        if (tmdbId) {
          const combinedUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi&append_to_response=images&include_image_language=vi,en,null`;
          const combinedData = await fetchWithCache(`tmdb_combined_${tmdbType}_${tmdbId}`, () => fetch(rewriteTMDBUrl(combinedUrl)).then(r => r.json()), TTL.TMDB_STATIC);

          if (combinedData && !cancelled) {
            const tmdbName = combinedData.title || combinedData.name;
            if (tmdbName) {
              const hasForeignChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f]/.test(tmdbName);
              if (!hasForeignChars) {
                setTmdbTitle(tmdbName);
              }
            }
            if (combinedData.original_title || combinedData.original_name) {
              setTmdbOriginName(combinedData.original_title || combinedData.original_name);
            }
            
            const bestPoster = extractBestPoster(combinedData.images);
            if (bestPoster && !cancelled) {
              setPosterUrl(bestPoster);
              setPosterLoading(false);
              return;
            }
            if (combinedData.poster_path && !cancelled) {
              setPosterUrl(`https://image.tmdb.org/t/p/w500${combinedData.poster_path}`);
              setPosterLoading(false);
              return;
            }
          }
        }

        // 3. Fallback: phimapi.com images
        const imagesData = await api.getMovieImages(movie.slug).catch(() => null);
        if (imagesData?.images?.length > 0) {
          const basePosterUrl = imagesData.image_sizes?.poster?.w500 || "https://image.tmdb.org/t/p/w500";
          const posterImg = imagesData.images.find((img: any) => img.aspect_ratio && img.aspect_ratio < 1.0);
          if (posterImg && !cancelled) {
            setPosterUrl(getImageUrl(`${basePosterUrl}${posterImg.file_path}`, 'poster'));
            setPosterLoading(false);
            return;
          }
        }

        // 4. Final fallback
        if (!cancelled && !posterUrl) {
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }
      } catch (err) {
        if (!cancelled && !posterUrl) {
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }
      } finally {
        if (!cancelled) setPosterLoading(false);
      }
    };

    // Điều phối luồng xử lý: các thẻ ưu tiên chạy ngay; các thẻ khác chờ trình duyệt rảnh rỗi (idle)
    if (!priority) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleTimer = (window as any).requestIdleCallback(() => {
          if (!cancelled) fetchBestPoster();
        }, { timeout: 2500 });
      } else {
        idleTimer = setTimeout(() => {
          if (!cancelled) fetchBestPoster();
        }, 150);
      }
    } else {
      fetchBestPoster();
    }

    return () => {
      cancelled = true;
      if (idleTimer) {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(idleTimer);
        } else {
          clearTimeout(idleTimer);
        }
      }
    };
  }, [movie?.slug, movie?.poster_url, movie?.thumb_url, movie?.poster_path, priority]);

  // Hiệu ứng touch giữ nguyên
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

  // Cuối cùng, hiển thị poster hoặc skeleton/fallback
  const showSkeleton = posterLoading || (!posterUrl && !imgError);
  const finalPosterUrl = !imgError ? posterUrl : null;

  const ratingValue = rating
    || (movie?.tmdb?.vote_average && movie.tmdb.vote_average > 0
        ? movie.tmdb.vote_average.toFixed(1)
        : null)
    || 'N/A';

  const imgProps: any = {
    src: finalPosterUrl || undefined,
    alt: tmdbTitle || movie.name || '',
    className: "w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40 movie-poster",
    style: mobileActive ? { opacity: 0.4 } : {},
    decoding: "async",
    draggable: false,
    referrerPolicy: "no-referrer",
    onError: () => setImgError(true)
  };

  if (priority) {
    imgProps.fetchPriority = "high";
    imgProps.loading = "eager";
  } else {
    imgProps.loading = "lazy";
  }

  if (finalPosterUrl && finalPosterUrl.includes('image.tmdb.org/t/p/')) {
    const basePath = finalPosterUrl.substring(finalPosterUrl.lastIndexOf('/'));
    imgProps.srcSet = `https://image.tmdb.org/t/p/w185${basePath} 185w, https://image.tmdb.org/t/p/w342${basePath} 342w, https://image.tmdb.org/t/p/w500${basePath} 500w`;
    imgProps.sizes = "(max-width: 400px) 185px, (max-width: 768px) 342px, 500px";
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
        // Speculative prefetch for higher resolution poster image when hovering
        if (finalPosterUrl && finalPosterUrl.includes('image.tmdb.org/t/p/')) {
          const basePath = finalPosterUrl.substring(finalPosterUrl.lastIndexOf('/'));
          const img = new Image();
          img.src = `https://image.tmdb.org/t/p/w780${basePath}`;
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

        {/* Rating Badge */}
        {ratingValue !== 'N/A' && (
          <div className={`
            absolute bottom-2.5 left-2.5 z-20
            flex items-center gap-1
            bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md
            border border-[#F5C518]/30 shadow-md
            transition-opacity duration-300
            ${mobileActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}
          `}>
            <Star className="w-3 h-3 text-[#F5C518]" fill="currentColor" />
            <span className="text-[#F5C518] font-extrabold text-[11px]">{ratingValue}</span>
          </div>
        )}

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
