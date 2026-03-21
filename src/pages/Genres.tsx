import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const GENRES = [
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Thể Thao", slug: "the-thao" },
  { name: "Võ Thuật", slug: "vo-thuat" },
  { name: "Viễn Tưởng", slug: "vien-tuong" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Khoa Học", slug: "khoa-hoc" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Thần Thoại", slug: "than-thoai" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Chính kịch", slug: "chinh-kich" },
  { name: "Bí ẩn", slug: "bi-an" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Kinh Điển", slug: "kinh-dien" }
];

export default function Genres() {
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].slug);
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const res = await api.getByGenre(selectedGenre, page);
        setMovies(res.items || []);
      } catch (error) {
        console.error("Failed to fetch movies by genre", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, [selectedGenre, page]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16">
      <h1 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wider mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 bg-[#F5C518] rounded-full inline-block"></span>
        Thể Loại Phim
      </h1>

      <div className="flex flex-wrap gap-2 md:gap-3 mb-8 md:mb-12">
        {GENRES.map((genre) => (
          <button
            key={genre.slug}
            onClick={() => {
              setSelectedGenre(genre.slug);
              setPage(1);
            }}
            className={`btn px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all ${
              selectedGenre === genre.slug
                ? "bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.4)]"
                : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333] hover:text-white"
            }`}
          >
            {genre.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl skeleton-loader bg-[#2A2A2A]"></div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
            {movies.map((movie, index) => (
              <MovieCard key={`${movie.slug || movie._id || 'genre'}-${index}`} movie={movie} />
            ))}
          </div>

          <div className="flex justify-center mt-12 md:mt-16 gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn px-4 py-2 md:px-6 md:py-2.5 bg-[#2A2A2A] hover:bg-[#333] disabled:opacity-50 disabled:hover:bg-[#2A2A2A] rounded-lg text-white font-medium transition-colors text-sm md:text-base"
            >
              Trước
            </button>
            <div className="flex items-center gap-1 px-2">
               <span className="w-8 md:w-10 h-8 md:h-10 flex items-center justify-center bg-[#E50914] rounded-lg text-white font-bold text-sm md:text-base shadow-[0_4px_14px_rgba(229,9,20,0.4)]">
                {page}
              </span>
            </div>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="btn px-4 py-2 md:px-6 md:py-2.5 bg-[#2A2A2A] hover:bg-[#333] rounded-lg text-white font-medium transition-colors text-sm md:text-base"
            >
              Sau
            </button>
          </div>
        </>
      )}
    </div>
  );
}
