import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getImageUrl } from "@/lib/api";
import { Play, Plus, Star, Clock, Calendar, Globe, Heart, X, ArrowLeft } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml } from "@/lib/utils";

export default function Detail() {
  const { slug } = useParams<{ slug: string }>();
  const [movie, setMovie] = useState<any>(null);
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'cast' | 'images'>('details');
  const [cast, setCast] = useState<any[]>([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [rating, setRating] = useState<{ source: string, score: string, votes: string } | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  useEffect(() => {
    const fetchDetail = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await api.getMovieDetail(slug);
        setMovie(res.movie);
        
        // Fetch related movies based on the first category
        if (res.movie?.category?.[0]?.slug) {
          const relatedRes = await api.getByGenre(res.movie.category[0].slug, 1);
          // Filter out current movie and take 10
          const filtered = (relatedRes.items || []).filter((m: any) => m.slug !== slug);
          setRelatedMovies(filtered.slice(0, 10));
        }
      } catch (error) {
        console.error("Failed to fetch movie detail", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [slug]);

  useEffect(() => {
    const fetchRating = async () => {
      if (!movie) return;
      if (rating) return;
      
      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId) {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (tmdbId) {
          const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();
          if (detailsData.vote_average) {
            let formattedVotes = '';
            if (detailsData.vote_count) {
              if (detailsData.vote_count >= 1000) {
                formattedVotes = `${(detailsData.vote_count / 1000).toFixed(1)}K`;
              } else {
                formattedVotes = `${detailsData.vote_count}`;
              }
            }
            
            setRating({
              source: 'TMDb',
              score: detailsData.vote_average.toFixed(1),
              votes: formattedVotes
            });
          }
        }
      } catch (error) {
        // Silently fail to avoid console spam
      }
    };
    fetchRating();
  }, [movie]);

  useEffect(() => {
    const fetchCast = async () => {
      if (!movie || activeTab !== 'cast') return;
      if (cast.length > 0) return;
      
      setLoadingCast(true);
      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId) {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (tmdbId) {
          const creditsUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${apiKey}&language=vi-VN`;
          const creditsRes = await fetch(creditsUrl);
          const creditsData = await creditsRes.json();
          if (creditsData.cast) {
            setCast(creditsData.cast.slice(0, 12));
          }
        }
      } catch (error) {
        // Silently fail to avoid console spam
      } finally {
        setLoadingCast(false);
      }
    };
    fetchCast();
  }, [movie, activeTab]);

  useEffect(() => {
    const fetchImages = async () => {
      if (!movie || activeTab !== 'images') return;
      if (images.length > 0) return;
      
      setLoadingImages(true);
      try {
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId) {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.name)}&language=vi-VN`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (tmdbId) {
          const imagesUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/images?api_key=${apiKey}`;
          const imagesRes = await fetch(imagesUrl);
          const imagesData = await imagesRes.json();
          if (imagesData.backdrops) {
            setImages(imagesData.backdrops.slice(0, 12));
          }
        }
      } catch (error) {
        // Silently fail to avoid console spam
      } finally {
        setLoadingImages(false);
      }
    };
    fetchImages();
  }, [movie, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-white">
        <h1 className="text-2xl font-heading">Không tìm thấy phim</h1>
      </div>
    );
  }

  const favorite = isFavorite(movie.slug);

  const handleFavoriteClick = () => {
    toggleFavorite(movie);
    if (!favorite) {
      showToast("Đã thêm vào danh sách yêu thích", "success");
    } else {
      showToast("Đã xóa khỏi danh sách yêu thích", "info");
    }
  };

  const getAudioIcon = (lang: string) => {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l.includes('vietsub')) return '🇻🇳';
    if (l.includes('thuyết minh') || l.includes('lồng tiếng')) return '🎙️';
    return '🔤';
  };

  const getTrailerUrl = (url: string) => {
    if (!url) return null;
    // Convert watch?v= to embed/
    if (url.includes('watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    return url;
  };

  return (
    <div className="pb-20">
      {/* Trailer Modal */}
      {showTrailer && movie.trailer_url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTrailer(false)}>
          <div className="relative w-[80%] h-[80%] bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowTrailer(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-[#E50914] text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <iframe
              src={getTrailerUrl(movie.trailer_url) || ''}
              title="Trailer"
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media"
            ></iframe>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div className="relative w-full bg-[#0A0A0A] overflow-hidden aspect-[3840/2160] max-h-[85vh] min-h-[50vh]">
        <div className="absolute top-24 left-6 z-50">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm transition-all font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại trang chủ
          </Link>
        </div>
        <div className="absolute inset-0 animate-in fade-in duration-1000">
          <img
            src={getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
            alt={movie.name}
            className="w-full h-full object-cover opacity-30 scale-105 animate-[pulse_10s_ease-in-out_infinite_alternate] aspect-video"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]  via-[#0A0A0A]/80  to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]  via-[#0A0A0A]/40  to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1280px] mx-auto px-6 -mt-32 md:-mt-64 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 animate-in slide-in-from-bottom-8 duration-1000">
          {/* Poster */}
          <div className="w-56 md:w-80 flex-shrink-0 mx-auto md:mx-0">
            <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] aspect-[2/3] border border-white/10  group">
              <img
                src={getImageUrl(movie.poster_url || movie.thumb_url, 'poster')}
                alt={movie.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-grow text-center md:text-left pt-4 md:pt-12">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-white  mb-2 tracking-tighter leading-[1.1] drop-shadow-2xl"
              dangerouslySetInnerHTML={{ __html: movie.name }}
            />
            <p className="text-xl text-[#A0A0A0]  mb-6 font-medium drop-shadow-md">
              {movie.year} • {movie.country?.[0]?.name || 'N/A'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6 text-sm">
              <div className="flex items-center gap-1.5 bg-[#121212]  px-3 py-1.5 rounded-lg border border-white/5  shadow-sm">
                <Star className="w-4 h-4 text-[#F5C518]" fill="currentColor" />
                <span className="text-white  font-bold">
                  {rating ? `${rating.score}/10` : (movie.tmdb?.vote_average ? `${movie.tmdb.vote_average}/10` : 'Đang cập nhật')}
                </span>
                {rating?.votes && <span className="text-xs text-gray-400 ml-1">({rating.votes} votes)</span>}
              </div>
              
              <div className="flex items-center gap-2">
                {movie.category && (Array.isArray(movie.category) ? movie.category : Object.values(movie.category)).map((cat: any, index: number) => (
                  <span key={cat.id || index} className="bg-[#2A2A2A]  text-[#A0A0A0]  text-xs font-medium px-3 py-1.5 rounded-full border border-white/5 ">
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-8">
              {movie.lang && (
                <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-sm font-bold px-3 py-1.5 rounded-md border border-[#3B82F6]/30 flex items-center gap-2">
                  {getAudioIcon(movie.lang)} {movie.lang}
                </span>
              )}
              {movie.quality && (
                <span className="bg-[#E50914]/10 text-[#E50914] text-sm font-bold px-3 py-1.5 rounded-md border border-[#E50914]/30">
                  {movie.quality}
                </span>
              )}
            </div>

            <div className="mb-8">
              <p className="text-[#A0A0A0]  leading-relaxed text-sm md:text-base max-w-3xl" dangerouslySetInnerHTML={{ __html: movie.content }} />
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <Link
                to={`/watch/${movie.slug}`}
                className="flex items-center justify-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-8 py-4 rounded-xl font-semibold transition-all text-lg shadow-[0_4px_14px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_20px_rgba(229,9,20,0.6)] hover:-translate-y-0.5 w-full sm:w-auto min-w-[180px]"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Xem Ngay
              </Link>
              
              {movie.trailer_url && (
                <button 
                  onClick={() => setShowTrailer(true)}
                  className="flex items-center justify-center gap-2 bg-transparent border-2 border-[#666666] text-white  hover:bg-black/50 hover:border-[#E50914]/50 px-8 py-4 rounded-xl font-semibold transition-all text-lg w-full sm:w-auto min-w-[180px]"
                >
                  <Play className="w-5 h-5 text-[#E50914]" fill="currentColor" />
                  Trailer
                </button>
              )}

              <button 
                onClick={handleFavoriteClick}
                className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all text-lg w-full sm:w-auto min-w-[180px] border-2 ${
                  favorite 
                  ? 'bg-transparent border-gray-500 text-gray-400 hover:border-white hover:text-white' 
                  : 'bg-transparent border-gray-500 text-gray-300 hover:border-[#E50914] hover:text-[#E50914]'
                }`}
              >
                <Heart className={`w-5 h-5 ${favorite ? 'fill-current text-[#E50914]' : ''}`} />
                {favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
              </button>
            </div>
            
            {/* Detailed Info Tabs */}
            <div className="mt-12 bg-[#121212] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-6 border-b border-white/10 pb-4 mb-6">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={`font-heading font-bold text-lg pb-4 -mb-[17px] transition-colors ${activeTab === 'details' ? 'text-white border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white'}`}
                >
                  Chi tiết
                </button>
                <button 
                  onClick={() => setActiveTab('cast')}
                  className={`font-heading font-bold text-lg pb-4 -mb-[17px] transition-colors ${activeTab === 'cast' ? 'text-white border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white'}`}
                >
                  Diễn viên
                </button>
                <button 
                  onClick={() => setActiveTab('images')}
                  className={`font-heading font-bold text-lg pb-4 -mb-[17px] transition-colors ${activeTab === 'images' ? 'text-white border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white'}`}
                >
                  Hình ảnh
                </button>
              </div>
              
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm md:text-base">
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Tình trạng:</span>
                    <span className="text-gray-400">{movie.episode_current || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Số tập:</span>
                    <span className="text-gray-400">{movie.episode_total || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Thời lượng:</span>
                    <span className="text-gray-400">{movie.time || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Năm phát hành:</span>
                    <span className="text-gray-400">{movie.year || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Chất lượng:</span>
                    <span className="text-gray-400">{movie.quality || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Ngôn ngữ:</span>
                    <span className="text-gray-400">{movie.lang || 'N/A'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Đạo diễn:</span>
                    <span className="text-gray-400">{movie.director?.join(', ') || 'Đang cập nhật'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Thể loại:</span>
                    <span className="text-gray-400">
                      {movie.category && (Array.isArray(movie.category) ? movie.category : Object.values(movie.category)).map((c: any) => c.name).join(', ')}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-bold text-white flex-shrink-0">Quốc gia:</span>
                    <span className="text-gray-400">
                      {movie.country && (Array.isArray(movie.country) ? movie.country : Object.values(movie.country)).map((c: any) => c.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'cast' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:gap-5 py-5">
                  {loadingCast ? (
                    <div className="col-span-full flex justify-center py-10">
                      <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : cast.length > 0 ? (
                    cast.map((actor: any, idx: number) => (
                      <div key={idx} className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center">
                        <img 
                          src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=random&color=fff&size=185`} 
                          alt={actor.name}
                          className="w-20 h-20 md:w-full md:h-auto md:aspect-[2/3] object-cover rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A]"
                        />
                        <div className="font-semibold text-white mb-1 text-xs md:text-sm line-clamp-1 w-full" title={decodeHtml(actor.name)}>{decodeHtml(actor.name)}</div>
                        <div className="text-[10px] md:text-sm text-[#AAAAAA] line-clamp-1 w-full" title={decodeHtml(actor.character)}>{actor.character ? `Vai: ${decodeHtml(actor.character)}` : ''}</div>
                      </div>
                    ))
                  ) : movie.actor && movie.actor.length > 0 && movie.actor[0] !== "Đang cập nhật" ? (
                    // Fallback to PhimAPI actors if TMDB fails
                    movie.actor.map((actorName: string, idx: number) => (
                      <div key={idx} className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random&color=fff&size=185`} 
                          alt={actorName}
                          className="w-20 h-20 md:w-full md:h-auto md:aspect-[2/3] object-cover rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A]"
                        />
                        <div className="font-semibold text-white mb-1 text-xs md:text-sm line-clamp-1 w-full" title={decodeHtml(actorName)}>{decodeHtml(actorName)}</div>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-gray-400 text-sm">Đang cập nhật thông tin diễn viên.</p>
                  )}
                </div>
              )}

              {activeTab === 'images' && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 py-5">
                  {loadingImages ? (
                    <div className="col-span-full flex justify-center py-10">
                      <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : images.length > 0 ? (
                    images.map((img: any, idx: number) => (
                      <div key={idx} className="rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_10px_25px_rgba(229,9,20,0.3)] bg-[#2A2A2A]">
                        <img 
                          src={`https://image.tmdb.org/t/p/w500${img.file_path}`} 
                          alt={`Hình ảnh ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="aspect-video rounded-xl overflow-hidden bg-[#2A2A2A]">
                        <img src={getImageUrl(movie.thumb_url || movie.poster_url, 'banner')} className="w-full h-full object-cover" alt="Gallery 1" />
                      </div>
                      <div className="aspect-video rounded-xl overflow-hidden bg-[#2A2A2A]">
                        <img src={getImageUrl(movie.poster_url || movie.thumb_url, 'banner')} className="w-full h-full object-cover" alt="Gallery 2" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Related Movies */}
        {relatedMovies.length > 0 && (
          <div className="mt-24">
            <h2 className="text-2xl font-heading font-bold text-white  tracking-wider mb-8 flex items-center gap-3">
               <span className="w-1.5 h-8 bg-[#E50914] rounded-full inline-block"></span>
              Phim Liên Quan
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
              {relatedMovies.map((m, index) => (
                <MovieCard key={`${m.slug || m._id || 'related'}-${index}`} movie={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
