import { Link } from "react-router-dom";

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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a 
            href="https://web.facebook.com/tuan.khang.374793/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-white hover:bg-[#1877F2] transition-colors" 
            title="Facebook"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.04c-5.5 0-10 4.48-10 10.02 0 5.01 3.66 9.15 8.44 9.9v-7.03H7.9v-2.87h2.54V9.89c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.87h-2.34v7.03c4.78-.75 8.44-4.89 8.44-9.9 0-5.54-4.5-10.02-10-10.02z" />
            </svg>
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
