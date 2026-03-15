import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { Filter, RotateCcw, ChevronDown, ArrowLeft, Search } from "lucide-react";
import { Link } from "react-router-dom";

const YEARS = Array.from({ length: 25 }, (_, i) => (2026 - i).toString());
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
const COUNTRIES = [
  { name: "Âu Mỹ", slug: "au-my" },
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Đài Loan", slug: "dai-loan" },
  { name: "Ấn Độ", slug: "an-do" }
];

export default function Movies() {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  // State tạm thời (Dùng cho các ô Select)
  const [tempGenre, setTempGenre] = useState("");
  const [tempCountry, setTempCountry] = useState("");
  const [tempYear, setTempYear] = useState("");

  // State thực tế (Dùng để gọi API)
  const [filters, setFilters] = useState({
    genre: "",
    country: "",
    year: "",
  });

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      // Ưu tiên lọc theo thứ tự API hỗ trợ
      if (filters.genre) {
        res = await api.getByGenre(filters.genre, page);
      } else if (filters.country) {
        res = await api.getByCountry(filters.country, page);
      } else if (filters.year) {
        res = await api.getByYear(filters.year, page);
      } else {
        res = await api.getByCategory("phim-le", page);
      }

      let items = res?.items || [];
      
      // Nếu lọc genre nhưng user có chọn thêm Year ở client-side
      if (filters.genre && filters.year) {
        items = items.filter((m: any) => m.year?.toString() === filters.year);
      }

      setMovies(items);
    } catch (error) {
      console.error("Lỗi khi tải phim:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  // Gọi lại API khi filters hoặc page thay đổi
  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  // Hàm xử lý khi nhấn "Áp dụng bộ lọc"
  const handleApplyFilter = () => {
    setPage(1); // Reset về trang 1
    setFilters({
      genre: tempGenre,
      country: tempCountry,
      year: tempYear
    });
  };

  // Hàm Reset
  const handleReset = () => {
    setTempGenre("");
    setTempCountry("");
    setTempYear("");
    setFilters({ genre: "", country: "", year: "" });
    setPage(1);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 mt-16 text-white">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" /> Quay lại trang chủ
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <h1 className="text-3xl font-bold tracking-wider flex items-center gap-3">
          <span className="w-1.5 h-8 bg-[#E50914] rounded-full inline-block"></span>
          Phim Lẻ
        </h1>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 mb-12 flex flex-wrap items-end gap-4 shadow-xl">
        {/* Thể loại */}
        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase">Thể loại</label>
          <select 
            value={tempGenre}
            onChange={(e) => setTempGenre(e.target.value)}
            className="bg-[#2A2A2A] text-white text-sm rounded-lg px-4 py-2.5 outline-none hover:bg-[#333] transition-colors min-w-[160px] cursor-pointer"
          >
            <option value="">Tất cả thể loại</option>
            {GENRES.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>

        {/* Quốc gia */}
        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase">Quốc gia</label>
          <select 
            value={tempCountry}
            onChange={(e) => setTempCountry(e.target.value)}
            className="bg-[#2A2A2A] text-white text-sm rounded-lg px-4 py-2.5 outline-none hover:bg-[#333] transition-colors min-w-[160px] cursor-pointer"
          >
            <option value="">Tất cả quốc gia</option>
            {COUNTRIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        {/* Năm */}
        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase">Năm</label>
          <select 
            value={tempYear}
            onChange={(e) => setTempYear(e.target.value)}
            className="bg-[#2A2A2A] text-white text-sm rounded-lg px-4 py-2.5 outline-none hover:bg-[#333] transition-colors min-w-[120px] cursor-pointer"
          >
            <option value="">Tất cả năm</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex-grow"></div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleApplyFilter}
            className="bg-[#E50914] hover:bg-[#b80710] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 active:scale-95"
          >
            <Filter className="w-4 h-4" /> Áp dụng
          </button>
          <button 
            onClick={handleReset}
            className="border border-white/20 hover:bg-white/10 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Đặt lại
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-[#2A2A2A] animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          {movies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
              {movies.map((movie, index) => (
                <MovieCard key={movie._id || index} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              Không tìm thấy phim phù hợp với bộ lọc.
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-center mt-16 gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2 bg-[#2A2A2A] rounded-lg disabled:opacity-30 hover:bg-[#333]"
            >
              Trước
            </button>
            <span className="flex items-center justify-center bg-[#E50914] w-10 h-10 rounded-lg font-bold">
              {page}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2 bg-[#2A2A2A] rounded-lg hover:bg-[#333]"
            >
              Sau
            </button>
          </div>
        </>
      )}
    </div>
  );
}
