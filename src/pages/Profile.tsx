import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Settings, Clock, Heart, Film, Edit3, LogOut, Camera } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useHistory } from "@/hooks/useHistory";
import MovieCard from "@/components/MovieCard";
import { DEFAULT_USER_AVATAR } from "@/lib/utils";

export default function Profile() {
  const { favorites } = useFavorites();
  const { history } = useHistory();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  const navigate = useNavigate();
  
  // Ref để kích hoạt input chọn file ẩn
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Đồng bộ State từ LocalStorage
  const [userData, setUserData] = useState({
    name: "Người dùng",
    email: "user@example.com",
    avatar: DEFAULT_USER_AVATAR,
    joinDate: "Tháng 1, 2026",
  });

  useEffect(() => {
    const savedData = localStorage.getItem("cineverse_settings");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setUserData(prev => ({
        ...prev,
        name: parsedData.name || prev.name,
        email: parsedData.email || prev.email,
        avatar: parsedData.avatar || prev.avatar, // Lấy avatar nếu có
      }));
    }
  }, []);

  // 2. Hàm xử lý đổi ảnh đại diện (PFP)
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        
        // Cập nhật state hiển thị ngay lập tức
        const newUserData = { ...userData, avatar: base64String };
        setUserData(newUserData);

        // Lưu vào LocalStorage để trang Settings và Header cũng nhận được
        const savedSettings = JSON.parse(localStorage.getItem("cineverse_settings") || "{}");
        localStorage.setItem("cineverse_settings", JSON.stringify({
          ...savedSettings,
          avatar: base64String
        }));
        
        // Bắn sự kiện để Header cập nhật
        window.dispatchEvent(new Event("local-storage-update"));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    // 1. Xóa dữ liệu
    localStorage.removeItem("cineverse_settings");
    
    // 2. Bắn sự kiện đồng bộ
    window.dispatchEvent(new Event("local-storage-update"));
    
    // 3. Chuyển hướng
    navigate("/");
  };

  const stats = {
    watched: history.length,
    hours: Math.floor(history.length * 1.5),
    favorites: favorites.length
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16">
      {/* Input File ẩn */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Profile Header */}
      <div className="bg-[#121212] rounded-3xl p-6 md:p-8 border border-white/5 relative overflow-hidden mb-8 md:mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-[#E50914]/10 rounded-full blur-[60px] md:blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 md:w-64 h-48 md:h-64 bg-[#3B82F6]/10 rounded-full blur-[60px] md:blur-[80px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          
          {/* Avatar Area - Click để đổi ảnh */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-[#1A1A1A] shadow-[0_0_20px_rgba(0,0,0,0.5)] relative">
              <img 
                src={userData.avatar} 
                alt={userData.name} 
                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              />
              {/* Overlay khi hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 md:w-8 md:h-8 text-white/80" />
              </div>
            </div>
            <button className="absolute bottom-0 right-0 bg-[#E50914] text-white p-1.5 md:p-2 rounded-full shadow-lg transform translate-x-1/4 translate-y-1/4 hover:bg-[#b80710] transition-colors border-2 md:border-4 border-[#121212]">
              <Edit3 className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>

          {/* User Info - Đã đồng bộ */}
          <div className="flex-grow text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-1 md:mb-2">{userData.name}</h1>
            <p className="text-sm md:text-base text-[#A0A0A0] mb-4 md:mb-6">{userData.email} • Tham gia {userData.joinDate}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-8">
              <div className="bg-[#1A1A1A] px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl border border-white/5 text-center min-w-[100px] md:min-w-[120px]">
                <div className="text-xl md:text-2xl font-bold text-white mb-1">{stats.watched}</div>
                <div className="text-[10px] md:text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1 md:gap-1.5">
                  <Film className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#3B82F6]" /> Phim đã xem
                </div>
              </div>
              <div className="bg-[#1A1A1A] px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl border border-white/5 text-center min-w-[100px] md:min-w-[120px]">
                <div className="text-xl md:text-2xl font-bold text-white mb-1">{stats.hours}</div>
                <div className="text-[10px] md:text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1 md:gap-1.5">
                  <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#10B981]" /> Giờ xem
                </div>
              </div>
              <div className="bg-[#1A1A1A] px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl border border-white/5 text-center min-w-[100px] md:min-w-[120px]">
                <div className="text-xl md:text-2xl font-bold text-white mb-1">{stats.favorites}</div>
                <div className="text-[10px] md:text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1 md:gap-1.5">
                  <Heart className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#E50914]" /> Yêu thích
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-row md:flex-col justify-center gap-3 w-full md:w-auto mt-6 md:mt-0">
            <Link to="/settings" className="btn flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-colors border border-white/5 text-sm md:text-base flex-1 md:flex-none">
              <Settings className="w-4 h-4" />
              Cài Đặt
            </Link>
            <button onClick={handleLogout} className="btn flex items-center justify-center gap-2 bg-transparent hover:bg-red-500/10 text-[#E50914] px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-colors border border-[#E50914]/30 text-sm md:text-base flex-1 md:flex-none">
              <LogOut className="w-4 h-4" />
              Đăng Xuất
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8 border-b border-white/10 pb-3 md:pb-4 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('favorites')}
          className={`text-base md:text-lg font-heading font-bold transition-colors relative whitespace-nowrap ${activeTab === 'favorites' ? 'text-white' : 'text-[#A0A0A0] hover:text-white'}`}
        >
          Phim Yêu Thích
          {activeTab === 'favorites' && (
            <span className="absolute -bottom-[13px] md:-bottom-[17px] left-0 w-full h-1 bg-[#E50914] rounded-t-full"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`text-base md:text-lg font-heading font-bold transition-colors relative whitespace-nowrap ${activeTab === 'history' ? 'text-white' : 'text-[#A0A0A0] hover:text-white'}`}
        >
          Lịch Sử Xem
          {activeTab === 'history' && (
            <span className="absolute -bottom-[13px] md:-bottom-[17px] left-0 w-full h-1 bg-[#E50914] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {activeTab === 'favorites' && (
          favorites.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
              {favorites.map((movie, index) => (
                <MovieCard key={`${movie.slug || 'fav'}-${index}`} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center text-[#A0A0A0] py-12 md:py-20 bg-[#121212] rounded-2xl border border-white/5 px-4">
              <Heart className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 text-[#A0A0A0] opacity-50" />
              <p className="text-lg md:text-xl font-medium">Chưa có phim yêu thích</p>
              <p className="text-xs md:text-sm mt-2">Hãy khám phá và lưu lại những bộ phim bạn thích.</p>
              <Link to="/movies" className="btn inline-block mt-4 md:mt-6 bg-[#E50914] text-white px-5 md:px-6 py-2 rounded-lg font-medium hover:bg-[#b80710] transition-colors text-sm md:text-base">
                Khám phá ngay
              </Link>
            </div>
          )
        )}

        {activeTab === 'history' && (
          history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
              {history.map((item, index) => (
                <MovieCard key={`${item.slug || 'history'}-${index}`} movie={item} />
              ))}
            </div>
          ) : (
            <div className="text-center text-[#A0A0A0] py-12 md:py-20 bg-[#121212] rounded-2xl border border-white/5 px-4">
              <Clock className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 text-[#A0A0A0] opacity-50" />
              <p className="text-lg md:text-xl font-medium">Chưa có lịch sử xem</p>
              <p className="text-xs md:text-sm mt-2">Bạn chưa xem bộ phim nào gần đây.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
