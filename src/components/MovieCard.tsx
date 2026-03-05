import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { getImageUrl } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

interface MovieCardProps {
  movie: any;
  key?: React.Key;
}

export default function MovieCard({ movie }: MovieCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = movie ? isFavorite(movie.slug) : false;
  const { showToast } = useToast();
  const [rating, setRating] = useState<string | null>(null);

  useEffect(() => {
    if (!movie) return;
    
    // If we already have tmdb vote_average from API, use it
    if (movie.tmdb?.vote_average) {
      setRating(movie.tmdb.vote_average.toFixed(1));
      return;
    }

    // Otherwise, try to fetch it
    const fetchRating = async () => {
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (searchData.results && searchData.results.length > 0) {
          const tmdbId = searchData.results[0].id;
          const tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          
          const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();
          
          if (detailsData.vote_average) {
            setRating(detailsData.vote_average.toFixed(1));
          }
        }
      } catch (error) {
        // Silently fail to avoid console spam when TMDB is blocked or rate limited
        // console.error("Failed to fetch rating for card", error);
      }
    };

    fetchRating();
  }, [movie]);

  if (!movie) return null;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(movie);
    if (!favorite) {
      showToast("Đã thêm vào danh sách yêu thích", "success");
    } else {
      showToast("Đã xóa khỏi danh sách yêu thích", "info");
    }
  };

  return (
    <div className="group relative block w-full">
      <Link to={`/movie/${movie.slug}`} className="block rounded-[12px] overflow-hidden aspect-[2/3] bg-[#121212]  transition-all duration-300 group-hover:scale-[1.05] shadow-[0_10px_20px_rgba(0,0,0,0.5)] _4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_15px_30px_rgba(229,9,20,0.3)] relative border border-transparent ">
        <img
          src={getImageUrl(movie.poster_url || movie.thumb_url, 'poster')}
          alt={movie.name}
          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40 movie-poster"
          loading="lazy"
        />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 z-10">
          {movie.quality && (
            <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-white/10">
              {movie.quality}
            </span>
          )}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
          <div className="w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Bottom Left Rating (Hover) */}
        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-[#F5C518]/30">
          <Star className="w-3.5 h-3.5 text-[#F5C518]" fill="currentColor" />
          <span className="text-[#F5C518] font-bold text-xs">{rating || 'Đang cập nhật'}</span>
        </div>

        {/* Favorite Button (Hover) */}
        <button 
          onClick={handleFavoriteClick}
          className="absolute top-2 right-2 z-30 p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-[#E50914] transition-colors opacity-0 group-hover:opacity-100 border border-white/10 hover:border-transparent"
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-white text-white' : 'text-white'}`} />
        </button>
      </Link>

      {/* Info Below Card */}
      <div className="mt-3 px-1">
        <h3 className="text-white  font-heading font-semibold text-sm line-clamp-1 group-hover:text-[#E50914] transition-colors" title={movie.name}>
          {movie.name}
        </h3>
        <p className="text-[#A0A0A0]  text-xs mt-1 line-clamp-1">{movie.year || 'N/A'} • {movie.origin_name}</p>
      </div>
    </div>
  );
}
