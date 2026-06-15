import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { motion } from "motion/react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";
import { Search as SearchIcon } from "lucide-react";

// Stagger animation variants
const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const ITEMS_PER_PAGE = 15;

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  
  useDocumentTitle(`Tìm kiếm: ${query} | Cineverse`);

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultCount, setResultCount] = useState(0);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showToast } = useToast();

  // Reset page về 1 khi query thay đổi
  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    let isMounted = true;
    const fetchSearch = async () => {
      if (!query) {
        setMovies([]);
        setResultCount(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      setLoading(true);
      const start = performance.now();
      try {
        const res = await api.search(query, page, 64);
        const end = performance.now();
        if (isMounted) {
          setMovies(res.items || []);
          const totalItems = res.pagination?.totalItems || res.items?.length || 0;
          const totalPgs = res.pagination?.totalPages || Math.ceil(totalItems / 64) || 1;
          setResultCount(totalItems);
          setTotalPages(totalPgs);
          setSearchTime(end - start);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to search movies", error);
        showToast("Không thể tải kết quả tìm kiếm. Vui lòng kiểm tra kết nối mạng.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSearch();
    return () => { isMounted = false };
  }, [query, page, showToast]);

  // Tính toán các trang hiển thị xung quanh trang hiện tại
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5; // số nút trang hiển thị tối đa
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      if (i >= 1 && i <= totalPages) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16"
    >
      {/* Glassmorphism Search Hero */}
      <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8 mb-8 md:mb-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <SearchIcon className="w-7 h-7 md:w-8 md:h-8 text-[#E50914]" />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-white tracking-wide">
              {query}
            </h1>
          </div>
          {!loading && (
            <p className="text-sm md:text-base text-[#A0A0A0] font-medium">
              {resultCount > 0
                ? `${resultCount} kết quả được tìm thấy${searchTime ? ` trong ${(searchTime / 1000).toFixed(2)} giây` : ""}`
                : "Không tìm thấy kết quả nào phù hợp"}
            </p>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl skeleton"></div>
          ))}
        </div>
      )}

      {/* Results grid with stagger animation + pagination */}
      {!loading && movies.length > 0 && (
        <>
          <motion.div
            key={page} // Re-trigger animation khi đổi trang
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10"
          >
            {movies.map((movie, index) => (
              <motion.div
                key={`${movie.slug || movie._id || 'search'}-${index}`}
                variants={itemVariants}
              >
                <MovieCard movie={movie} fromSearch={true} />
              </motion.div>
            ))}
          </motion.div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 md:mt-16 gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 md:px-4 md:py-2 bg-[#2A2A2A] rounded-lg disabled:opacity-30 hover:bg-[#333] text-sm md:text-base text-white transition-colors"
              >
                Trước
              </button>

              {getPageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-lg font-bold text-sm md:text-base transition-colors ${
                    p === page
                      ? "bg-[#E50914] text-white"
                      : "bg-[#2A2A2A] text-white hover:bg-[#333]"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 md:px-4 md:py-2 bg-[#2A2A2A] rounded-lg disabled:opacity-30 hover:bg-[#333] text-sm md:text-base text-white transition-colors"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state with suggestions */}
      {!loading && movies.length === 0 && query && (
        <div className="text-center text-[#A0A0A0] py-16 md:py-20 backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-3xl px-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <SearchIcon className="w-12 h-12 md:w-16 md:h-16 text-[#E50914]/50 mx-auto mb-6" />
          <p className="text-lg md:text-xl font-medium">Không tìm thấy kết quả nào phù hợp.</p>
          <p className="text-xs md:text-sm mt-2 mb-6">Vui lòng thử lại với từ khóa khác.</p>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {["Mario", "Sonic", "Disney", "Marvel", "Avengers", "Star Wars", "Anime", "Hàn Quốc"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  window.location.href = `/search?q=${encodeURIComponent(suggestion)}`;
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 hover:text-white transition-colors backdrop-blur-md"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
