import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { Filter, RotateCcw, ChevronDown, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const YEARS = Array.from({ length: 25 }, (_, i) => (2024 - i).toString());
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
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        let res;
        // PhimAPI doesn't support multi-filter, so we prioritize: Genre > Country > Year > Default
        if (selectedGenre) {
          res = await api.getByGenre(selectedGenre, page);
        } else if (selectedCountry) {
          res = await api.getByCountry(selectedCountry, page);
        } else if (selectedYear) {
          res = await api.getByYear(selectedYear, page);
        } else {
          res = await api.getByCategory("phim-le", page);
        }
        
        // Client-side filtering for secondary filters if needed (only applies to current page)
        let filteredItems = res.items || [];
        if (selectedGenre && (selectedCountry || selectedYear)) {
          if (selectedYear) filteredItems = filteredItems.filter((m: any) => m.year?.toString() === selectedYear);
        } else if (selectedCountry && selectedYear) {
          filteredItems = filteredItems.filter((m: any) => m.year?.toString() === selectedYear);
        }

        setMovies(filteredItems);
      } catch (error) {
        console.error("Failed to fetch movies", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, [page, selectedYear, selectedGenre, selectedCountry]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 mt-16">
      <Link 
        to="/" 
        className="back-btn inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Quay lại trang chủ
      </Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <h1 className="text-3xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
          <span className="w-1.5 h-8 bg-[#E50914] rounded-full inline-block"></span>
          Phim Lẻ
        </h1>
        
        <div className="flex items-center gap-4">
          <span className="text-[#A0A0A0] text-sm font-medium">Sắp xếp:</span>
          <div className="relative group">
            <button className="flex items-center gap-2 bg-[#2A2A2A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors">
              Mới nhất <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 mb-12 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wider">Thể loại</label>
          <select 
            value={selectedGenre}
            onChange={(e) => { setSelectedGenre(e.target.value); setPage(1); }}
            className="bg-[#2A2A2A] border-none text-white text-sm rounded-lg px-4 py-2.5 outline-none appearance-none pr-8 cursor-pointer hover:bg-[#333] transition-colors min-w-[160px]"
          >
            <option value="">Tất cả thể loại</option>
            {GENRES.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wider">Quốc gia</label>
          <select 
            value={selectedCountry}
            onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
            className="bg-[#2A2A2A] border-none text-white text-sm rounded-lg px-4 py-2.5 outline-none appearance-none pr-8 cursor-pointer hover:bg-[#333] transition-colors min-w-[160px]"
          >
            <option value="">Tất cả quốc gia</option>
            {COUNTRIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wider">Năm phát hành</label>
          <select 
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
            className="bg-[#2A2A2A] border-none text-white text-sm rounded-lg px-4 py-2.5 outline-none appearance-none pr-8 cursor-pointer hover:bg-[#333] transition-colors min-w-[160px]"
          >
            <option value="">Tất cả năm</option>
            {YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wider">Điểm IMDb</label>
          <select className="bg-[#2A2A2A] border-none text-white text-sm rounded-lg px-4 py-2.5 outline-none appearance-none pr-8 cursor-pointer hover:bg-[#333] transition-colors min-w-[160px]">
            <option value="">Tất cả</option>
            <option value="9">Từ 9 sao trở lên</option>
            <option value="8">Từ 8 sao trở lên</option>
            <option value="7">Từ 7 sao trở lên</option>
            <option value="6">Từ 6 sao trở lên</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wider">Ngôn ngữ</label>
          <select className="bg-[#2A2A2A] border-none text-white text-sm rounded-lg px-4 py-2.5 outline-none appearance-none pr-8 cursor-pointer hover:bg-[#333] transition-colors min-w-[160px]">
            <option value="">Tất cả</option>
            <option value="viet_sub">Vietsub</option>
            <option value="thuyet_minh">Thuyết minh</option>
            <option value="long_tieng">Lồng tiếng</option>
            <option value="song_ngu">Song ngữ</option>
          </select>
        </div>

        <div className="flex-grow"></div>

        <div className="flex items-center gap-3">
          <button className="btn bg-[#E50914] hover:bg-[#b80710] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_4px_14px_rgba(229,9,20,0.4)]">
            Áp dụng bộ lọc
          </button>
          <button 
            onClick={() => { setSelectedYear(""); setSelectedGenre(""); setSelectedCountry(""); setPage(1); }}
            className="btn bg-transparent border border-white/20 hover:bg-white/10 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Đặt lại
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl skeleton-loader bg-[#2A2A2A]"></div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
            {movies.map((movie, index) => (
              <MovieCard key={`${movie.slug || movie._id || 'movie'}-${index}`} movie={movie} />
            ))}
          </div>

          <div className="flex justify-center mt-16 gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2.5 bg-[#2A2A2A] hover:bg-[#333] disabled:opacity-50 disabled:hover:bg-[#2A2A2A] rounded-lg text-white font-medium transition-colors"
            >
              Trước
            </button>
            <div className="flex items-center gap-1 px-2">
               <span className="w-10 h-10 flex items-center justify-center bg-[#E50914] rounded-lg text-white font-bold shadow-[0_4px_14px_rgba(229,9,20,0.4)]">
                {page}
              </span>
            </div>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-6 py-2.5 bg-[#2A2A2A] hover:bg-[#333] rounded-lg text-white font-medium transition-colors"
            >
              Sau
            </button>
          </div>
        </>
      )}
    </div>
  );
}
