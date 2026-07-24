import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MovieCardSkeleton } from "@/components/Skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";
import { GENRES } from "@/lib/constants";
import FilterBar, { FilterState } from "@/components/FilterBar";

export default function Genres() {
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].slug);
  const currentGenreName = GENRES.find(g => g.slug === selectedGenre)?.name || "Thể Loại";
  
  useDocumentTitle(`Phim ${currentGenreName} | Cineverse`);
  
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
      const res = await api.getByGenre(selectedGenre, page, filters);
      setMovies(res.items || []);
      const totalItems = res.pagination?.totalItems || res.items?.length || 0;
      setTotalPages(res.pagination?.totalPages || Math.ceil(totalItems / 24) || 1);
    } catch (error) {
      console.warn("Failed to fetch movies by genre", error);
      showToast("Không thể tải danh sách phim. Vui lòng kiểm tra kết nối mạng.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, page, filters, showToast]);

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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 md:mb-6 transition-colors text-sm md:text-base">
        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Quay lại trang chủ
      </Link>

      <h1 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wider mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block"></span>
        Thể Loại Phim
      </h1>

      <div className="flex flex-wrap gap-2 md:gap-3 mb-6">
        {GENRES.map((genre) => (
          <button
            key={genre.slug}
            onClick={() => {
              setSelectedGenre(genre.slug);
              setPage(1);
            }}
            className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all ${
              selectedGenre === genre.slug
                ? "bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.4)]"
                : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333] hover:text-white"
            }`}
          >
            {genre.name}
          </button>
        ))}
      </div>

      <FilterBar initialFilters={filters} onFilterChange={handleFilterChange} hideCategory={true} />

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
                <MovieCard key={`${movie.slug || movie._id || 'genre'}-${index}`} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 md:py-20 text-gray-500 text-sm md:text-base">
              Không tìm thấy phim phù hợp với bộ lọc.
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-12 md:mt-16 gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 md:px-6 md:py-2.5 bg-[#2A2A2A] hover:bg-[#333] disabled:opacity-50 rounded-lg text-white font-medium transition-colors text-sm md:text-base"
              >
                Trước
              </button>
              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-lg font-bold text-sm md:text-base ${p === page ? "bg-[#E50914] text-white" : "bg-[#2A2A2A] text-white hover:bg-[#333]"}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 md:px-6 md:py-2.5 bg-[#2A2A2A] hover:bg-[#333] disabled:opacity-50 rounded-lg text-white font-medium transition-colors text-sm md:text-base"
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
