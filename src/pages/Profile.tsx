import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { User, Settings, Clock, Heart, Film, Edit3, LogOut, Camera } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useHistory } from "@/hooks/useHistory";
import MovieCard from "@/components/MovieCard";
import { DEFAULT_USER_AVATAR } from "@/lib/utils";

export default function Profile() {
  const { favorites } = useFavorites();
  const { history } = useHistory();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  
  // Ref để kích hoạt input chọn file ẩn
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Đồng bộ State từ LocalStorage
  const [userData, setUserData] = useState({
    name: "Nguyễn Văn A",
    email: "nguyenvana@example.com",
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
      };
      reader.readAsDataURL(file);
    }
  };

  const stats = {
    watched: history.length,
    hours: Math.floor(history.length * 1.5),
    favorites: favorites.length
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      {/* Input File ẩn */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Profile Header */}
      <div className="bg-[#121212] rounded-3xl p-8 border border-white/5 relative overflow-hidden mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#3B82F6]/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          
          {/* Avatar Area - Click để đổi ảnh */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#1A1A1A] shadow-[0_0_20px_rgba(0,0,0,0.5)] relative">
              <img 
                src={userData.avatar} 
                alt={userData.name} 
                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              />
              {/* Overlay khi hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white/80" />
              </div>
            </div>
            <button className="absolute bottom-0 right-0 bg-[#E50914] text-white p-2 rounded-full shadow-lg transform translate-x-1/4 translate-y-1/4 hover:bg-[#b80710] transition-colors border-4 border-[#121212]">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* User Info - Đã đồng bộ */}
          <div className="flex-grow text-center md:text-left">
            <h1 className="text-3xl font-heading font-bold text-white mb-2">{userData.name}</h1>
            <p className="text-[#A0A0A0] mb-6">{userData.email} • Tham gia {userData.joinDate}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-8">
              <div className="bg-[#1A1A1A] px-6 py-3 rounded-2xl border border-white/5 text-center min-w-[120px]">
                <div className="text-2xl font-bold text-white mb-1">{stats.watched}</div>
                <div className="text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#3B82F6]" /> Phim đã xem
                </div>
              </div>
              <div className="bg-[#1A1A1A] px-6 py-3 rounded-2xl border border-white/5 text-center min-w-[120px]">
                <div className="text-2xl font-bold text-white mb-1">{stats.hours}</div>
                <div className="text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#10B981]" /> Giờ xem
                </div>
              </div>
              <div className="bg-[#1A1A1A] px-6 py-3 rounded-2xl border border-white/5 text-center min-w-[120px]">
                <div className="text-2xl font-bold text-white mb-1">{stats.favorites}</div>
                <div className="text-xs text-[#A0A0A0] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-[#E50914]" /> Yêu thích
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full md:w-auto mt-6 md:mt-0">
            <Link to="/settings" className="btn flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white px-6 py-3 rounded-xl font-medium transition-colors border border-white/5">
              <Settings className="w-4 h-4" />
              Cài Đặt
            </Link>
            <button className="btn flex items-center justify-center gap-2 bg-transparent hover:bg-red-500/10 text-[#E50914] px-6 py-3 rounded-xl font-medium transition-colors border border-[#E50914]/30">
              <LogOut className="w-4 h-4" />
              Đăng Xuất
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('favorites')}
          className={`text-lg font-heading font-bold transition-colors relative ${activeTab === 'favorites' ? 'text-white' : 'text-[#A0A0A0] hover:text-white'}`}
        >
          Phim Yêu Thích
          {activeTab === 'favorites' && (
            <span className="absolute -bottom-[17px] left-0 w-full h-1 bg-[#E50914] rounded-t-full"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`text-lg font-heading font-bold transition-colors relative ${activeTab === 'history' ? 'text-white' : 'text-[#A0A0A0] hover:text-white'}`}
        >
          Lịch Sử Xem
          {activeTab === 'history' && (
            <span className="absolute -bottom-[17px] left-0 w-full h-1 bg-[#E50914] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {activeTab === 'favorites' && (
          favorites.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
              {favorites.map((movie, index) => (
                <MovieCard key={`${movie.slug || 'fav'}-${index}`} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center text-[#A0A0A0] py-20 bg-[#121212] rounded-2xl border border-white/5">
              <Heart className="w-12 h-12 mx-auto mb-4 text-[#A0A0A0] opacity-50" />
              <p className="text-xl font-medium">Chưa có phim yêu thích</p>
              <p className="text-sm mt-2">Hãy khám phá và lưu lại những bộ phim bạn thích.</p>
              <Link to="/movies" className="btn inline-block mt-6 bg-[#E50914] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#b80710] transition-colors">
                Khám phá ngay
              </Link>
            </div>
          )
        )}

        {activeTab === 'history' && (
          history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
              {history.map((item, index) => (
                <MovieCard key={`${item.slug || 'history'}-${index}`} movie={item} />
              ))}
            </div>
          ) : (
            <div className="text-center text-[#A0A0A0] py-20 bg-[#121212] rounded-2xl border border-white/5">
              <Clock className="w-12 h-12 mx-auto mb-4 text-[#A0A0A0] opacity-50" />
              <p className="text-xl font-medium">Chưa có lịch sử xem</p>
              <p className="text-sm mt-2">Bạn chưa xem bộ phim nào gần đây.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
