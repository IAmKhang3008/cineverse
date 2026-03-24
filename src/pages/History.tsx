import { useEffect, useState } from "react";
import { useHistory } from "@/hooks/useHistory";
import { Link } from "react-router-dom";
import { Play, Trash2, ArrowLeft, Clock } from "lucide-react";
import { getImageUrl } from "@/lib/api";

export default function History() {
  const { history, removeFromHistory, clearHistory } = useHistory();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("cineverse_settings");
    setIsLoggedIn(!!user);
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-32 mt-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 rounded-full mb-6 border border-white/10">
          <Clock className="w-10 h-10 text-[#3B82F6]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Lịch sử xem phim</h1>
        <p className="text-gray-400 max-w-md mx-auto mb-8">
          Vui lòng đăng nhập để Cineverse giúp bạn ghi nhớ những bộ phim đang xem dở và tập phim mới nhất.
        </p>
        <Link to="/login" className="bg-[#E50914] text-white px-8 py-3 rounded-full font-bold hover:bg-[#b80710] transition-all">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16">
      <Link 
        to="/" 
        className="back-btn inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 md:mb-6 transition-colors font-medium text-sm md:text-base"
      >
        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
        Quay lại trang chủ
      </Link>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wider flex items-center gap-2 md:gap-3">
          <span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block"></span>
          Lịch Sử Xem
        </h1>
        {history.length > 0 && (
          <button 
            onClick={clearHistory}
            className="btn text-xs md:text-sm text-[#E50914] hover:text-[#b80710] transition-colors flex items-center gap-1.5 md:gap-2 font-medium bg-[#E50914]/10 hover:bg-[#E50914]/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> Xóa tất cả
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item, index) => (
            <div key={`${item.slug || 'history'}-${index}`} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-[#121212] p-3 sm:p-4 rounded-2xl border border-white/5 hover:bg-[#1a1a1a] transition-colors group relative">
              <Link to={`/watch/${item.slug}`} className="w-full sm:w-48 md:w-64 aspect-video rounded-xl overflow-hidden relative flex-shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <img src={getImageUrl(item.thumb_url || item.poster_url)} alt={item.name} className="w-full h-full object-cover group-hover:opacity-40 transition-opacity duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#E50914] flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Play className="w-4 h-4 md:w-5 md:h-5 text-white ml-1" fill="currentColor" />
                  </div>
                </div>
                {/* Progress bar simulation */}
                <div className="absolute bottom-0 left-0 right-0 h-1 md:h-1.5 bg-black/50 backdrop-blur-sm">
                  <div className="h-full bg-[#E50914]" style={{ width: `${item.progress || Math.random() * 100}%` }}></div>
                </div>
              </Link>
              
              <div className="flex-grow w-full py-1 sm:py-2 pr-8 sm:pr-0">
                <Link to={`/watch/${item.slug}`}>
                  <h3 className="text-lg md:text-xl font-heading font-bold text-white group-hover:text-[#E50914] transition-colors line-clamp-1 mb-1">{item.name}</h3>
                </Link>
                <p className="text-[#A0A0A0] text-xs md:text-sm mb-2 md:mb-4 line-clamp-1">{item.origin_name}</p>
                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
                  <span className="bg-[#2A2A2A] text-white px-2 py-0.5 md:px-3 md:py-1 rounded-md font-medium border border-white/10">Tập {item.currentEpisode}</span>
                  <span className="text-[#A0A0A0]">•</span>
                  <span className="text-[#A0A0A0]">{new Date(item.viewedAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <button 
                onClick={() => removeFromHistory(item.slug)}
                className="btn p-2 md:p-3 text-[#A0A0A0] hover:text-[#E50914] hover:bg-[#E50914]/10 rounded-xl transition-colors flex-shrink-0 absolute top-2 right-2 sm:static"
                title="Xóa khỏi lịch sử"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-[#A0A0A0] py-16 md:py-20 bg-[#121212] rounded-2xl border border-white/5 px-4">
          <p className="text-lg md:text-xl font-medium">Bạn chưa xem phim nào.</p>
          <p className="text-xs md:text-sm mt-2">Hãy khám phá các bộ phim hấp dẫn trên Cineverse.</p>
        </div>
      )}
    </div>
  );
}
