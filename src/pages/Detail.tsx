import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { api, getImageUrl } from "@/lib/api";
import { Play, Plus, Star, Clock, Calendar, Globe, Heart, X, ArrowLeft, Share2, Copy, Facebook, Twitter, Link as LinkIcon } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml, DEFAULT_AVATAR, CAST_PLACEHOLDER } from "@/lib/utils";
import { fetchWithCache, TTL } from "@/lib/cache";
import { motion, AnimatePresence } from "motion/react";
import { Vibrant } from "node-vibrant/browser";
import CommentsSection from "@/components/CommentsSection";
import { MovieDetailSkeleton } from "@/components/Skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { toMovieTitleCase } from "@/lib/utils";

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const buttonContainerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const buttonVariants: any = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const extractSeriesName = (originName: string): string => {
  if (!originName) return "";
  return originName
    .replace(/:\s*[^:]+$/, "") // bỏ phần phụ đề sau dấu hai chấm
    .replace(/\b\d{4}\b/g, "") // bỏ năm dạng 4 chữ số
    .replace(/\b(Season|Part|Volume|Vol|Chapter|Episode|Ep|Mùa|Phần)\s*\d+/gi, "") // bỏ Season/Part/... và Mùa/Phần
    .replace(/\s*[vV]\d+\b/g, "") // bỏ v1, v2, v3...
    .replace(/[^a-zA-Z0-9\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/g, "") // giữ cả ký tự tiếng Việt thanh điệu
    .replace(/\s+/g, " ") // thu gọn khoảng trắng
    .trim();
};

// Component LazyImage dùng cho ảnh diễn viên
const LazyImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={(loaded && src) ? src : CAST_PLACEHOLDER}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
};

export default function Detail() {
  const { slug } = useParams<{ slug: string }>();
  const [movie, setMovie] = useState<any>(null);
  const [accentColor, setAccentColor] = useState('#E50914');
  
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (el) {
      setIsDescriptionTruncated(el.scrollHeight > el.offsetHeight);
    }
  }, [movie]);

  const toggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };
  
  const pageTitle = movie ? `${toMovieTitleCase(movie.name)} | Cineverse` : "Đang tải... | Cineverse";
  useDocumentTitle(pageTitle);

  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [hasFetchedRelated, setHasFetchedRelated] = useState(false);
  const relatedMoviesRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'cast' | 'images'>('details');
  const [cast, setCast] = useState<any[]>([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [rating, setRating] = useState<{ source: string, score: string, votes: string } | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const fromSearch = location.state?.fromSearch;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShare = (platform: 'copy' | 'facebook' | 'twitter') => {
    const url = window.location.href;
    const text = `Xem phim ${movie?.name} trên Cineverse!`;
    
    switch (platform) {
      case 'copy':
        navigator.clipboard.writeText(url);
        showToast("Đã sao chép liên kết vào clipboard!", "success");
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
        break;
    }
    setShowShareMenu(false);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      if (!slug) return;
      setLoading(true);
      // Reset related movies state when slug changes
      if (isMounted) {
        setHasFetchedRelated(false);
        setRelatedMovies([]);
      }
      try {
        const res = await api.getMovieDetail(slug);
        if (isMounted) setMovie(res.movie);
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to fetch movie detail", error);
        showToast("Không thể tải thông tin phim. Vui lòng thử lại sau.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [slug, showToast]);

  useEffect(() => {
    if (!movie?.thumb_url && !movie?.poster_url) return;

    let isMounted = true;
    const imageUrl = getImageUrl(movie.thumb_url || movie.poster_url, "banner");

    Vibrant.from(imageUrl)
      .getPalette()
      .then(palette => {
        if (!isMounted) return;
        const color = palette.Vibrant?.hex || palette.DarkVibrant?.hex || "#E50914";
        setAccentColor(color);
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Vibrant failed to extract colors, falling back to default theme color:", err);
          setAccentColor("#E50914");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [movie]);

  useEffect(() => {
    let isMounted = true;
    if (!movie || hasFetchedRelated) return;

    const fetchRelatedMovies = async () => {
      if (isMounted) setLoadingRelated(true);
      
      try {
        // --- Ưu tiên 1: Tìm phim cùng series qua TMDb (belongs_to_collection) ---
        let relatedFromDB: any[] = [];
        const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

        // 1.1. Lấy tmdb_id của phim hiện tại
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';

        if (!tmdbId) {
          // Tìm kiếm trên TMDb nếu chưa có
          const yearQuery = movie.year ? `&year=${movie.year}` : '';
          const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movie.origin_name || movie.name)}${yearQuery}&language=vi-VN`;
          const searchData = await fetchWithCache(`tmdb_search_${movie.slug}`, () => fetch(searchUrl).then(r => r.json()), TTL.TMDB_STATIC);
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id;
          }
        }

        if (tmdbId && tmdbType === 'movie') {
          // 1.2. Lấy collection_id từ chi tiết phim TMDb
          const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=vi-VN`;
          const detailsData = await fetchWithCache(`tmdb_details_${tmdbId}`, () => fetch(detailsUrl).then(r => r.json()), TTL.TMDB_STATIC);
          
          const collectionId = detailsData?.belongs_to_collection?.id;

          if (collectionId) {
            // 1.3. Lấy danh sách phim trong collection
            const collectionUrl = `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}&language=vi-VN`;
            const collectionData = await fetchWithCache(`tmdb_collection_${collectionId}`, () => fetch(collectionUrl).then(r => r.json()), TTL.TMDB_STATIC);
            
            if (collectionData?.parts && collectionData.parts.length > 0) {
              // 1.4. Tìm các phim này trong cơ sở dữ liệu của bạn bằng cách search tiêu đề Việt hoặc gốc
              const searchPromises = collectionData.parts.map(async (part: any) => {
                if (part.id === tmdbId) return null; // Bỏ qua phim hiện tại
                try {
                  const searchInDB = await api.search(part.title);
                  if (searchInDB?.items && searchInDB.items.length > 0) {
                    return searchInDB.items[0];
                  }
                  
                  if (part.original_title && part.original_title !== part.title) {
                    const searchInDBOriginal = await api.search(part.original_title);
                    if (searchInDBOriginal?.items && searchInDBOriginal.items.length > 0) {
                      return searchInDBOriginal.items[0];
                    }
                  }
                  return null;
                } catch {
                  return null;
                }
              });

              const results = await Promise.all(searchPromises);
              const uniqueResults: any[] = [];
              results.forEach((m: any) => {
                if (m && m.slug !== slug && !uniqueResults.some(u => u.slug === m.slug)) {
                  uniqueResults.push(m);
                }
              });
              relatedFromDB = uniqueResults;
            }
          }
        }

        // --- Ưu tiên 2: Thử tìm theo trích xuất tên series nếu kết quả từ Collection quá ít (nhỏ hơn 3 phim) ---
        if (relatedFromDB.length < 3) {
          const seriesName = extractSeriesName(movie.origin_name || movie.name);
          if (seriesName.length > 2) {
            try {
              const searchRes = await api.search(seriesName, 1);
              const items = (searchRes.items || []).filter((m: any) => m.slug !== slug);
              
              // Lọc kỹ hơn các phim có cùng tên series
              const seriesNameLower = seriesName.toLowerCase();
              const seriesMatched = items.filter((m: any) => {
                const mSeries = extractSeriesName(m.origin_name || m.name).toLowerCase();
                return mSeries === seriesNameLower || mSeries.includes(seriesNameLower) || seriesNameLower.includes(mSeries);
              });

              // Gộp thêm vào danh sách
              seriesMatched.forEach((item: any) => {
                if (relatedFromDB.length < 10 && !relatedFromDB.some(m => m.slug === item.slug)) {
                  relatedFromDB.push(item);
                }
              });
            } catch (e) {
              console.warn("Series text-extract fallback search failed", e);
            }
          }
        }

        // --- Ưu tiên 3: Điền thêm phim cùng thể loại để đạt tối thiểu 10 phim gợi ý ---
        if (relatedFromDB.length < 10) {
          const genreSlug = movie.category?.[0]?.slug;
          if (genreSlug) {
            const genreRes = await api.getByGenre(genreSlug, 1);
            const genreItems = (genreRes.items || []).filter((m: any) => m.slug !== slug);
            
            for (const item of genreItems) {
              if (relatedFromDB.length >= 10) break;
              if (!relatedFromDB.some(m => m.slug === item.slug)) {
                relatedFromDB.push(item);
              }
            }
          }
        }

        if (isMounted) setRelatedMovies(relatedFromDB.slice(0, 10));
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to fetch related movies", error);
        
        // Hồi phục lỗi mượt mà sử dụng thể loại gốc
        try {
          const genreSlug = movie?.category?.[0]?.slug;
          if (genreSlug) {
            const res = await api.getByGenre(genreSlug, 1);
            const filtered = (res.items || []).filter((m: any) => m.slug !== slug);
            if (isMounted) setRelatedMovies(filtered.slice(0, 10));
          }
        } catch (innerError) {
          console.error("Fallback related movies failed", innerError);
        }
      } finally {
        if (isMounted) {
          setLoadingRelated(false);
          setHasFetchedRelated(true);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchRelatedMovies();
          if (relatedMoviesRef.current) {
            observer.unobserve(relatedMoviesRef.current);
          }
        }
      },
      { rootMargin: "200px" }
    );

    if (relatedMoviesRef.current) {
      observer.observe(relatedMoviesRef.current);
    }

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [movie, hasFetchedRelated, slug]);

  // 🚀 TỐI ƯU: Ưu tiên lấy peoples và images từ phimapi, fallback sang TMDb khi cần
  useEffect(() => {
    if (!movie) return;
    
    const fetchTMDBData = async () => {
      setLoadingCast(true);
      setLoadingImages(true);
      
      let gotPeoples = false;
      let gotImages = false;

      try {
        // Thử lấy dữ liệu từ phimapi peoples & images trước để tránh dính limit hoặc lỗi API key TMDB
        const [peoplesData, imagesData] = await Promise.all([
          api.getMoviePeoples(movie.slug).catch(() => null),
          api.getMovieImages(movie.slug).catch(() => null)
        ]);

        if (peoplesData && peoplesData.peoples && peoplesData.peoples.length > 0) {
          const castList = peoplesData.peoples.filter((p: any) => p.name);
          if (castList.length > 0) {
            setCast(castList.slice(0, 12));
            gotPeoples = true;
          }
        }

        if (imagesData && imagesData.images && imagesData.images.length > 0) {
          const uniqueImages = imagesData.images.filter((img: any, index: number, self: any[]) =>
            self.findIndex((i: any) => i.file_path === img.file_path) === index
          );
          if (uniqueImages.length > 0) {
            setImages(uniqueImages.slice(0, 16));
            gotImages = true;
          }
        }

        if (movie.tmdb?.vote_average) {
          let formattedVotes = '';
          if (movie.tmdb.vote_count) {
            formattedVotes = Number(movie.tmdb.vote_count) >= 1000 
              ? `${(Number(movie.tmdb.vote_count) / 1000).toFixed(1)}K` 
              : `${movie.tmdb.vote_count}`;
          }
          setRating({
            source: 'TMDb',
            score: Number(movie.tmdb.vote_average).toFixed(1),
            votes: formattedVotes
          });
        }
      } catch (err) {
        console.warn("[API] Failed to fetch peoples/images from phimapi:", err);
      }

      // Nếu đã lấy đầy đủ, không cần fetch trực tiếp từ TMDB
      if (gotPeoples && gotImages) {
        setLoadingCast(false);
        setLoadingImages(false);
        return;
      }

      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      
      try {
        // Bước 1: Tìm tmdbId (chỉ 1 lần)
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId) {
          const yearQuery = movie.year ? `&year=${movie.year}` : '';
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(movie.origin_name || movie.name)}${yearQuery}&language=vi-VN`;
          const searchData = await fetchWithCache(`tmdb_search_${movie.slug}`, () => fetch(searchUrl).then(r => r.json()), TTL.TMDB_STATIC);
          if (searchData.results?.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (!tmdbId) {
          setLoadingCast(false);
          setLoadingImages(false);
          return;
        }

        // Bước 2: Nâng cấp URL gọi API - Thêm include_image_language để lấy toàn bộ kho ảnh không bị giới hạn bởi tag vi-VN
        const combinedUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN&append_to_response=credits,images&include_image_language=en,null,vi`;
        const combinedData = await fetchWithCache(`tmdb_combined_${tmdbType}_${tmdbId}`, () => fetch(combinedUrl).then(r => r.json()), TTL.TMDB_STATIC);

        // Bước 3: Phân phối dữ liệu vào các state an toàn
        if (!rating && combinedData.vote_average) {
          let formattedVotes = '';
          if (combinedData.vote_count) {
            formattedVotes = combinedData.vote_count >= 1000 
              ? `${(combinedData.vote_count / 1000).toFixed(1)}K` 
              : `${combinedData.vote_count}`;
          }
          setRating({
            source: 'TMDb',
            score: combinedData.vote_average.toFixed(1),
            votes: formattedVotes
          });
        }

        if (!gotPeoples && combinedData.credits?.cast) {
          setCast(combinedData.credits.cast.slice(0, 12));
        }

        if (!gotImages) {
          // Xử lý kho ảnh mở rộng: Lấy cả backdrops (ảnh ngang) và stills (ảnh phân cảnh) nếu có
          let extendedImages: any[] = [];
          if (combinedData.images?.backdrops?.length > 0) {
            extendedImages = [...combinedData.images.backdrops];
          }
          
          // Nếu là phim bộ (TV Series), lấy thêm ảnh từ các phần để làm phong phú kho ảnh
          if (combinedData.images?.posters?.length > 0 && extendedImages.length < 5) {
            extendedImages = [...extendedImages, ...combinedData.images.posters];
          }

          // Lọc trùng và giới hạn tối đa 16 tấm ảnh chất lượng cao nhất
          const uniqueImages = extendedImages.filter((img, index, self) =>
            self.findIndex(i => i.file_path === img.file_path) === index
          );

          setImages(uniqueImages.slice(0, 16));
        }

      } catch (error) {
        // Ghi nhận cảnh báo nhẹ, tránh console.error làm đỏ log hệ thống giám sát
        console.warn("Failed to fetch TMDB data, falling back to local metadata:", error);
      } finally {
        setLoadingCast(false);
        setLoadingImages(false);
      }
    };

    fetchTMDBData();
  }, [movie]);

  if (loading) {
    return (
      <div className="-mt-16 md:-mt-20 pb-20">
        <MovieDetailSkeleton />
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
    const success = toggleFavorite(movie);
    if (!success) {
      showToast("Bạn cần đăng nhập để thêm phim vào yêu thích!", "error");
      return;
    }
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="-mt-16 md:-mt-20 pb-20"
    >
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
              src={getTrailerUrl(movie.trailer_url) || null}
              title="Trailer"
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media"
            ></iframe>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div className="relative w-full bg-[#0A0A0A] overflow-hidden min-h-[60vh] md:min-h-[75vh] max-h-[90vh]">

        {/* Nút Quay lại */}
        <div className="absolute top-20 md:top-24 left-4 md:left-6 z-50">
          {fromSearch ? (
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-md border border-white/10 transition-all font-medium cursor-pointer text-sm md:text-base"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              Quay lại
            </button>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-md border border-white/10 transition-all font-medium text-sm md:text-base"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              Quay lại trang chủ
            </Link>
          )}
        </div>

        <div className="absolute inset-0 animate-in fade-in duration-700">
          <motion.div
            className="absolute inset-0 w-full h-full"
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <motion.div
              className="w-full h-full"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ willChange: "transform" }}
            >
              <img
                src={getImageUrl(movie.thumb_url || movie.poster_url, 'banner')}
                alt={movie.name}
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>

          {/* Overlay tối nhẹ */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Gradient dưới — mờ dần mượt mà */}
          <div className="absolute inset-0 bg-gradient-to-t
            from-[#0A0A0A] from-0%
            via-[#0A0A0A]/70 via-30%
            via-transparent via-60%
            to-transparent to-100%"
          />

          {/* Gradient trái — chữ dễ đọc */}
          <div className="absolute inset-0 bg-gradient-to-r
            from-[#0A0A0A]/80 from-0%
            via-[#0A0A0A]/20 via-50%
            to-transparent to-100%"
          />

          {/* Hòa với header */}
          <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#0A0A0A]/60 to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 -mt-32 md:-mt-64 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-16 animate-in slide-in-from-bottom-8 duration-1000">
          {/* Poster */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ y: -6, scale: 1.02 }}
            className="w-48 sm:w-56 md:w-80 flex-shrink-0 mx-auto md:mx-0"
          >
            <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] aspect-[2/3] border border-white/10 group">
              <img
                src={getImageUrl(movie.poster_url || movie.thumb_url, 'poster')}
                alt={movie.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>

          {/* Info */}
          <div className="flex-grow text-center md:text-left pt-4 md:pt-12">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <motion.h1 
                variants={itemVariants}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-white mb-2 tracking-tighter leading-[1.1] drop-shadow-2xl"
                dangerouslySetInnerHTML={{ __html: movie.name }}
              />
              <motion.h2 
                variants={itemVariants}
                className="text-xl md:text-2xl text-[#A0A0A0] font-medium mb-6 italic drop-shadow-md"
                dangerouslySetInnerHTML={{ __html: movie.origin_name }}
              />
              <motion.p 
                variants={itemVariants}
                className="text-xl text-[#A0A0A0] mb-6 font-medium drop-shadow-md"
              >
                {movie.year} • {movie.country?.[0]?.name || 'N/A'}
              </motion.p>
            </motion.div>

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

            {/* --- FLOATING DESCRIPTION CARD CHƯA SẮP ĐẶT ACCENT SHADOW (IDEA 1/3) --- */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="relative max-w-3xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] mb-8 overflow-hidden"
              style={{ boxShadow: `0 8px 40px rgba(0,0,0,0.4), 0 0 20px ${accentColor}11` }}
            >
              {/* --- EXPANDABLE DESCRIPTION (IDEA 2) --- */}
              <div className="relative">
                <p
                  ref={descriptionRef}
                  className={`text-[#A0A0A0] leading-relaxed text-sm md:text-base ${
                    !isDescriptionExpanded ? 'line-clamp-3 md:line-clamp-4' : ''
                  }`}
                  style={{
                    // --- GRADIENT TEXT FADE (IDEA 3) ---
                    // Chỉ áp dụng khi văn bản bị truncate và đang ở trạng thái rút gọn
                    WebkitMaskImage: (!isDescriptionExpanded && isDescriptionTruncated)
                      ? 'linear-gradient(to bottom, white 70%, transparent 100%)'
                      : 'none',
                    maskImage: (!isDescriptionExpanded && isDescriptionTruncated)
                      ? 'linear-gradient(to bottom, white 70%, transparent 100%)'
                      : 'none',
                  }}
                  dangerouslySetInnerHTML={{ __html: movie.content }}
                />

                {/* Nút "Xem thêm" chỉ hiển thị khi nội dung bị truncate */}
                {isDescriptionTruncated && (
                  <button
                    onClick={toggleDescription}
                    className="mt-2 text-[#E50914] hover:text-red-400 text-sm font-semibold transition-colors duration-300 flex items-center gap-1 cursor-pointer"
                  >
                    {isDescriptionExpanded ? 'Thu gọn ▲' : 'Xem thêm ▼'}
                  </button>
                )}
              </div>
            </motion.div>
            
            {/* --- CỤM NÚT HÀNH ĐỘNG PHÂN CẤP --- */}
            <motion.div 
              variants={buttonContainerVariants}
              initial="hidden"
              animate="show"
              className="relative z-20 flex items-center md:flex-wrap gap-3 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x mt-6"
            >
              {/* ========== PRIMARY BUTTON: XEM NGAY ========== */}
              <motion.div variants={buttonVariants} whileHover={{ y: -2, scale: 1.02 }} className="flex-shrink-0 snap-start">
                <Link
                  to={`/watch/${movie.slug}`}
                  state={{ fromSearch }}
                  className="relative inline-flex items-center justify-center gap-2 bg-[#E50914] text-white px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-bold transition-all text-sm md:text-lg shadow-[0_4px_20px_rgba(229,9,20,0.5)] overflow-hidden group"
                  style={{ boxShadow: `0 4px 20px rgba(229,9,20,0.5), 0 0 25px ${accentColor}33` }}
                >
                  {/* Light sweep pseudo-element */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></span>
                  <Play className="w-5 h-5 md:w-6 md:h-6 relative z-10" fill="currentColor" />
                  <span className="relative z-10">Xem Ngay</span>
                </Link>
              </motion.div>
              
              {/* ========== SECONDARY BUTTON: TRAILER ========== */}
              {movie.trailer_url && (
                <motion.div variants={buttonVariants} whileHover={{ y: -2, scale: 1.02 }} className="flex-shrink-0 snap-start">
                  <button 
                    onClick={() => setShowTrailer(true)}
                    className="relative inline-flex items-center justify-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 text-white px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-bold transition-all text-sm md:text-lg group cursor-pointer"
                    style={{ boxShadow: `0 0 15px ${accentColor}22` }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 25px ${accentColor}55`}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 15px ${accentColor}22`}
                  >
                    <motion.div
                      whileHover={{ rotate: [0, -15, 15, 0], scale: 1.2 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 text-[#E50914] group-hover:text-red-400 transition-colors" fill="currentColor" />
                    </motion.div>
                    Trailer
                  </button>
                </motion.div>
              )}

              {/* ========== TERTIARY BUTTON: YÊU THÍCH ========== */}
              <motion.div variants={buttonVariants} whileHover={{ y: -2 }} className="flex-shrink-0 snap-start">
                <button 
                  onClick={handleFavoriteClick}
                  className={`relative inline-flex items-center justify-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 text-gray-200 px-5 md:px-6 py-3.5 md:py-4 rounded-xl font-semibold transition-all text-sm md:text-base group cursor-pointer ${
                    favorite ? 'text-[#E50914]' : ''
                  }`}
                  style={favorite ? { boxShadow: `0 0 20px ${accentColor}44` } : {}}
                >
                  <motion.div
                    key={favorite ? 'active' : 'inactive'}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.3, 1] }}
                    transition={{ duration: 0.4 }}
                  >
                    <Heart className={`w-4 h-4 md:w-5 md:h-5 ${favorite ? 'fill-current' : ''}`} />
                  </motion.div>
                  {favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                </button>
              </motion.div>

              {/* ========== TERTIARY BUTTON: CHIA SẺ ========== */}
              <motion.div variants={buttonVariants} whileHover={{ y: -2 }} className="relative flex-shrink-0 snap-start" ref={shareMenuRef}>
                <button 
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="relative inline-flex items-center justify-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 text-gray-200 px-5 md:px-6 py-3.5 md:py-4 rounded-xl font-semibold transition-all text-sm md:text-base group cursor-pointer"
                >
                  <motion.div whileHover={{ scale: 1.2, rotate: 15 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                  </motion.div>
                  Chia sẻ
                </button>

                <AnimatePresence>
                  {showShareMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 md:left-1/2 md:-translate-x-1/2 mb-3 w-48 bg-[#1A1A1A] backdrop-blur-xl border border-[#333333] rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="flex flex-col">
                        <button 
                          onClick={() => handleShare('copy')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Sao chép liên kết
                        </button>
                        <button 
                          onClick={() => handleShare('facebook')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-[#1877F2]/20 transition-colors text-left cursor-pointer"
                        >
                          <Facebook className="w-4 h-4 text-[#1877F2]" />
                          Chia sẻ Facebook
                        </button>
                        <button 
                          onClick={() => handleShare('twitter')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-[#1DA1F2]/20 transition-colors text-left cursor-pointer"
                        >
                          <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                          Chia sẻ Twitter
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        </div> {/* Đóng flex container */}

        {/* Detailed Info Tabs – GLASSMORPHISM PANEL */}
        <motion.div 
          layout
          className="relative mt-8 md:mt-12 backdrop-blur-3xl rounded-3xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${accentColor}22, rgba(15,15,15,0.92))`,
            borderColor: `${accentColor}55`,
            borderWidth: 1,
            borderStyle: 'solid',
            boxShadow: `0 20px 80px rgba(0,0,0,0.55), 0 0 40px ${accentColor}22`
          }}
        >
          {/* Subtle glow inside */}
          <div 
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: `linear-gradient(to bottom right, ${accentColor}10, transparent)` }}
          />

          {/* Tab header */}
          <div className="relative flex items-center gap-4 md:gap-6 border-b border-white/10 pb-4 mb-6 overflow-x-auto no-scrollbar whitespace-nowrap p-6 md:p-8 pb-0">
            <button 
              onClick={() => setActiveTab('details')}
              className={`font-heading font-bold text-sm md:text-lg pb-4 -mb-[17px] transition-colors relative flex-shrink-0 ${activeTab === 'details' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Chi tiết
              {activeTab === 'details' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('cast')}
              className={`font-heading font-bold text-sm md:text-lg pb-4 -mb-[17px] transition-colors relative flex-shrink-0 ${activeTab === 'cast' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Diễn viên
              {activeTab === 'cast' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('images')}
              className={`font-heading font-bold text-sm md:text-lg pb-4 -mb-[17px] transition-colors relative flex-shrink-0 ${activeTab === 'images' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Hình ảnh
              {activeTab === 'images' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />
              )}
            </button>
          </div>
          
          {/* Tab content – thêm padding tương ứng */}
          <div className="relative px-6 md:px-8 pb-6 md:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'details' && (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 text-sm md:text-base"
                  >
                    {/* Tình trạng */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Tình trạng</span>
                      <span className="text-white font-medium">{movie.episode_current || 'N/A'}</span>
                    </motion.div>
                    {/* Số tập */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Số tập</span>
                      <span className="text-white font-medium">{movie.episode_total || 'N/A'}</span>
                    </motion.div>
                    {/* Thời lượng */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Thời lượng</span>
                      <span className="text-white font-medium">{movie.time || 'N/A'}</span>
                    </motion.div>
                    {/* Năm */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Năm</span>
                      <span className="text-white font-medium">{movie.year || 'N/A'}</span>
                    </motion.div>
                    {/* Chất lượng */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Chất lượng</span>
                      <span className="text-white font-medium">{movie.quality || 'N/A'}</span>
                    </motion.div>
                    {/* Ngôn ngữ */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Ngôn ngữ</span>
                      <span className="text-white font-medium">{movie.lang || 'N/A'}</span>
                    </motion.div>
                    {/* Đạo diễn */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center col-span-2 sm:col-span-3 md:col-span-2 shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Đạo diễn</span>
                      <span className="text-white font-medium">{movie.director?.join(', ') || 'Đang cập nhật'}</span>
                    </motion.div>
                    {/* Quốc gia */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center col-span-2 sm:col-span-3 md:col-span-2 shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Quốc gia</span>
                      <span className="text-white font-medium">
                        {movie.country && (Array.isArray(movie.country) ? movie.country : Object.values(movie.country)).map((c: any) => c.name).join(', ')}
                      </span>
                    </motion.div>
                    {/* Thể loại */}
                    <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center col-span-2 sm:col-span-3 md:col-span-4 shadow-lg">
                      <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Thể loại</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {movie.category && (Array.isArray(movie.category) ? movie.category : Object.values(movie.category)).map((c: any, idx: number) => (
                          <span key={idx} className="bg-white/10 backdrop-blur-sm text-gray-200 text-xs px-2.5 py-1.5 rounded-md border border-white/10">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {activeTab === 'cast' && (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:gap-5 py-5"
                  >
                    {loadingCast ? (
                      <div className="col-span-full flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : cast.length > 0 ? (
                      cast.map((actor: any, idx: number) => (
                        <motion.div key={idx} variants={itemVariants} className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center">
                          <LazyImage 
                            src={actor.profile_path ? getImageUrl(`https://image.tmdb.org/t/p/w185${actor.profile_path}`) : ""} 
                            alt={actor.name}
                            className="w-20 h-20 md:w-full md:h-auto md:aspect-[2/3] object-cover rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A]"
                          />
                          <div className="font-semibold text-white mb-1 text-xs md:text-sm line-clamp-1 w-full" title={decodeHtml(actor.name)}>{decodeHtml(actor.name)}</div>
                          <div className="text-[10px] md:text-sm text-[#AAAAAA] line-clamp-1 w-full" title={decodeHtml(actor.character)}>{actor.character ? `Vai: ${decodeHtml(actor.character)}` : ''}</div>
                        </motion.div>
                      ))
                    ) : movie.actor && movie.actor.length > 0 && movie.actor[0] !== "Đang cập nhật" ? (
                      // Fallback to PhimAPI actors if TMDB fails
                      movie.actor.map((actorName: string, idx: number) => (
                        <motion.div key={idx} variants={itemVariants} className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center">
                          <LazyImage 
                            src="" 
                            alt={actorName}
                            className="w-20 h-20 md:w-full md:h-auto md:aspect-[2/3] object-cover rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A]"
                          />
                          <div className="font-semibold text-white mb-1 text-xs md:text-sm line-clamp-1 w-full" title={decodeHtml(actorName)}>{decodeHtml(actorName)}</div>
                        </motion.div>
                      ))
                    ) : (
                      <p className="col-span-full text-gray-400 text-sm">Đang cập nhật thông tin diễn viên.</p>
                    )}
                  </motion.div>
                )}

                {activeTab === 'images' && (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 py-5"
                  >
                    {loadingImages ? (
                      <div className="col-span-full flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : images.length > 0 ? (
                      images.map((img: any, idx: number) => (
                        <motion.div key={idx} variants={itemVariants} className="rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_10px_25px_rgba(229,9,20,0.3)] bg-[#2A2A2A]">
                          <img 
                            src={getImageUrl(`https://image.tmdb.org/t/p/w500${img.file_path}`)} 
                            alt={`Hình ảnh ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <motion.div variants={itemVariants} className="aspect-video rounded-xl overflow-hidden bg-[#2A2A2A]">
                          <img src={getImageUrl(movie.thumb_url || movie.poster_url, 'banner')} className="w-full h-full object-cover" alt="Gallery 1" referrerPolicy="no-referrer" />
                        </motion.div>
                        <motion.div variants={itemVariants} className="aspect-video rounded-xl overflow-hidden bg-[#2A2A2A]">
                          <img src={getImageUrl(movie.poster_url || movie.thumb_url, 'banner')} className="w-full h-full object-cover" alt="Gallery 2" referrerPolicy="no-referrer" />
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

          {/* Comments Section */}
          <CommentsSection movieId={movie._id || movie.slug} />

          {/* Related Movies */}
          <div ref={relatedMoviesRef} className="mt-16 md:mt-24 min-h-[200px]">
            {loadingRelated ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : relatedMovies.length > 0 ? (
              <>
                <h2 className="text-xl md:text-2xl font-heading font-bold text-white tracking-wider mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
                   <span className="w-1.5 h-6 md:h-8 rounded-full inline-block" style={{ backgroundColor: accentColor }}></span>
                  Phim Liên Quan
                </h2>
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-100px" }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10"
                >
                  {relatedMovies.map((m, index) => (
                    <motion.div key={`${m.slug || m._id || 'related'}-${index}`} variants={itemVariants}>
                      <MovieCard movie={m} />
                    </motion.div>
                  ))}
                </motion.div>
              </>
            ) : null}
          </div>
        </div>
      </motion.div>
    );
  }
