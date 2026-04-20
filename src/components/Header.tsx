import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, User, LogOut, Settings, Heart, History, Play, Menu, X, LogIn, Bell, Clock, TrendingUp, Home, Film, Tv, Tag } from "lucide-react";
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
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);

  // Ref để đo vị trí form và tính offset dropdown
  const searchFormRef = useRef<HTMLFormElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState({
    name: "Khách",
    email: "guest@cineverse.com",
    avatar: DEFAULT_USER_AVATAR,
  });

  const navLinks = [
    { name: "Trang chủ",  path: "/",          icon: Home    },
    { name: "Phim lẻ",    path: "/movies",    icon: Film    },
    { name: "Phim bộ",    path: "/series",    icon: Tv      },
    { name: "Thể loại",   path: "/genres",    icon: Tag     },
    { name: "Lịch sử",    path: "/history",   icon: History },
    { name: "Yêu thích",  path: "/favorites", icon: Heart   },
  ];

  // Tính toán vị trí dropdown sát viewport — chạy mỗi khi focus/resize
  const recalcDropdown = useCallback(() => {
    if (!searchFormRef.current) return;
    const rect = searchFormRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const PADDING = 12; // khoảng cách tối thiểu với cạnh màn hình
    const DROPDOWN_W = Math.min(420, vw - PADDING * 2);

    // Cố gắng căn phải với form, nhưng clamp để không tràn trái/phải
    let right = vw - rect.right;
    if (right + DROPDOWN_W > vw - PADDING) right = PADDING;
    if (right < PADDING) right = PADDING;

    setDropdownStyle({
      position: 'fixed',           // fixed thay vì absolute → không bị ảnh hưởng bởi overflow của cha
      top: rect.bottom + 8,        // 8px dưới form
      right: Math.max(right, PADDING),
      width: DROPDOWN_W,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (isSearchFocused) {
      recalcDropdown();
      window.addEventListener('resize', recalcDropdown);
      window.addEventListener('scroll', recalcDropdown, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', recalcDropdown);
      window.removeEventListener('scroll', recalcDropdown);
    };
  }, [isSearchFocused, recalcDropdown]);

  useEffect(() => {
    const history = localStorage.getItem("search_history");
    if (history) setSearchHistory(JSON.parse(history));

    const fetchTrending = async () => {
      setIsFetchingTrending(true);
      try {
        const res = await api.getByCategory("phim-bo", 1);
        setTrendingMovies(res.items?.slice(0, 5) || []);
      } catch {}
      finally { setIsFetchingTrending(false); }
    };
    fetchTrending();
  }, []);

  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    const cleanQuery = query.trim();
    const newHistory = [cleanQuery, ...searchHistory.filter(i => i !== cleanQuery)].slice(0, 8);
    setSearchHistory(newHistory);
    localStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  const removeHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(i => i !== item);
    setSearchHistory(newHistory);
    localStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  useEffect(() => {
    const checkAuth = () => {
      const savedData = localStorage.getItem("cineverse_settings");
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setUserData({ name: parsed.name || "Người dùng", email: parsed.email || "", avatar: parsed.avatar || DEFAULT_USER_AVATAR });
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserData({ name: "Khách", email: "guest@cineverse.com", avatar: DEFAULT_USER_AVATAR });
      }
    };
    checkAuth();
    window.addEventListener("local-storage-update", checkAuth);
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
      const banner = document.getElementById("hero-banner");
      const bannerHeight = banner ? banner.offsetHeight : 0;
      if (bannerHeight > 0 && scrollPosition < bannerHeight) { setAtTop(true); setScrolled(false); }
      else { setAtTop(false); setScrolled(true); }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    return () => { window.removeEventListener("scroll", handleScroll); window.removeEventListener("resize", handleScroll); };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setLoadingSuggestions(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.search(searchQuery.trim());
          setSuggestions(res.items?.slice(0, 5) || []);
        } catch { setSuggestions([]); }
        finally { setLoadingSuggestions(false); }
      }, 500);
    } else {
      setSuggestions([]);
      setLoadingSuggestions(false);
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveToHistory(searchQuery);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
      setIsMobileMenuOpen(false);
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  const inputStyle = { fontSize: "16px", touchAction: "none" as const };

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500 header",
      atTop
        ? "bg-black/5 backdrop-blur-[2px] border-b border-white/0"
        : "bg-background/95 backdrop-blur-[12px] border-b border-card-border shadow-[0_2px_24px_rgba(0,0,0,0.6)]"
    )}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between container">

        {/* LEFT */}
        <div className="flex items-center gap-3 md:gap-12">
          <button
            className={cn("mobile-menu-btn lg:hidden", atTop ? "text-white" : "text-foreground")}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link to="/" className="flex items-center gap-2 text-xl md:text-3xl font-heading font-bold tracking-wider group relative logo hover:scale-105 transition-transform duration-300">
            <img
              src="https://i.ibb.co/bgFXs8nH/logo.png"
              alt="Cineverse Logo"
              className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-lg shadow-sm group-hover:shadow-[0_0_15px_rgba(229,9,20,0.5)] transition-shadow duration-300"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "https://ui-avatars.com/api/?name=Cine+Verse&background=E50914&color=fff&rounded=true&bold=true"; }}
            />
            <div className="hidden sm:block">
              <span className={cn("group-hover:text-[#F5C518] transition-colors duration-300", atTop ? "text-white" : "text-foreground")}>CINE</span>
              <span className="text-[#E50914] verse">VERSE</span>
            </div>
          </Link>

          {/* Desktop nav — text only */}
          <nav className="hidden lg:flex items-center gap-7 desktop-nav nav-menu">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) => cn(
                  "text-sm font-medium transition-all duration-300 relative py-2 group whitespace-nowrap",
                  isActive
                    ? atTop ? "text-white" : "text-foreground"
                    : atTop ? "text-gray-300 hover:text-[#F5C518]" : "text-secondary-text hover:text-[#F5C518]"
                )}
              >
                {({ isActive }) => (
                  <>
                    {link.name}
                    <span className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-[#F5C518] transition-all duration-300", isActive ? "w-full" : "w-0 group-hover:w-full")} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3 md:gap-6">

          {/* =============================================
              SEARCH — dropdown dùng position:fixed
              ============================================= */}
          <form ref={searchFormRef} onSubmit={handleSearch} className="relative search-container">
            <div className={cn(
              "flex items-center bg-input-bg rounded-full px-3 md:px-4 py-1.5 md:py-2 transition-all duration-300 border",
              isSearchFocused
                ? "w-[140px] sm:w-52 md:w-72 border-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                : "w-[120px] sm:w-40 md:w-56 border-transparent"
            )}>
              <Search className="w-4 h-4 text-secondary-text mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { setIsSearchFocused(true); setTimeout(recalcDropdown, 50); }}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                style={inputStyle}
                className="bg-transparent border-none outline-none text-foreground placeholder:text-secondary-text w-full text-sm"
              />
              {/* Nút X xóa nhanh trên mobile */}
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="ml-1 flex-shrink-0 p-0.5 rounded-full hover:bg-foreground/10">
                  <X className="w-3.5 h-3.5 text-secondary-text" />
                </button>
              )}
            </div>

            {/* DROPDOWN — dùng portal-style fixed positioning */}
            {isSearchFocused && (
              <div
                style={dropdownStyle}
                className="bg-card border border-card-border rounded-2xl shadow-2xl py-2 overflow-hidden"
              >
                {/* Khi chưa gõ: lịch sử / trending */}
                {!searchQuery && (
                  <div>
                    {searchHistory.length > 0 ? (
                      <>
                        <div className="px-4 py-2 flex justify-between items-center">
                          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider flex items-center gap-1.5">
                            <History className="w-3 h-3" /> Tìm kiếm gần đây
                          </span>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setSearchHistory([]); localStorage.removeItem("search_history"); }}
                            className="text-[11px] text-secondary-text hover:text-red-500 transition-colors"
                          >Xóa hết</button>
                        </div>
                        {/* Giới hạn chiều cao, cuộn nội bộ */}
                        <div className="max-h-[240px] overflow-y-auto">
                          {searchHistory.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5 cursor-pointer group"
                              onMouseDown={() => { setSearchQuery(item); navigate(`/search?q=${encodeURIComponent(item)}`); }}
                            >
                              <div className="flex items-center gap-3 text-sm text-secondary-text group-hover:text-foreground min-w-0">
                                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{item}</span>
                              </div>
                              <button
                                onMouseDown={(e) => removeHistoryItem(e, item)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-foreground/10 rounded flex-shrink-0 ml-2"
                              >
                                <X className="w-3 h-3 text-secondary-text" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-2 text-[11px] font-bold text-[#E50914] uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" /> Xu hướng tìm kiếm
                        </div>
                        <div className="max-h-[240px] overflow-y-auto">
                          {isFetchingTrending ? (
                            [...Array(5)].map((_, i) => (
                              <div key={i} className="px-4 py-3 border-b border-card-border last:border-0 flex items-center gap-3">
                                <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
                                <Skeleton className="h-4 w-3/4" />
                              </div>
                            ))
                          ) : (
                            trendingMovies.map((movie, i) => (
                              <div
                                key={i}
                                onMouseDown={() => navigate(`/movie/${movie.slug}`)}
                                className="px-4 py-3 hover:bg-foreground/5 flex items-center gap-3 cursor-pointer group"
                              >
                                <span className="text-sm font-bold text-secondary-text group-hover:text-[#E50914] flex-shrink-0 w-4">{i + 1}</span>
                                <span className="text-sm text-secondary-text group-hover:text-foreground line-clamp-1">{movie.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Gợi ý từ API */}
                {searchQuery.trim().length >= 2 && (
                  <>
                    <div className="px-4 py-2 text-[10px] text-secondary-text uppercase font-bold tracking-widest border-b border-card-border">
                      Gợi ý từ Cineverse
                    </div>
                    {loadingSuggestions ? (
                      [...Array(3)].map((_, i) => <SearchSuggestionSkeleton key={i} />)
                    ) : suggestions.length > 0 ? (
                      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                        {suggestions.map((movie, index) => (
                          <button
                            key={`${movie.slug || movie._id || "suggestion"}-${index}`}
                            onMouseDown={() => { saveToHistory(movie.name); navigate(`/movie/${movie.slug}`); setIsSearchFocused(false); setSearchQuery(""); }}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-foreground/5 border-b border-card-border last:border-0 group text-left"
                          >
                            <div className="w-10 h-14 flex-shrink-0 rounded-md overflow-hidden bg-input-bg relative">
                              <img src={getImageUrl(movie.poster_url || movie.thumb_url, "poster")} alt={movie.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-4 h-4 text-white" fill="currentColor" />
                              </div>
                            </div>
                            <div className="flex-grow min-w-0 py-0.5">
                              <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-[#E50914] transition-colors">{movie.name}</h4>
                              <p className="text-xs text-secondary-text mt-0.5 line-clamp-1">{movie.origin_name}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] bg-input-bg text-secondary-text px-1.5 py-0.5 rounded">{movie.year || "N/A"}</span>
                                {movie.quality && <span className="text-[10px] bg-foreground/10 border border-card-border text-foreground px-1.5 py-0.5 rounded">{movie.quality}</span>}
                                {movie.lang && <span className="text-[10px] bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] px-1.5 py-0.5 rounded">{movie.lang}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-secondary-text italic">Không tìm thấy kết quả phù hợp...</div>
                    )}
                  </>
                )}

                {searchQuery && (
                  <button
                    type="submit"
                    onMouseDown={(e) => { e.preventDefault(); handleSearch(e as any); }}
                    className="w-full py-3 text-sm text-[#3B82F6] font-bold hover:bg-foreground/5 border-t border-card-border transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Xem tất cả kết quả cho "{searchQuery}"
                  </button>
                )}
              </div>
            )}
          </form>

          {/* Bell */}
          {isLoggedIn && (
            <button className={cn("relative p-2 hover:text-[#F5C518] transition-colors group", atTop ? "text-gray-300" : "text-secondary-text")}>
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#E50914] rounded-full border-2 border-card group-hover:scale-125 transition-transform" />
            </button>
          )}

          {/* Avatar / Login */}
          <div className="relative">
            {!isLoggedIn ? (
              <Link to="/login" className="flex items-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg">
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng nhập</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                  className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border-2 transition-all overflow-hidden shadow-md", atTop ? "border-white/30 hover:border-white" : "border-card-border hover:border-[#E50914]")}
                >
                  <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
                </button>

                {isAvatarOpen && (
                  <div className="absolute right-0 mt-3 w-60 bg-card border border-card-border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-4 border-b border-card-border mb-2 flex items-center gap-3">
                      <img src={userData.avatar} className="w-10 h-10 rounded-full object-cover border border-card-border" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{userData.name}</p>
                        <p className="text-[10px] text-secondary-text truncate">{userData.email}</p>
                      </div>
                    </div>
                    <Link to="/profile" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-text hover:bg-foreground/5 hover:text-foreground transition-colors">
                      <User className="w-4 h-4 text-[#3B82F6]" /> Hồ sơ của tôi
                    </Link>
                    <Link to="/settings" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-text hover:bg-foreground/5 hover:text-foreground transition-colors">
                      <Settings className="w-4 h-4 text-secondary-text" /> Cài đặt
                    </Link>
                    <Link to="/favorites" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-text hover:bg-foreground/5 hover:text-foreground transition-colors">
                      <Heart className="w-4 h-4 text-[#E50914]" /> Danh sách yêu thích
                    </Link>
                    <div className="h-px bg-card-border my-2" />
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-medium">
                      <LogOut className="w-4 h-4" /> Đăng xuất
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Menu */}
      <div className={cn("lg:hidden overflow-hidden transition-all duration-300 ease-in-out", isMobileMenuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 pointer-events-none")}>
        <div className="bg-background/[0.98] backdrop-blur-xl border-t border-card-border px-3 pb-4 pt-2">
          {isLoggedIn && (
            <div className="flex items-center gap-3 px-2 py-3 mb-1 border-b border-card-border">
              <img src={userData.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-[#E50914]/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{userData.name}</p>
                <p className="text-[11px] text-secondary-text truncate">{userData.email}</p>
              </div>
            </div>
          )}
          <nav className="flex flex-col gap-0.5 py-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-200 group", isActive ? "bg-[#E50914]/10 text-[#E50914] font-semibold" : "text-secondary-text hover:bg-foreground/5 hover:text-foreground")}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200", isActive ? "bg-[#E50914]/15 text-[#E50914]" : "bg-foreground/5 text-secondary-text group-hover:bg-foreground/10 group-hover:text-foreground")}>
                      <link.icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm flex-1">{link.name}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] flex-shrink-0" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="pt-2 border-t border-card-border">
            {isLoggedIn ? (
              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-all duration-200">
                <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0"><LogOut className="w-4 h-4" /></span>
                <span className="text-sm font-medium">Đăng xuất</span>
              </button>
            ) : (
              <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-2 py-2.5 rounded-xl bg-[#E50914] text-white transition-all active:scale-95">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><LogIn className="w-4 h-4" /></span>
                <span className="text-sm font-bold">Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}