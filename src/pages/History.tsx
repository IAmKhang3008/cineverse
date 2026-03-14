import { useHistory } from "@/hooks/useHistory";
import { Link } from "react-router-dom";
import { Play, Trash2, ArrowLeft } from "lucide-react";
import { getImageUrl } from "@/lib/api";

export default function History() {
  const { history, removeFromHistory, clearHistory } = useHistory();

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 mt-16">
      <Link 
        to="/" 
        className="back-btn inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Quay lại trang chủ
      </Link>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-heading font-bold text-white tracking-wider flex items-center gap-3">
          <span className="w-1.5 h-8 bg-[#3B82F6] rounded-full inline-block"></span>
          Lịch Sử Xem
        </h1>
        {history.length > 0 && (
          <button 
            onClick={clearHistory}
            className="btn text-sm text-[#E50914] hover:text-[#b80710] transition-colors flex items-center gap-2 font-medium bg-[#E50914]/10 hover:bg-[#E50914]/20 px-4 py-2 rounded-lg"
          >
            <Trash2 className="w-4 h-4" /> Xóa tất cả
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item, index) => (
            <div key={`${item.slug || 'history'}-${index}`} className="flex flex-col sm:flex-row items-center gap-6 bg-[#121212] p-4 rounded-2xl border border-white/5 hover:bg-[#1a1a1a] transition-colors group">
              <Link to={`/watch/${item.slug}`} className="w-full sm:w-64 aspect-video rounded-xl overflow-hidden relative flex-shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <img src={getImageUrl(item.thumb_url || item.poster_url)} alt={item.name} className="w-full h-full object-cover group-hover:opacity-40 transition-opacity duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-[#E50914] flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Play className="w-5 h-5 text-white ml-1" fill="currentColor" />
                  </div>
                </div>
                {/* Progress bar simulation */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 backdrop-blur-sm">
                  <div className="h-full bg-[#E50914]" style={{ width: `${item.progress || Math.random() * 100}%` }}></div>
                </div>
              </Link>
              
              <div className="flex-grow w-full py-2">
                <Link to={`/watch/${item.slug}`}>
                  <h3 className="text-xl font-heading font-bold text-white group-hover:text-[#E50914] transition-colors line-clamp-1 mb-1">{item.name}</h3>
                </Link>
                <p className="text-[#A0A0A0] text-sm mb-4">{item.origin_name}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="bg-[#2A2A2A] text-white px-3 py-1 rounded-md font-medium border border-white/10">Tập {item.currentEpisode}</span>
                  <span className="text-[#A0A0A0]">•</span>
                  <span className="text-[#A0A0A0]">{new Date(item.viewedAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <button 
                onClick={() => removeFromHistory(item.slug)}
                className="btn p-3 text-[#A0A0A0] hover:text-[#E50914] hover:bg-[#E50914]/10 rounded-xl transition-colors flex-shrink-0"
                title="Xóa khỏi lịch sử"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-[#A0A0A0] py-20 bg-[#121212] rounded-2xl border border-white/5">
          <p className="text-xl font-medium">Bạn chưa xem phim nào.</p>
          <p className="text-sm mt-2">Hãy khám phá các bộ phim hấp dẫn trên Cineverse.</p>
        </div>
      )}
    </div>
  );
}
