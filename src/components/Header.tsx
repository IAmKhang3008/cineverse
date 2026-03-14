import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, User, LogOut, Settings, Heart, History, ChevronDown, Play, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getImageUrl } from "@/lib/api";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        <div className="flex items-center gap-4 md:gap-12">
          <button 
            className="mobile-menu-btn lg:hidden text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link to="/" className="flex items-center gap-2 text-xl md:text-3xl font-heading font-bold tracking-wider group relative logo hover:scale-105 transition-transform duration-300">
            <img 
              src="/logo.png" 
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
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="bg-transparent border-none outline-none text-base md:text-sm text-white placeholder:text-gray-500 w-full search-input"
              />
            </div>
            {isSearchFocused && searchQuery && (
              <div className="absolute top-full mt-2 w-[calc(100vw-2rem)] md:w-[400px] -right-2 md:right-0 bg-[#121212] border border-white/10 rounded-xl shadow-2xl py-2 z-50 overflow-hidden suggestions-box">
                <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">Gợi ý tìm kiếm</div>
                
                {loadingSuggestions ? (
                  <div className="flex justify-center items-center py-6">
                    <div className="w-6 h-6 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar">
                    {suggestions.map((movie, index) => (
                      <button
                        key={`${movie.slug || movie._id || 'suggestion'}-${index}`}
                        type="button"
                        onMouseDown={() => {
                          navigate(`/movie/${movie.slug}`);
                          setIsSearchFocused(false);
                          setSearchQuery("");
                        }}
                        className="btn w-full text-left px-4 py-3 hover:bg-white/5 flex items-start gap-4 transition-colors border-b border-white/5 last:border-0 group suggestion-item"
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
                        <div className="flex-grow min-w-0 py-1">
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
                ) : searchQuery.trim().length >= 2 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Không tìm thấy phim nào phù hợp.
                  </div>
                ) : null}

                <button 
                  type="submit" 
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSearch(e as any);
                  }}
                  className="btn w-full text-center px-4 py-3 text-sm text-[#3B82F6] hover:bg-white/5 flex items-center justify-center gap-2 border-t border-white/5 font-medium transition-colors"
                >
                  <Search className="w-4 h-4" /> Xem tất cả kết quả
                </button>
              </div>
            )}
          </form>

          <div className="relative">
            <button
              onClick={() => setIsAvatarOpen(!isAvatarOpen)}
              className="btn w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center border-2 border-transparent hover:border-[#F5C518] transition-colors overflow-hidden user-avatar-btn"
            >
              <User className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
            </button>

            {isAvatarOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-[#121212] border border-white/10 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-3 border-b border-white/10 mb-2">
                  <p className="text-sm font-medium text-white">Khách</p>
                  <p className="text-xs text-gray-500">guest@cineverse.com</p>
                </div>
                <Link to="/profile" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  <User className="w-4 h-4" /> Hồ sơ
                </Link>
                <Link to="/settings" onClick={() => setIsAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Settings className="w-4 h-4" /> Cài đặt
                </Link>
                <div className="h-px bg-white/10 my-2" />
                <Link to="/login" onClick={() => setIsAvatarOpen(false)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#E50914] hover:bg-white/5 transition-colors">
                  <LogOut className="w-4 h-4" /> Đăng xuất
                </Link>
              </div>
            )}
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
