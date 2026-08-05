import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { motion, AnimatePresence } from "motion/react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";
import { Search as SearchIcon, Filter } from "lucide-react";

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

const YEARS = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i);

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const country = searchParams.get("country") || "";
  const year = searchParams.get("year") || "";
  const sort_field = searchParams.get("sort_field") || "modified.time";
  const sort_type = searchParams.get("sort_type") || "desc";
  const sort_lang = searchParams.get("sort_lang") || "";
  
  useDocumentTitle(`Tìm kiếm: ${query} | Cineverse`);

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultCount, setResultCount] = useState(0);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showToast } = useToast();
  const [showFilters, setShowFilters] = useState(false);

  // Reset page về 1 khi các tham số tìm kiếm thay đổi
  useEffect(() => {
    setPage(1);
  }, [query, category, country, year, sort_field, sort_type, sort_lang]);

  useEffect(() => {
    let isMounted = true;
    const fetchSearch = async () => {
      // Allow searching even without keyword if filters are present
      if (!query && !category && !country && !year) {
        setMovies([]);
        setResultCount(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const start = performance.now();
      try {
        const filters = {
          category: category || undefined,
          country: country || undefined,
          year: year || undefined,
          sort_field: sort_field !== "modified.time" ? sort_field : undefined,
          sort_type: sort_type !== "desc" ? sort_type : undefined,
          sort_lang: sort_lang || undefined,
        };
        const res = await api.search(query, page, 64, filters);
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
        console.warn("Failed to search movies", error);
        showToast("Không thể tải kết quả tìm kiếm. Vui lòng kiểm tra kết nối mạng.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSearch();
    return () => { isMounted = false };
  }, [query, category, country, year, sort_field, sort_type, sort_lang, page, showToast]);

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  // Tính toán các trang hiển thị xung quanh trang hiện tại
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <SearchIcon className="w-7 h-7 md:w-8 md:h-8 text-[#E50914]" />
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-white tracking-wide">
                {query || "Bộ Lọc Phim"}
              </h1>
            </div>
            {!loading && (query || category || country || year) && (
              <p className="text-sm md:text-base text-[#A0A0A0] font-medium">
                {resultCount > 0
                  ? `${resultCount} kết quả được tìm thấy${searchTime ? ` trong ${(searchTime / 1000).toFixed(2)} giây` : ""}`
                  : "Không tìm thấy kết quả nào phù hợp"}
              </p>
            )}
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${showFilters ? 'bg-[#E50914] text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            <Filter className="w-4 h-4" />
            Lọc Kết Quả
          </button>
        </div>
        
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 24 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-6 border-t border-white/10">
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Thể loại</label>
                  <select 
                    value={category} 
                    onChange={(e) => updateParam("category", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="">Tất cả</option>
                    <option value="hanh-dong">Hành động</option>
                    <option value="tinh-cam">Tình cảm</option>
                    <option value="hai-huoc">Hài hước</option>
                    <option value="kinh-di">Kinh dị</option>
                    <option value="hoat-hinh">Hoạt hình</option>
                    <option value="khoa-hoc-vien-tuong">Khoa học viễn tưởng</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Quốc gia</label>
                  <select 
                    value={country} 
                    onChange={(e) => updateParam("country", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="">Tất cả</option>
                    <option value="au-my">Âu Mỹ</option>
                    <option value="han-quoc">Hàn Quốc</option>
                    <option value="trung-quoc">Trung Quốc</option>
                    <option value="nhat-ban">Nhật Bản</option>
                    <option value="thai-lan">Thái Lan</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Năm phát hành</label>
                  <select 
                    value={year} 
                    onChange={(e) => updateParam("year", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="">Tất cả</option>
                    {YEARS.map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Sắp xếp theo</label>
                  <select 
                    value={sort_field} 
                    onChange={(e) => updateParam("sort_field", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="modified.time">Ngày cập nhật</option>
                    <option value="_id">ID (Mới nhất)</option>
                    <option value="year">Năm sản xuất</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Thứ tự</label>
                  <select 
                    value={sort_type} 
                    onChange={(e) => updateParam("sort_type", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="desc">Giảm dần</option>
                    <option value="asc">Tăng dần</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-[#A0A0A0]">Ngôn ngữ</label>
                  <select 
                    value={sort_lang} 
                    onChange={(e) => updateParam("sort_lang", e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="">Tất cả</option>
                    <option value="vietsub">Vietsub</option>
                    <option value="thuyet-minh">Thuyết minh</option>
                    <option value="long-tieng">Lồng tiếng</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl skeleton bg-white/5 animate-pulse"></div>
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
      {!loading && movies.length === 0 && (query || category || country || year) && (
        <div className="text-center text-[#A0A0A0] py-16 md:py-20 backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-3xl px-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <SearchIcon className="w-12 h-12 md:w-16 md:h-16 text-[#E50914]/50 mx-auto mb-6" />
          <p className="text-lg md:text-xl font-medium">Không tìm thấy kết quả nào phù hợp.</p>
          <p className="text-xs md:text-sm mt-2 mb-6">Vui lòng thử lại với từ khóa hoặc bộ lọc khác.</p>
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
