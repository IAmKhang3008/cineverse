import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { motion } from "motion/react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  
  useDocumentTitle(`Tìm kiếm: ${query} | Cineverse`);

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSearch = async () => {
      if (!query) return;
      setLoading(true);
      try {
        const res = await api.search(query);
        setMovies(res.items || []);
      } catch (error) {
        console.error("Failed to search movies", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSearch();
  }, [query]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16"
    >
      <h1 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wider mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 bg-[#E50914] rounded-full inline-block"></span>
        Kết quả tìm kiếm cho: <span className="text-[#E50914]">{query}</span>
      </h1>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl skeleton"></div>
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
          {movies.map((movie, index) => (
            <MovieCard key={`${movie.slug || movie._id || 'search'}-${index}`} movie={movie} fromSearch={true} />
          ))}
        </div>
      ) : (
        <div className="text-center text-[#A0A0A0] py-16 md:py-20 bg-[#121212] rounded-2xl border border-white/5 px-4">
          <p className="text-lg md:text-xl font-medium">Không tìm thấy kết quả nào phù hợp.</p>
          <p className="text-xs md:text-sm mt-2">Vui lòng thử lại với từ khóa khác.</p>
        </div>
      )}
    </motion.div>
  );
}
