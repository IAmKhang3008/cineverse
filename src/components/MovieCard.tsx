import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { getImageUrl } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";

interface MovieCardProps {
  movie: any;
  key?: React.Key;
  fromSearch?: boolean;
}

export default function MovieCard({ movie, fromSearch }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [rating, setRating] = useState<string | null>(null);

  // State overlay cho mobile (long-press)
  const [mobileActive, setMobileActive] = useState(false);

  const handleTouchStart = useCallback(() => {
    setMobileActive(true);
  }, []);

  const handleTouchMove = useCallback(() => {
    setMobileActive(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setMobileActive(false);
  }, []);

  useEffect(() => {
    if (!movie) return;
    if (movie.tmdb?.vote_average) {
      setRating(movie.tmdb.vote_average.toFixed(1));
      return;
    }
    const fetchRating = async () => {
      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (searchData.results?.length > 0) {
          const tmdbId = searchData.results[0].id;
          const tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          const detailsRes = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN`);
          const detailsData = await detailsRes.json();
          if (detailsData.vote_average) setRating(detailsData.vote_average.toFixed(1));
        }
      } catch {}
    };
    fetchRating();
  }, [movie]);

  if (!movie) return null;

  const handleFavoriteClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(movie);
    showToast(
      favorite ? "Đã xóa khỏi danh sách yêu thích" : "Đã thêm vào danh sách yêu thích",
      favorite ? "info" : "success"
    );
    setMobileActive(false);
  };

  // Overlay hiển thị khi hover (desktop) hoặc long-press (mobile)
  const isOverlayVisible = mobileActive; // desktop dùng group-hover qua CSS

  return (
    <div
      className="group relative block w-full flex flex-col items-center md:items-start select-none"
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Link
        to={`/movie/${movie.slug}`}
        state={fromSearch ? { fromSearch: true } : undefined}
        // Nếu đang hiện overlay mobile, chặn navigate để user có thể bấm nút
        onClick={(e) => { if (mobileActive) e.preventDefault(); }}
        className="block w-full rounded-[12px] overflow-hidden aspect-[2/3] bg-[#121212] transition-all duration-300 group-hover:scale-[1.05] shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_15px_30px_rgba(229,9,20,0.3)] relative border border-transparent"
        style={isOverlayVisible ? { transform: 'scale(1.05)', boxShadow: '0 15px 30px rgba(229,9,20,0.3)' } : {}}
      >
        <img
          src={getImageUrl(movie.poster_url || movie.thumb_url, 'poster')}
          alt={movie.name}
          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40 movie-poster"
          style={isOverlayVisible ? { opacity: 0.4 } : {}}
          loading="lazy"
        />

        {/* Quality Badge */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 z-10">
          {movie.quality && (
            <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-white/10">
              {movie.quality}
            </span>
          )}
        </div>

        {/* Overlay: Play button */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-300 z-20"
          style={{ opacity: isOverlayVisible ? 1 : undefined }}
          // desktop vẫn dùng group-hover
        >
          {/* Desktop: group-hover | Mobile: isOverlayVisible */}
          <div className={`
            w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#E50914] flex items-center justify-center
            shadow-[0_0_20px_rgba(229,9,20,0.5)] transition-all duration-300
            ${isOverlayVisible
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
            }
          `}>
            <Play className="w-4 h-4 md:w-6 md:h-6 text-white ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Rating (bottom-left) */}
        <div
          className={`
            absolute bottom-3 left-3 z-20 flex items-center gap-1
            bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-[#F5C518]/30
            transition-opacity duration-300
            ${isOverlayVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
        >
          <Star className="w-3.5 h-3.5 text-[#F5C518]" fill="currentColor" />
          <span className="text-[#F5C518] font-bold text-xs">{rating || 'Đang cập nhật'}</span>
        </div>

        {/* Favorite button (top-right) */}
        <button
          onClick={handleFavoriteClick}
          onTouchEnd={(e) => { e.stopPropagation(); handleFavoriteClick(e); }}
          className={`
            absolute top-2 right-2 z-30 p-2 rounded-full
            bg-black/60 backdrop-blur-sm border border-white/10
            hover:bg-[#E50914] hover:border-transparent
            transition-all duration-300
            ${isOverlayVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-white text-white' : 'text-white'}`} />
        </button>
      </Link>

      {/* Info bên dưới */}
      <div className="mt-3 px-1 text-center md:text-left w-full">
        <h3
          className="text-white font-heading font-semibold text-sm line-clamp-1 group-hover:text-[#E50914] transition-colors"
          style={isOverlayVisible ? { color: '#E50914' } : {}}
          title={decodeHtml(movie.name)}
          dangerouslySetInnerHTML={{ __html: movie.name }}
        />
        <p className="text-[#A0A0A0] text-xs mt-1 line-clamp-1 hidden md:block">
          {movie.year || 'N/A'} • {decodeHtml(movie.origin_name)}
        </p>
        {/* Năm hiện trên mobile */}
        <p className="text-[#A0A0A0] text-xs mt-0.5 md:hidden">{movie.year || 'N/A'}</p>
      </div>
    </div>
  );
}
