import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Heart, Film } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";
import { api, getImageUrl } from "@/lib/api";
import { fetchWithCache, TTL } from "@/lib/cache";

const rewriteTMDBUrl = (url: string) => url;

interface MovieCardProps {
  movie: any;
  key?: React.Key;
  fromSearch?: boolean;
  onHoldChange?: (holding: boolean) => void;
  rating?: string;
}

export default function MovieCard({ movie, fromSearch, onHoldChange, rating }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [mobileActive, setMobileActive] = useState(false);
  const [imgError, setImgError] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 📌 STATE cho poster tối ưu
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(true); // cho skeleton

  // 🚀 TỐI ƯU: Fetch poster chất lượng cao từ phimapi → TMDb
  useEffect(() => {
    if (!movie) return;

    let cancelled = false;

    const fetchBestPoster = async () => {
      setPosterLoading(true);
      setImgError(false);

      try {
        // 1. Thử lấy ảnh từ phimapi images trước
        const imagesData = await api.getMovieImages(movie.slug).catch(() => null);

        if (imagesData?.images?.length > 0) {
          const basePosterUrl = imagesData.image_sizes?.poster?.w500 || "https://image.tmdb.org/t/p/w500";
          // Tìm poster đầu tiên có aspect ratio < 1.0 (ảnh dọc)
          const posterImg = imagesData.images.find((img: any) => img.aspect_ratio && img.aspect_ratio < 1.0);
          if (posterImg && !cancelled) {
            setPosterUrl(getImageUrl(`${basePosterUrl}${posterImg.file_path}`, 'poster'));
            setPosterLoading(false);
            return;
          }
        }

        // 2. Fallback: Tìm TMDB ID rồi gọi API kết hợp lấy ảnh
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';

        if (!tmdbId && (movie.origin_name || movie.name)) {
          const yearQuery = movie.year ? `&year=${movie.year}` : '';
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.origin_name || movie.name)}${yearQuery}&language=vi-VN`;
          const searchData = await fetchWithCache(`tmdb_search_${movie.slug}`, () => fetch(rewriteTMDBUrl(searchUrl)).then(r => r.json()), TTL.TMDB_STATIC);
          if (searchData.results?.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (tmdbId) {
          const combinedUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN&append_to_response=images&include_image_language=en,null,vi`;
          const combinedData = await fetchWithCache(`tmdb_combined_${tmdbType}_${tmdbId}`, () => fetch(rewriteTMDBUrl(combinedUrl)).then(r => r.json()), TTL.TMDB_STATIC);

          const posters = combinedData.images?.posters;
          if (posters?.length > 0 && !cancelled) {
            // Ưu tiên poster có vote_count cao nhất (chất lượng)
            const bestPoster = posters.sort((a: any, b: any) => b.vote_count - a.vote_count)[0];
            setPosterUrl(getImageUrl(`https://image.tmdb.org/t/p/w500${bestPoster.file_path}`, 'poster'));
            setPosterLoading(false);
            return;
          }
        }

        // 3. Không tìm được poster mới, fallback về poster_url gốc
        if (!cancelled) {
          setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
        }

      } catch (err) {
        console.warn("MovieCard: failed to fetch high-quality poster, using original", err);
        if (!cancelled) setPosterUrl(getImageUrl(movie.poster_url || movie.thumb_url, 'poster'));
      } finally {
        if (!cancelled) setPosterLoading(false);
      }
    };

    fetchBestPoster();

    return () => { cancelled = true; };
  }, [movie?.slug, movie?.poster_url, movie?.thumb_url]); // fetch khi slug hoặc poster gốc thay đổi

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

  return (
    <div
      className="group relative block w-full flex flex-col items-center md:items-start select-none movie-card-content"
      style={{
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: mobileActive ? 'none' : 'auto',
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
        className="block w-full rounded-[12px] overflow-hidden aspect-[2/3] bg-[#121212] transition-all duration-300 group-hover:scale-[1.05] shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_15px_30px_rgba(229,9,20,0.3)] relative border border-transparent"
        style={mobileActive ? { transform: 'scale(1.05)', boxShadow: '0 15px 30px rgba(229,9,20,0.3)' } : {}}
      >
        {finalPosterUrl ? (
          <img
            src={finalPosterUrl}
            alt={movie.name || ''}
            className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40 movie-poster"
            style={mobileActive ? { opacity: 0.4 } : {}}
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-[#1A1A1A] flex flex-col items-center justify-center gap-2 select-none ${showSkeleton ? 'animate-pulse' : ''}`}>
            <Film className="w-12 h-12 text-gray-600 opacity-40" />
            <span className="text-[10px] text-gray-500 font-medium px-2 text-center uppercase tracking-wider line-clamp-1">
              {movie.name || ''}
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
          title={decodeHtml(movie.name || '')}
          dangerouslySetInnerHTML={{ __html: movie.name || '' }}
        />
        <p className="text-[#A0A0A0] text-xs mt-1 line-clamp-1 hidden md:block">
          {movie.year || 'N/A'} • {decodeHtml(movie.origin_name || '')}
        </p>
        <p className="text-[#A0A0A0] text-xs mt-0.5 md:hidden">
          {movie.year || 'N/A'}
        </p>
      </div>
    </div>
  );
}
