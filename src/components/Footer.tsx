import { Link } from "react-router-dom";
import { Facebook, Youtube, Music2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A]  border-t border-[#2A2A2A]  pt-20 pb-10 mt-20 transition-colors duration-300">
      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-1 md:col-span-1">
          <Link to="/" className="text-3xl font-heading font-bold tracking-wider mb-6 block">
            <span className="text-white ">CINE</span>
            <span className="text-[#E50914]">VERSE</span>
          </Link>
          <p className="text-[#A0A0A0]  text-sm leading-relaxed">
            Vũ trụ điện ảnh của bạn. Nền tảng xem phim trực tuyến miễn phí với chất lượng cao, cập nhật nhanh nhất. Trải nghiệm điện ảnh tuyệt đỉnh ngay tại nhà.
          </p>
        </div>

        <div>
          <h3 className="text-white  font-heading font-semibold mb-6 uppercase text-sm tracking-widest">Danh mục nhanh</h3>
          <ul className="space-y-3">
            <li><Link to="/movies" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Phim lẻ</Link></li>
            <li><Link to="/series" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Phim bộ</Link></li>
            <li><Link to="/genres" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Thể loại</Link></li>
            <li><Link to="/history" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Lịch sử xem</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white  font-heading font-semibold mb-6 uppercase text-sm tracking-widest">Hỗ trợ</h3>
          <ul className="space-y-3">
            <li><Link to="/terms" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Điều khoản sử dụng</Link></li>
            <li><Link to="/terms" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Chính sách bảo mật</Link></li>
            <li><Link to="/terms" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Khiếu nại bản quyền</Link></li>
            <li><Link to="/contact" className="text-[#A0A0A0]  hover:text-[#E50914] :text-[#E50914] text-sm transition-colors">Báo lỗi</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white  font-heading font-semibold mb-6 uppercase text-sm tracking-widest">Liên hệ</h3>
          <ul className="space-y-3">
            <li className="text-[#A0A0A0]  text-sm hover:text-[#E50914] :text-[#E50914] transition-colors cursor-pointer">Email: contact@cineverse.com</li>
            <li className="text-[#A0A0A0]  text-sm hover:text-[#E50914] :text-[#E50914] transition-colors cursor-pointer">Hotline: 1900 xxxx</li>
          </ul>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 border-t border-[#2A2A2A]  pt-8 flex flex-col md:flex-row items-center justify-between">
        <p className="text-[#A0A0A0]  text-sm">
          © 2026 Cineverse. Tất cả nội dung được thu thập từ internet.
        </p>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <a 
            href="https://www.youtube.com/@TheRealKhang" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-white hover:bg-[#FF0000] transition-colors" 
            title="Youtube"
          >
            <Youtube className="w-5 h-5" />
          </a>
          <a 
            href="https://web.facebook.com/tuan.khang.374793/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-white hover:bg-[#1877F2] transition-colors" 
            title="Facebook"
          >
            <Facebook className="w-5 h-5" />
          </a>
          <a 
            href="https://www.tiktok.com/@i_am_khang_d" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-white hover:bg-black transition-colors" 
            title="Tiktok"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
