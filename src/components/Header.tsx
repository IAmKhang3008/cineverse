import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, User, LogOut, Settings, Heart, History, ChevronDown, Play, Menu, X, LogIn, Bell, Trash2, Clock, TrendingUp } from "lucide-react";
import { cn, DEFAULT_USER_AVATAR } from "@/lib/utils";
import { api, getImageUrl } from "@/lib/api";
import { SearchSuggestionSkeleton, Skeleton } from "@/components/Skeleton";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Mới: State cho lịch sử tìm kiếm
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);
  
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState({
    name: "Khách",
    email: "guest@cineverse.com",
    avatar: DEFAULT_USER_AVATAR
  });

  // 1. Load lịch sử tìm kiếm từ LocalStorage khi khởi tạo
  useEffect(() => {
    const history = localStorage.getItem("search_history");
    if (history) {
      setSearchHistory(JSON.parse(history));
    }

    // Fetch Trending (Giả lập lấy từ top phim hot của website)
    const fetchTrending = async () => {
      setIsFetchingTrending(true);
      try {
        const res = await api.getByCategory('phim-bo', 1); 
        setTrendingMovies(res.items?.slice(0, 5) || []);
      } catch (error) {
        console.error("Lỗi lấy trending:", error);
      } finally {
        setIsFetchingTrending(false);
      }
    };
    fetchTrending();
  }, []);

  // Hàm lưu lịch sử mới
  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    const cleanQuery = query.trim();
    const newHistory = [
      cleanQuery,
      ...searchHistory.filter(item => item !== cleanQuery) // Xóa trùng lặp và đưa lên đầu
    ].slice(0, 8); // Chỉ giữ lại 8 mục gần nhất
    
    setSearchHistory(newHistory);
    localStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  const removeHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(i => i !== item);
    setSearchHistory(newHistory);
    localStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  // Kiểm tra đăng nhập và lấy dữ liệu từ LocalStorage
  useEffect(() => {
    const checkAuth = () => {
      const savedData = localStorage.getItem("cineverse_settings");
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setUserData({
          name: parsed.name || "Người dùng",
          email: parsed.email || "",
          avatar: parsed.avatar || DEFAULT_USER_AVATAR
        });
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserData({
          name: "Khách",
          email: "guest@cineverse.com",
          avatar: DEFAULT_USER_AVATAR
        });
      }
    };

    // Kiểm tra ngay lần đầu tiên component mount
    checkAuth();

    // Lắng nghe tín hiệu cập nhật TRONG CÙNG MỘT TAB
    window.addEventListener("local-storage-update", checkAuth);
    
    // Lắng nghe thay đổi TỪ TAB KHÁC (giữ nguyên để đồng bộ)
    window.addEventListener("storage", checkAuth);

    return () => {
      window.removeEventListener("local-storage-update", checkAuth);
      window.removeEventListener("storage", checkAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("cineverse_settings");
    setIsLoggedIn(false);
    setIsAvatarOpen(false);
    navigate("/");
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const banner = document.getElementById('hero-banner');
      const bannerHeight = banner ? banner.offsetHeight : 0;

      if (bannerHeight > 0 && scrollPosition < bannerHeight) {
        setAtTop(true);
        setScrolled(false);
      } else {
        setAtTop(false);
        setScrolled(true);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      setLoadingSuggestions(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.search(searchQuery.trim());
          setSuggestions(res.items?.slice(0, 5) || []);
        } catch (error) {
          // Silently fail to avoid console spam
          setSuggestions([]);
        } finally {
          setLoadingSuggestions(false);
        }
      }, 500); // Debounce 500ms
    } else {
      setSuggestions([]);
      setLoadingSuggestions(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveToHistory(searchQuery); // Lưu lịch sử khi nhấn Enter
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
      setIsMobileMenuOpen(false);
      // Blur the input to hide keyboard on mobile
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.blur();
      }
    }
  };

  // Tuyệt chiêu: Ép font-size 16px cố định cho mobile và chặn touch-action zoom
  const inputStyle = {
    fontSize: '16px',
    touchAction: 'none' as const
  };

  const navLinks = [
    { name: "Trang chủ", path: "/" },
    { name: "Phim lẻ", path: "/movies" },
    { name: "Phim bộ", path: "/series" },
    { name: "Thể loại", path: "/genres" },
    { name: "Lịch sử", path: "/history" },
    { name: "Yêu thích", path: "/favorites" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 header",
        atTop ? "bg-[rgba(10,10,10,0.05)] backdrop-blur-[4px] border-b border-transparent" : "",
        scrolled ? "bg-[rgba(10,10,10,0.95)] backdrop-blur-[10px] border-b border-[rgba(255,255,255,0.1)] shadow-[0_4px_20px_rgba(0,0,0,0.5)]" : ""
      )}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between container">
        <div className="flex items-center gap-3 md:gap-12">
          <button 
            className="mobile-menu-btn lg:hidden text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link to="/" className="flex items-center gap-2 text-xl md:text-3xl font-heading font-bold tracking-wider group relative logo hover:scale-105 transition-transform duration-300">
            <img 
              src="https://i.ibb.co/bgFXs8nH/logo.png" 
              alt="Cineverse Logo" 
              className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-lg shadow-sm group-hover:shadow-[0_0_15px_rgba(229,9,20,0.5)] transition-shadow duration-300" 
              onError={(e) => {
                e.currentTarget.onerror = null; 
                e.currentTarget.src = "https://ui-avatars.com/api/?name=Cine+Verse&background=E50914&color=fff&rounded=true&bold=true";
              }} 
            />
            <div className="hidden sm:block">
              <span className="text-white group-hover:text-[#F5C518] transition-colors duration-300">CINE</span>
              <span className="text-[#E50914] verse">VERSE</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 desktop-nav nav-menu">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-all duration-300 relative py-2 group",
                    isActive ? "text-white" : "text-gray-300 hover:text-[#F5C518]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {link.name}
                    <span className={cn(
                      "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-[#F5C518] transition-all duration-300",
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    )}></span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <form onSubmit={handleSearch} className="relative search-container">
            <div className={cn(
              "flex items-center bg-[#2A2A2A] rounded-full px-3 md:px-4 py-1.5 md:py-2 transition-all duration-300 border",
              isSearchFocused ? "w-full md:w-72 border-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "w-full md:w-56 border-transparent"
            )}>
              <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0 search-btn" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                style={inputStyle}
                className="bg-transparent border-none outline-none text-white placeholder:text-gray-500 w-full search-input"
              />
            </div>
            {/* DROP BOX: Lịch sử & Gợi ý */}
            {isSearchFocused && (
              <div className="absolute top-full mt-2 w-[calc(100vw-2rem)] md:w-[400px] -right-2 md:right-0 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl py-2 z-[60] overflow-hidden suggestions-box">
                
                {/* HIỂN THỊ LỊCH SỬ HOẶC TRENDING (Khi chưa gõ gì) */}
                {!searchQuery && (
                  <div className="py-2">
                    {/* Nếu có lịch sử -> Hiện lịch sử */}
                    {searchHistory.length > 0 ? (
                      <div>
                        <div className="px-4 py-2 flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Tìm kiếm gần đây</span>
                          <button onMouseDown={(e) => {e.preventDefault(); setSearchHistory([]); localStorage.removeItem("search_history");}} className="hover:text-red-500 transition-colors">Xóa hết</button>
                        </div>
                        {searchHistory.map((item, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 cursor-pointer group"
                            onMouseDown={() => {
                              setSearchQuery(item);
                              navigate(`/search?q=${encodeURIComponent(item)}`);
                            }}
                          >
                            <div className="flex items-center gap-3 text-sm text-gray-300 group-hover:text-white">
                              <Clock className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-400" />
                              {item}
                            </div>
                            <button 
                              onMouseDown={(e) => removeHistoryItem(e, item)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
                            >
                              <X className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Nếu lịch sử trống -> Hiện TRENDING SEARCH */
                      <div>
                        <div className="px-4 py-2 text-[11px] font-bold text-[#E50914] uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" /> Xu hướng tìm kiếm
                        </div>
                        {isFetchingTrending ? (
                          <div className="flex flex-col">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="px-4 py-3 border-b border-white/5 last:border-0 flex items-center gap-3">
                                <Skeleton className="w-4 h-4 rounded-sm" />
                                <Skeleton className="h-4 w-3/4" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          trendingMovies.map((movie, i) => (
                            <div 
                              key={i} 
                              onMouseDown={() => navigate(`/movie/${movie.slug}`)}
                              className="px-4 py-3 hover:bg-white/5 flex items-center gap-3 cursor-pointer group"
                            >
                              <span className="text-sm font-bold text-gray-500 group-hover:text-[#E50914]">{i + 1}</span>
                              <span className="text-sm text-gray-300 group-hover:text-white line-clamp-1">{movie.name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* GỢI Ý TỪ API (Khi đã gõ >= 2 ký tự) */}
                {searchQuery.trim().length >= 2 && (
                  <>
                    <div className="px-4 py-2 text-[10px] text-gray-500 uppercase font-bold tracking-widest border-b border-white/5">Gợi ý từ Cineverse</div>
                    {loadingSuggestions ? (
                      <div className="flex flex-col">
                        {[...Array(3)].map((_, i) => (
                          <SearchSuggestionSkeleton key={i} />
                        ))}
                      </div>
                    ) : suggestions.length > 0 ? (
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                        {suggestions.map((movie, index) => (
                          <button
                            key={`${movie.slug || movie._id || 'suggestion'}-${index}`}
                            onMouseDown={() => {
                              saveToHistory(movie.name);
                              navigate(`/movie/${movie.slug}`);
                              setIsSearchFocused(false);
                              setSearchQuery("");
                            }}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 group suggestion-item"
                          >
                            <div className="w-12 h-16 flex-shrink-0 rounded-md overflow-hidden bg-[#2A2A2A] relative suggestion-poster">
                              <img 
                                src={getImageUrl(movie.poster_url || movie.thumb_url, 'poster')} 
                                alt={movie.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-6 h-6 text-white" fill="currentColor" />
                              </div>
                            </div>
                            <div className="flex-grow min-w-0 py-1 text-left">
                              <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#E50914] transition-colors suggestion-title">{movie.name}</h4>
                              <p className="text-xs text-gray-400 mt-1 line-clamp-1 suggestion-original">{movie.origin_name}</p>
                              <div className="flex items-center gap-2 mt-1.5 suggestion-meta">
                                <span className="text-[10px] bg-[#2A2A2A] text-gray-300 px-1.5 py-0.5 rounded">{movie.year || 'N/A'}</span>
                                {movie.quality && <span className="text-[10px] bg-black/50 border border-white/10 text-white px-1.5 py-0.5 rounded">{movie.quality}</span>}
                                {movie.lang && <span className="text-[10px] bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] px-1.5 py-0.5 rounded">{movie.lang}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-gray-500 italic">Không tìm thấy kết quả phù hợp...</div>
                    )}
                  </>
                )}
                
                {searchQuery && (
                  <button 
                    type="submit"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSearch(e as any);
                    }}
                    className="w-full py-3 text-sm text-[#3B82F6] font-bold hover:bg-white/5 border-t border-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Xem tất cả kết quả cho "{searchQuery}"
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="flex items-center gap-3 md:gap-4">
            {isLoggedIn && (
              <button className="relative p-2 text-gray-400 hover:text-[#F5C518] transition-colors group">
                <Bell className="w-6 h-6" />
                {/* Chấm đỏ thông báo */}
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#E50914] rounded-full border-2 border-[#121212] group-hover:scale-125 transition-transform"></span>
              </button>
            )}

            <div className="relative">
              {!isLoggedIn ? (
                // NÚT ĐĂNG NHẬP (Khi chưa login)
                <Link 
                  to="/login" 
                  className="flex items-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </Link>
              ) : (
                // AVATAR (Khi đã login)
                <>
                  <button
                    onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                    className={cn(
                      "w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border-2 transition-all overflow-hidden shadow-md",
                      atTop ? "border-white/30 hover:border-white" : "border-transparent hover:border-[#E50914]"
                    )}
                  >
                    <img 
                      src={userData.avatar} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                    />
                  </button>

                  {isAvatarOpen && (
                    <div className="absolute right-0 mt-3 w-60 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200">
                      <div className="px-4 py-4 border-b border-white/5 mb-2 flex items-center gap-3">
                        <img src={userData.avatar} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{userData.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{userData.email}</p>
                        </div>
                      </div>
                      
                      <Link to="/profile" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                        <User className="w-4 h-4 text-[#3B82F6]" /> Hồ sơ của tôi
                      </Link>
                      <Link to="/settings" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                        <Settings className="w-4 h-4 text-gray-400" /> Cài đặt
                      </Link>
                      <Link to="/favorites" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                        <Heart className="w-4 h-4 text-[#E50914]" /> Danh sách yêu thích
                      </Link>

                      <div className="h-px bg-white/5 my-2" />
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={cn("mobile-nav lg:hidden", isMobileMenuOpen ? "active" : "")}>
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                "mobile-nav-link",
                isActive ? "text-[#E50914] font-bold" : ""
              )
            }
          >
            {link.name}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
