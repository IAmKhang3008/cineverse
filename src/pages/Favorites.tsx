import { useEffect, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import MovieCard from "@/components/MovieCard";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";

export default function Favorites() {
  const { favorites } = useFavorites();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("cineverse_settings");
    setIsLoggedIn(!!user);
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-32 mt-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 rounded-full mb-6 border border-white/10">
          <Lock className="w-10 h-10 text-[#F5C518]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Tính năng giới hạn</h1>
        <p className="text-gray-400 max-w-md mx-auto mb-8">
          Bạn cần đăng nhập để trải nghiệm tính năng lưu trữ phim yêu thích và đồng bộ danh sách trên mọi thiết bị.
        </p>
        <Link to="/login" className="bg-[#E50914] text-white px-8 py-3 rounded-full font-bold hover:bg-[#b80710] transition-all">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 mt-16">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Quay lại trang chủ
      </Link>
      <h1 className="text-3xl font-heading font-bold text-white tracking-wider mb-8 flex items-center gap-3">
        <span className="w-1.5 h-8 bg-[#F5C518] rounded-full inline-block"></span>
        Phim Yêu Thích
      </h1>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
          {favorites.map((movie, index) => (
            <MovieCard key={`${movie.slug || 'fav'}-${index}`} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="text-center text-[#A0A0A0] py-20 bg-[#121212] rounded-2xl border border-white/5">
          <p className="text-xl font-medium">Bạn chưa thêm phim nào vào danh sách yêu thích.</p>
          <p className="text-sm mt-2">Nhấn vào biểu tượng trái tim trên phim để thêm vào danh sách này.</p>
        </div>
      )}
    </div>
  );
}
