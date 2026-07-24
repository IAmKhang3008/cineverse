import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { MovieCardSkeleton } from "@/components/Skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";
import FilterBar, { FilterState } from "@/components/FilterBar";

export default function Series() {
  useDocumentTitle("Phim Bộ | Cineverse");
  
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showToast } = useToast();
  
  const [filters, setFilters] = useState<FilterState>({
    category: "",
    country: "",
    year: "",
    sort_field: "modified.time",
    sort_type: "desc"
  });

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getByCategory("phim-bo", page, filters);
      setMovies(res.items || []);
      const totalItems = res.pagination?.totalItems || res.items?.length || 0;
      setTotalPages(res.pagination?.totalPages || Math.ceil(totalItems / 24) || 1);
    } catch (error) {
      console.warn("Lỗi khi tải phim bộ:", error);
      showToast("Không thể tải danh sách phim. Vui lòng kiểm tra kết nối mạng.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, filters, showToast]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16 text-white">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 md:mb-6 transition-colors text-sm md:text-base">
        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Quay lại trang chủ
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4 md:gap-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-wider flex items-center gap-3">
          <span className="w-1.5 h-6 md:h-8 bg-[#E50914] rounded-full inline-block"></span>
          Phim Bộ
        </h1>
      </div>

      <FilterBar initialFilters={filters} onFilterChange={handleFilterChange} />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
          {[...Array(10)].map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {movies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
              {movies.map((movie, index) => (
                <MovieCard key={movie._id || index} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 md:py-20 text-gray-500 text-sm md:text-base">
              Không tìm thấy phim phù hợp với bộ lọc.
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-12 md:mt-16 gap-2 md:gap-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 md:px-6 md:py-2 bg-[#2A2A2A] rounded-lg disabled:opacity-30 hover:bg-[#333] text-sm md:text-base"
              >
                Trước
              </button>
              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-lg font-bold text-sm md:text-base ${p === page ? "bg-[#E50914]" : "bg-[#2A2A2A] hover:bg-[#333]"}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 md:px-6 md:py-2 bg-[#2A2A2A] rounded-lg disabled:opacity-30 hover:bg-[#333] text-sm md:text-base"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
