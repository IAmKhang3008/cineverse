import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { api, getImageUrl } from "@/lib/api";
import { Play, Plus, Star, Clock, Calendar, Globe, Heart, X, ArrowLeft, Share2, Copy, Link as LinkIcon } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/contexts/ToastContext";
import { decodeHtml, DEFAULT_AVATAR, CAST_PLACEHOLDER } from "@/lib/utils";
import { fetchWithCache, TTL } from "@/lib/cache";
import { motion, AnimatePresence } from "motion/react";
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
  const [keywords, setKeywords] = useState<any[]>([]);
  const [rating, setRating] = useState<{ source: string, score: string, votes: string } | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const [selectedActor, setSelectedActor] = useState<any | null>(null);
  const [actorDetails, setActorDetails] = useState<any | null>(null);
  const [loadingActorDetails, setLoadingActorDetails] = useState(false);
  const [enrichedActors, setEnrichedActors] = useState<{[name: string]: {profile_path?: string | null; character?: string | null; id?: number}}>({});
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const fromSearch = location.state?.fromSearch;

  // Enrich actors with profile photos and character names from TMDB
  useEffect(() => {
    if (!movie) return;
    
    let isMounted = true;
    const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';

    const enrichAll = async () => {
      // 1. Lấy danh sách diễn viên cần làm giàu thông tin (tối đa 12 người để tránh spam API)
      const actorNamesToEnrich: string[] = [];
      
      if (cast && cast.length > 0) {
        cast.slice(0, 12).forEach((actor: any) => {
          if (actor.name && !actor.profile_path) {
            actorNamesToEnrich.push(actor.name);
          }
        });
      } else if (movie.actor && movie.actor.length > 0 && movie.actor[0] !== "Đang cập nhật") {
        movie.actor.slice(0, 12).forEach((actorName: string) => {
          actorNamesToEnrich.push(actorName);
        });
      }

      if (actorNamesToEnrich.length === 0) return;

      // 2. Thử lấy danh sách credits của toàn bộ phim từ TMDB trước để map hàng loạt (tiết kiệm API call)
      let tmdbCast: any[] = [];
      try {
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

        if (tmdbId) {
          const combinedUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN&append_to_response=credits`;
          const combinedData = await fetchWithCache(`tmdb_combined_credits_${tmdbType}_${tmdbId}`, () => fetch(combinedUrl).then(r => r.json()), TTL.TMDB_STATIC);
          if (combinedData.credits?.cast) {
            tmdbCast = combinedData.credits.cast;
          }
        }
      } catch (e) {
        console.warn("Error fetching tmdb credits for enrichment:", e);
      }

      // 3. Map các diễn viên tìm được từ Credits vào tempMap
      const tempMap: {[name: string]: {profile_path?: string | null; character?: string | null; id?: number}} = {};
      
      tmdbCast.forEach((actor: any) => {
        if (actor.name) {
          tempMap[actor.name.toLowerCase()] = {
            profile_path: actor.profile_path,
            character: actor.character,
            id: actor.id
          };
        }
        if (actor.original_name) {
          tempMap[actor.original_name.toLowerCase()] = {
            profile_path: actor.profile_path,
            character: actor.character,
            id: actor.id
          };
        }
      });

      if (!isMounted) return;
      setEnrichedActors(prev => ({ ...prev, ...tempMap }));

      // 4. Với những diễn viên còn sót lại (chưa có trong map từ credits), gọi API Search Person riêng biệt
      const remainingActors = actorNamesToEnrich.filter(name => !tempMap[name.toLowerCase()]);
      
      if (remainingActors.length > 0) {
        // Gọi song song có giới hạn hoặc tuần tự để tránh rate limit
        for (const name of remainingActors) {
          if (!isMounted) break;
          try {
            const searchPersonUrl = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=vi-VN`;
            const searchData = await fetchWithCache(`tmdb_person_search_${name}`, () => fetch(searchPersonUrl).then(r => r.json()), TTL.TMDB_STATIC);
            
            if (searchData.results?.length > 0) {
              const person = searchData.results[0];
              const resolvedInfo = {
                profile_path: person.profile_path,
                id: person.id,
                character: null // Không có character từ search person chung, nhưng ít nhất có hình ảnh
              };
              
              if (isMounted) {
                setEnrichedActors(prev => ({
                  ...prev,
                  [name.toLowerCase()]: resolvedInfo
                }));
              }
            }
          } catch (err) {
            console.warn(`Failed to search person info for ${name}:`, err);
          }
        }
      }
    };

    enrichAll();

    return () => {
      isMounted = false;
    };
  }, [movie, cast]);

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

  const handleActorClick = async (actor: any) => {
    const actorName = typeof actor === 'string' ? actor : (actor.name || "");
    setSelectedActor(actorName ? { name: actorName } : actor);
    setLoadingActorDetails(true);
    setActorDetails(null);
    
    try {
      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      let actorId = typeof actor === 'object' ? actor.id : null;

      if (!actorId && actorName) {
        const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorName)}&language=vi-VN`;
        const searchData = await fetchWithCache(`tmdb_actor_search_${actorName}`, () => fetch(searchUrl).then(r => r.json()), TTL.TMDB_STATIC);
        if (searchData?.results && searchData.results.length > 0) {
          actorId = searchData.results[0].id;
        }
      }

      if (actorId) {
        const detailsUrl = `https://api.themoviedb.org/3/person/${actorId}?api_key=${apiKey}&language=vi-VN&append_to_response=combined_credits`;
        const detailsData = await fetchWithCache(`tmdb_actor_details_vi_${actorId}`, () => fetch(detailsUrl).then(r => r.json()), TTL.TMDB_STATIC);
        
        if (detailsData && !detailsData.biography) {
          const enUrl = `https://api.themoviedb.org/3/person/${actorId}?api_key=${apiKey}&language=en-US`;
          const enData = await fetchWithCache(`tmdb_actor_details_en_${actorId}`, () => fetch(enUrl).then(r => r.json()), TTL.TMDB_STATIC);
          if (enData?.biography) {
            detailsData.biography = enData.biography;
          }
        }
        
        if (detailsData) {
          setActorDetails(detailsData);
        } else {
          setActorDetails({
            name: actorName || (actor && actor.name),
            profile_path: actor && actor.profile_path,
          });
        }
      } else {
        setActorDetails({
          name: actorName || (actor && actor.name),
          profile_path: actor && actor.profile_path,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch actor details:", err);
      setActorDetails({
        name: actorName || (actor && actor.name),
        profile_path: actor && actor.profile_path,
      });
    } finally {
      setLoadingActorDetails(false);
    }
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
        console.warn("Failed to fetch movie detail", error);
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

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          
          const toHex = (c: number) => {
            const hex = c.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
          };
          const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          setAccentColor(color);
        } else {
          setAccentColor("#E50914");
        }
      } catch (err) {
        console.warn("Canvas color extraction failed (probably CORS restrictions), using default:", err);
        setAccentColor("#E50914");
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setAccentColor("#E50914");
      }
    };
    img.src = imageUrl;

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
        console.warn("Failed to fetch related movies", error);
        
        // Hồi phục lỗi mượt mà sử dụng thể loại gốc
        try {
          const genreSlug = movie?.category?.[0]?.slug;
          if (genreSlug) {
            const res = await api.getByGenre(genreSlug, 1);
            const filtered = (res.items || []).filter((m: any) => m.slug !== slug);
            if (isMounted) setRelatedMovies(filtered.slice(0, 10));
          }
        } catch (innerError) {
          console.warn("Fallback related movies failed", innerError);
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
        const [imagesData, keywordsData] = await Promise.all([
          api.getMovieImages(movie.slug).catch(() => null),
          api.getMovieKeywords(movie.slug).catch(() => null),
        ]);
        if (imagesData && imagesData.images && imagesData.images.length > 0) {
          const uniqueImages = imagesData.images.filter((img: any, index: number, self: any[]) =>
            self.findIndex((i: any) => i.file_path === img.file_path) === index
          );
          if (uniqueImages.length > 0) {
            setImages(uniqueImages.slice(0, 16));
            gotImages = true;
          }
        }
        if (keywordsData && keywordsData.keywords && keywordsData.keywords.length > 0) {
          setKeywords(keywordsData.keywords);
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
        console.warn("[API] Failed to fetch images from phimapi:", err);
      }

      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      
      try {
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

        if (tmdbId) {
          // Lấy credits từ TMDb như yêu cầu
          const creditsUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${apiKey}&language=vi-VN`;
          const creditsData = await fetchWithCache(`tmdb_credits_${tmdbType}_${tmdbId}`, () => fetch(creditsUrl).then(r => r.json()), TTL.TMDB_STATIC);
          
          if (creditsData.cast) {
            setCast(creditsData.cast.slice(0, 12));
            gotPeoples = true;
          }
          
          if (!rating || !gotImages) {
             const detailUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=vi-VN&append_to_response=images&include_image_language=en,null,vi`;
             const detailData = await fetchWithCache(`tmdb_detail_${tmdbType}_${tmdbId}`, () => fetch(detailUrl).then(r => r.json()), TTL.TMDB_STATIC);

             if (!rating && detailData.vote_average) {
                let formattedVotes = '';
                if (detailData.vote_count) {
                  formattedVotes = detailData.vote_count >= 1000 
                     ? `${(detailData.vote_count / 1000).toFixed(1)}K` 
                     : `${detailData.vote_count}`;
                }
                setRating({
                  source: 'TMDb',
                  score: detailData.vote_average.toFixed(1),
                  votes: formattedVotes
                });
             }

             if (!gotImages) {
                let extendedImages: any[] = [];
                if (detailData.images?.backdrops?.length > 0) {
                  extendedImages = [...detailData.images.backdrops];
                }
                if (detailData.images?.posters?.length > 0 && extendedImages.length < 5) {
                  extendedImages = [...extendedImages, ...detailData.images.posters];
                }
                const uniqueImages = extendedImages.filter((img, index, self) =>
                  self.findIndex(i => i.file_path === img.file_path) === index
                );
                setImages(uniqueImages.slice(0, 16));
             }
          }
        }

      } catch (error) {
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
                          <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04c-5.5 0-10 4.48-10 10.02 0 5.01 3.66 9.15 8.44 9.9v-7.03H7.9v-2.87h2.54V9.89c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.87h-2.34v7.03c4.78-.75 8.44-4.89 8.44-9.9 0-5.54-4.5-10.02-10-10.02z" /></svg>
                          Chia sẻ Facebook
                        </button>
                        <button 
                          onClick={() => handleShare('twitter')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-[#1DA1F2]/20 transition-colors text-left cursor-pointer"
                        >
                          <svg className="w-4 h-4 text-[#1DA1F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M23.954 4.569c-.885.389-1.83.654-2.825.775 1.014-.611 1.794-1.574 2.163-2.723-.951.555-2.005.959-3.127 1.184-.896-.959-2.173-1.559-3.591-1.559-2.717 0-4.92 2.203-4.92 4.917 0 .39.045.765.127 1.124C7.691 8.094 4.066 6.13 1.64 3.161c-.427.722-.666 1.561-.666 2.475 0 1.71.87 3.213 2.188 4.096-.807-.026-1.566-.248-2.228-.616v.061c0 2.385 1.693 4.374 3.946 4.827-.413.111-.849.171-1.296.171-.314 0-.615-.03-.916-.086.631 1.953 2.445 3.377 4.604 3.417-1.68 1.319-3.809 2.105-6.102 2.105-.39 0-.779-.023-1.17-.067 2.189 1.394 4.768 2.209 7.557 2.209 9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63.961-.689 1.8-1.56 2.46-2.548l-.047-.02z" /></svg>
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
                    {/* Từ khóa */}
                    {keywords && keywords.length > 0 && (
                      <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex flex-col justify-center col-span-2 sm:col-span-3 md:col-span-4 shadow-lg">
                        <span className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Từ khóa</span>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {keywords.map((kw: any, idx: number) => {
                            const kwName = typeof kw === 'string' ? kw : (kw.name || kw.label);
                            if (!kwName) return null;
                            return (
                              <Link
                                key={idx}
                                to={`/tim-kiem?q=${encodeURIComponent(kwName)}`}
                                className="bg-[#E50914]/10 hover:bg-[#E50914]/20 text-red-400 text-xs px-2.5 py-1.5 rounded-md border border-[#E50914]/20 transition-colors"
                              >
                                #{kwName}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
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
                      cast.map((actor: any, idx: number) => {
                        const actorName = actor.name || "";
                        const enriched = enrichedActors[actorName.toLowerCase()] || {};
                        const profilePath = actor.profile_path || enriched.profile_path;
                        const character = actor.character || enriched.character;
                        return (
                          <motion.div 
                            key={idx} 
                            variants={itemVariants} 
                            onClick={() => handleActorClick(actor)}
                            className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center cursor-pointer group"
                          >
                            <div className="relative overflow-hidden rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A] aspect-square w-20 h-20 md:w-full md:h-auto md:aspect-[2/3]">
                              <LazyImage 
                                src={profilePath ? getImageUrl(`https://image.tmdb.org/t/p/w185${profilePath}`) : ""} 
                                alt={actor.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <span className="text-[10px] md:text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-full">Chi tiết</span>
                              </div>
                            </div>
                            <div className="font-semibold text-white group-hover:text-[#E50914] mb-1 text-xs md:text-sm line-clamp-1 w-full transition-colors" title={decodeHtml(actor.name)}>{decodeHtml(actor.name)}</div>
                            <div className="text-[10px] md:text-sm text-[#AAAAAA] line-clamp-1 w-full" title={decodeHtml(character || "")}>
                              {character ? `Vai: ${decodeHtml(character)}` : ''}
                            </div>
                          </motion.div>
                        );
                      })
                    ) : movie.actor && movie.actor.length > 0 && movie.actor[0] !== "Đang cập nhật" ? (
                      // Fallback to PhimAPI actors if TMDB fails
                      movie.actor.map((actorName: string, idx: number) => {
                        const enriched = enrichedActors[actorName.toLowerCase()] || {};
                        const profilePath = enriched.profile_path;
                        const character = enriched.character;
                        return (
                          <motion.div 
                            key={idx} 
                            variants={itemVariants} 
                            onClick={() => handleActorClick(actorName)}
                            className="text-center transition-transform duration-300 hover:-translate-y-1.5 flex flex-col items-center cursor-pointer group"
                          >
                            <div className="relative overflow-hidden rounded-full md:rounded-xl mb-2.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-[#2A2A2A] aspect-square w-20 h-20 md:w-full md:h-auto md:aspect-[2/3]">
                              <LazyImage 
                                src={profilePath ? getImageUrl(`https://image.tmdb.org/t/p/w185${profilePath}`) : ""} 
                                alt={actorName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <span className="text-[10px] md:text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-full">Chi tiết</span>
                              </div>
                            </div>
                            <div className="font-semibold text-white group-hover:text-[#E50914] mb-1 text-xs md:text-sm line-clamp-1 w-full transition-colors" title={decodeHtml(actorName)}>{decodeHtml(actorName)}</div>
                            <div className="text-[10px] md:text-sm text-[#AAAAAA] line-clamp-1 w-full" title={decodeHtml(character || "")}>
                              {character ? `Vai: ${decodeHtml(character)}` : ''}
                            </div>
                          </motion.div>
                        );
                      })
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

        {/* Actor Details Modal */}
        <AnimatePresence>
          {selectedActor && (
            <div 
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
              onClick={() => setSelectedActor(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3 }}
                className="relative w-full max-w-4xl bg-[#121212]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white"
                onClick={e => e.stopPropagation()}
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedActor(null)}
                  className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 hover:bg-[#E50914] text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {loadingActorDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-400 text-sm">Đang tải thông tin diễn viên...</p>
                  </div>
                ) : actorDetails ? (
                  <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Left Column: Avatar & Quick Info */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                      <img 
                        src={actorDetails.profile_path ? `https://image.tmdb.org/t/p/w500${actorDetails.profile_path}` : CAST_PLACEHOLDER}
                        alt={actorDetails.name}
                        className="w-48 h-72 md:w-full md:h-auto md:aspect-[2/3] object-cover rounded-xl shadow-xl border border-white/10 mb-4 bg-[#2A2A2A]"
                        referrerPolicy="no-referrer"
                      />
                      <h3 className="text-2xl font-bold font-heading mb-1">{actorDetails.name}</h3>
                      {actorDetails.place_of_birth && (
                        <p className="text-sm text-gray-400 mb-2">📍 {actorDetails.place_of_birth}</p>
                      )}
                      {actorDetails.birthday && (
                        <p className="text-sm text-gray-400 mb-2">📅 Ngày sinh: {actorDetails.birthday}</p>
                      )}
                      {actorDetails.deathday && (
                        <p className="text-sm text-gray-400 mb-2">💀 Ngày mất: {actorDetails.deathday}</p>
                      )}
                      {actorDetails.known_for_department && (
                        <p className="text-sm text-gray-400 mb-2">🎭 Lĩnh vực: {actorDetails.known_for_department === 'Acting' ? 'Diễn viên' : actorDetails.known_for_department}</p>
                      )}
                    </div>

                    {/* Right Column: Biography & Filmography */}
                    <div className="md:col-span-2 flex flex-col gap-6">
                      {/* Biography Section */}
                      <div>
                        <h4 className="text-lg font-bold font-heading text-[#E50914] mb-2 flex items-center gap-2">
                          <span className="w-1 h-5 bg-[#E50914] rounded-full inline-block"></span>
                          Tiểu sử
                        </h4>
                        <div className="text-gray-300 text-sm leading-relaxed max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                          {actorDetails.biography ? (
                            <p className="whitespace-pre-line">{actorDetails.biography}</p>
                          ) : (
                            <p className="italic text-gray-500">Chưa cập nhật tiểu sử cho diễn viên này.</p>
                          )}
                        </div>
                      </div>

                      {/* Filmography Section */}
                      <div>
                        <h4 className="text-lg font-bold font-heading text-[#E50914] mb-3 flex items-center gap-2">
                          <span className="w-1 h-5 bg-[#E50914] rounded-full inline-block"></span>
                          Phim đã tham gia
                        </h4>
                        {actorDetails.combined_credits?.cast && actorDetails.combined_credits.cast.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            {actorDetails.combined_credits.cast
                              .filter((credit: any) => credit.title || credit.name)
                              .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
                              .slice(0, 12)
                              .map((credit: any, index: number) => {
                                const title = credit.title || credit.name;
                                const character = credit.character;
                                return (
                                  <div 
                                    key={index} 
                                    className="bg-white/5 border border-white/5 hover:border-white/25 rounded-lg p-2 flex flex-col justify-between transition-all group"
                                  >
                                    <div className="flex gap-2">
                                      <img 
                                        src={credit.poster_path ? `https://image.tmdb.org/t/p/w92${credit.poster_path}` : CAST_PLACEHOLDER}
                                        alt={title}
                                        className="w-10 h-15 object-cover rounded bg-[#2A2A2A]"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="flex-grow min-w-0">
                                        <h5 className="font-semibold text-xs text-white line-clamp-2" title={title}>{title}</h5>
                                        {character && (
                                          <p className="text-[10px] text-gray-400 line-clamp-1" title={character}>as {character}</p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedActor(null);
                                        navigate(`/search?q=${encodeURIComponent(title)}`);
                                      }}
                                      className="mt-2 w-full bg-[#E50914]/10 hover:bg-[#E50914] text-[#E50914] hover:text-white border border-[#E50914]/20 hover:border-transparent text-[10px] py-1 px-2 rounded font-semibold transition-all text-center cursor-pointer"
                                    >
                                      Tìm phim trên Cineverse
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="italic text-gray-500 text-sm">Không có thông tin phim tham gia.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-20 text-gray-400">
                    Không tìm thấy thông tin chi tiết.
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
