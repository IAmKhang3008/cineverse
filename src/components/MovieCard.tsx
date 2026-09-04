import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Heart, Film } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";
import { api, getImageUrl, extractBestPoster, searchTmdbWithCache } from "@/lib/api";
import { getMoviePoster } from "@/utils/imageUtils";
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

export default function MovieCard({ movie, fromSearch, onHoldChange, rating, priority }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [mobileActive, setMobileActive] = useState(false);
  const [imgError, setImgError] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 📌 STATE cho poster tối ưu
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(true); // cho skeleton

  const [tmdbTitle, setTmdbTitle] = useState(movie?.name);
  const [tmdbOriginName, setTmdbOriginName] = useState(movie?.origin_name);

  useEffect(() => {
    setTmdbTitle(movie?.name);
    setTmdbOriginName(movie?.origin_name);
  }, [movie?.name, movie?.origin_name]);

  // 🚀 TỐI ƯU: Primary: TMDB (w500) → Secondary (Fallback): phimapi.com
  useEffect(() => {
    if (!movie) return;

    let cancelled = false;

    const fetchBestPoster = async () => {
      setPosterLoading(true);
      setImgError(false);

      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

        // First verify using unified getMoviePoster if we have a TMDB candidate or existing TMDB url
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
              // Ignore foreign TMDB titles (Chinese, Thai, Korean, Japanese, etc.) and fallback to phimapi
              const hasForeignChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f]/.test(tmdbName);
              if (!hasForeignChars) {
                setTmdbTitle(tmdbName);
              }
            }
            if (combinedData.original_title || combinedData.original_name) {
              setTmdbOriginName(combinedData.original_title || combinedData.original_name);
            }
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

        // 3. SECONDARY (FALLBACK): phimapi.com images
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

        // 4. FINAL FALLBACK: phimapi.com poster_url / thumb_url
        if (!cancelled) {
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }

      } catch (err) {
        console.warn("MovieCard: TMDB poster fetch failed, using phimapi fallback", err);
        if (!cancelled) setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
      } finally {
        if (!cancelled) setPosterLoading(false);
      }
    };

    fetchBestPoster();

    return () => { cancelled = true; };
  }, [movie?.slug, movie?.poster_url, movie?.thumb_url, movie?.poster_path]); // fetch khi slug hoặc poster gốc thay đổi

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
        className="block w-full rounded-[12px] overflow-hidden aspect-[2/3] bg-[#121212] transition-transform duration-300 group-hover:scale-[1.05] shadow-[0_10px_20px_rgba(0,0,0,0.5)] relative border border-transparent"
        style={mobileActive ? { transform: 'scale(1.05)', boxShadow: '0 15px 30px rgba(229,9,20,0.3)' } : {}}
      >
        {finalPosterUrl ? (
          <img {...imgProps} />
        ) : (
          <div className={`w-full h-full bg-[#1A1A1A] flex flex-col items-center justify-center gap-2 select-none ${showSkeleton ? 'animate-pulse' : ''}`}>
            <Film className="w-12 h-12 text-gray-600 opacity-40" />
            <span className="text-[10px] text-gray-500 font-medium px-2 text-center uppercase tracking-wider line-clamp-1">
              {tmdbTitle || movie.name || ''}
            </span>
          </div>
        )}

        {movie.quality && (
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-white/10">
              {movie.quality}
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className={`
            w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#E50914]
            flex items-center justify-center
            shadow-[0_0_20px_rgba(229,9,20,0.5)]
            transition-all duration-300
            ${mobileActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}
          `}>
            <Play className="w-4 h-4 md:w-6 md:h-6 text-white ml-1" fill="currentColor" />
          </div>
        </div>

        <div className={`
          absolute bottom-3 left-3 z-20
          flex items-center gap-1
          bg-black/60 backdrop-blur-sm px-2 py-1 rounded
          border border-[#F5C518]/30
          transition-opacity duration-300
          ${mobileActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}>
          <Star className="w-3.5 h-3.5 text-[#F5C518]" fill="currentColor" />
          <span className="text-[#F5C518] font-bold text-xs">{ratingValue}</span>
        </div>

        <button
          onTouchEnd={e => { e.stopPropagation(); handleFavoriteClick(e); }}
          onClick={handleFavoriteClick}
          className={`
            absolute top-2 right-2 z-30
            p-2 rounded-full
            bg-black/60 backdrop-blur-sm border border-white/10
            hover:bg-[#E50914] hover:border-transparent
            transition-all duration-300
            ${mobileActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-white text-white' : 'text-white'}`} />
        </button>
      </Link>

      <div className="mt-3 px-1 text-center md:text-left w-full">
        <h3
          className="text-white font-heading font-semibold text-sm line-clamp-1 group-hover:text-[#E50914] transition-colors"
          style={mobileActive ? { color: '#E50914' } : {}}
          title={decodeHtml(tmdbTitle || movie.name || '')}
          dangerouslySetInnerHTML={{ __html: tmdbTitle || movie.name || '' }}
        />
        <p className="text-[#A0A0A0] text-xs mt-1 line-clamp-1 hidden md:block">
          {movie.year || 'N/A'} • {decodeHtml(tmdbOriginName || movie.origin_name || '')}
        </p>
        <p className="text-[#A0A0A0] text-xs mt-0.5 md:hidden">
          {movie.year || 'N/A'}
        </p>
      </div>
    </div>
  );
}
