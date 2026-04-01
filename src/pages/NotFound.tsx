import { Link } from "react-router-dom";
import { Home, Compass } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Không tìm thấy trang | Cineverse");
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#E50914]/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative z-10">
        <h1 className="text-[150px] md:text-[200px] font-heading font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20 drop-shadow-[0_0_40px_rgba(229,9,20,0.3)] mb-4">
          404
        </h1>
        
        <div className="bg-[#121212] border border-white/10 px-8 py-6 rounded-3xl backdrop-blur-md inline-block mb-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-white mb-3">
            Lạc vào vùng đất không có phim
          </h2>
          <p className="text-[#A0A0A0] max-w-md mx-auto">
            Trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không thể truy cập. Hãy để chúng tôi đưa bạn trở lại.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-[0_4px_14px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_20px_rgba(229,9,20,0.6)] hover:-translate-y-1 w-full sm:w-auto"
          >
            <Home className="w-5 h-5" />
            Về Trang Chủ
          </Link>
          <Link
            to="/movies"
            className="flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white px-8 py-4 rounded-xl font-semibold transition-all border border-white/5 hover:border-white/10 hover:-translate-y-1 w-full sm:w-auto"
          >
            <Compass className="w-5 h-5" />
            Khám Phá Phim
          </Link>
        </div>
      </div>
    </div>
  );
}
