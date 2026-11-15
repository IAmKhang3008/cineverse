import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  X,
  Plus,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import MovieCard from "@/components/MovieCard";
import { MovieCardSkeleton } from "@/components/Skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";

type BrowseDimension = "category" | "genre" | "country" | "trending";
type SortOption = "newest" | "year" | "views";

interface CollectionItem {
  slug: string;
  name: string;
  subtitle: string;
  accent: string;
}

const CATEGORIES: CollectionItem[] = [
  {
    slug: "phim-moi-cap-nhat",
    name: "Phim Mới Cập Nhật",
    subtitle: "Tuyển tập những tác phẩm vừa ra mắt và cập nhật tập mới nhất trong ngày.",
    accent: "#E50914",
  },
  {
    slug: "phim-chieu-rap",
    name: "Phim Chiếu Rạp",
    subtitle: "Bom tấn điện ảnh rạp chiếu mới nhất, chất lượng hình ảnh và âm thanh sắc nét.",
    accent: "#F59E0B",
  },
  {
    slug: "phim-bo",
    name: "Phim Bộ Nổi Bật",
    subtitle: "Các series dài tập cuốn hút từ châu Á đến Âu Mỹ, cập nhật đầy đủ từng tập.",
    accent: "#3B82F6",
  },
  {
    slug: "phim-le",
    name: "Phim Lẻ Tuyển Chọn",
    subtitle: "Kho phim điện ảnh trọn vẹn trong một buổi tối, đa dạng thể loại.",
    accent: "#E50914",
  },
  {
    slug: "hoat-hinh",
    name: "Phim Hoạt Hình",
    subtitle: "Anime, phim hoạt hình 3D và những câu chuyện kỳ ảo dành cho mọi lứa tuổi.",
    accent: "#10B981",
  },
  {
    slug: "tv-shows",
    name: "Chương Trình TV",
    subtitle: "Show truyền hình thực tế, giải trí và âm nhạc đặc sắc được yêu thích.",
    accent: "#8B5CF6",
  },
];

const COUNTRIES: CollectionItem[] = [
  {
    slug: "viet-nam",
    name: "Phim Việt Nam",
    subtitle: "Điện ảnh và phim truyền hình Việt Nam giàu bản sắc qua từng thời kỳ.",
    accent: "#EF4444",
  },
  {
    slug: "thai-lan",
    name: "Phim Thái Lan",
    subtitle: "Tác phẩm tình cảm, học đường, kinh dị và hành động đặc trưng xứ Chùa Vàng.",
    accent: "#EC4899",
  },
  {
    slug: "hong-kong",
    name: "Phim Hồng Kông",
    subtitle: "Kinh điển TVB, hình sự cảnh sát và võ thuật Hồng Kông vang bóng một thời.",
    accent: "#F59E0B",
  },
  {
    slug: "au-my",
    name: "Phim Âu Mỹ",
    subtitle: "Siêu phẩm Hollywood, hành động mãn nhãn và các series truyền hình đình đám.",
    accent: "#3B82F6",
  },
  {
    slug: "han-quoc",
    name: "Phim Hàn Quốc",
    subtitle: "K-Drama lãng mạn, tâm lý xã hội sâu sắc và điện ảnh Hàn Quốc đỉnh cao.",
    accent: "#38BDF8",
  },
  {
    slug: "trung-quoc",
    name: "Phim Trung Quốc",
    subtitle: "Cổ trang huyền huyễn, tiên hiệp, ngôn tình và phim hiện đại Hoa ngữ.",
    accent: "#F97316",
  },
  {
    slug: "nhat-ban",
    name: "Phim Nhật Bản",
    subtitle: "Điện ảnh J-Movie tinh tế cùng kho anime đặc sắc từ Nhật Bản.",
    accent: "#FB7185",
  },
  {
    slug: "dai-loan",
    name: "Phim Đài Loan",
    subtitle: "Thanh xuân vườn trường, tâm lý nhẹ nhàng và dòng phim nghệ thuật Đài Loan.",
    accent: "#14B8A6",
  },
];

const GENRES: CollectionItem[] = [
  { slug: "kinh-di", name: "Kinh Dị", subtitle: "Những bộ phim rùng rợn, ám ảnh và kịch tính đến nghẹt thở.", accent: "#9CA3AF" },
  { slug: "hanh-dong", name: "Hành Động", subtitle: "Nhịp độ dồn dập, rượt đuổi nghẹt thở và những pha đối đầu mãn nhãn.", accent: "#E50914" },
  { slug: "tinh-cam", name: "Tình Cảm", subtitle: "Những câu chuyện yêu thương sâu lắng, lãng mạn và chạm đến cảm xúc.", accent: "#EC4899" },
  { slug: "hai-huoc", name: "Hài Hước", subtitle: "Tiếng cười sảng khoái và những tình huống duyên dáng giải trí.", accent: "#F59E0B" },
  { slug: "vien-tuong", name: "Viễn Tưởng", subtitle: "Thế giới tương lai, công nghệ vượt bậc và du hành không gian.", accent: "#38BDF8" },
  { slug: "co-trang", name: "Cổ Trang", subtitle: "Bối cảnh lịch sử hoa lệ, cung đấu và giang hồ nghĩa hiệp.", accent: "#D97706" },
  { slug: "tam-ly", name: "Tâm Lý", subtitle: "Chiều sâu nội tâm nhân vật và những lát cắt đời sống chân thực.", accent: "#6366F1" },
  { slug: "hinh-su", name: "Hình Sự", subtitle: "Phá án ly kỳ, đấu trí cân não giữa tội phạm và công lý.", accent: "#64748B" },
  { slug: "phieu-luu", name: "Phiêu Lưu", subtitle: "Hành trình khám phá vùng đất mới đầy thử thách và bất ngờ.", accent: "#10B981" },
  { slug: "vo-thuat", name: "Võ Thuật", subtitle: "Những màn tỷ thí công phu mãn nhãn và tinh thần thượng võ.", accent: "#DC2626" },
  { slug: "bi-an", name: "Bí Ẩn", subtitle: "Nút thắt khó lường và những bí mật chờ được hé lộ ở phút cuối.", accent: "#8B5CF6" },
  { slug: "than-thoai", name: "Thần Thoại", subtitle: "Truyền thuyết sử thi, phép thuật và sinh vật huyền bí.", accent: "#A855F7" },
  { slug: "gia-dinh", name: "Gia Đình", subtitle: "Thông điệp ấm áp về tình thân phù hợp thưởng thức cùng cả nhà.", accent: "#22C55E" },
  { slug: "chinh-kich", name: "Chính Kịch", subtitle: "Tác phẩm có chiều sâu kịch bản, giàu giá trị nghệ thuật và giải thưởng.", accent: "#94A3B8" },
  { slug: "chien-tranh", name: "Chiến Tranh", subtitle: "Tái hiện những trận chiến lịch sử hào hùng và khốc liệt.", accent: "#78716C" },
  { slug: "khoa-hoc", name: "Khoa Học", subtitle: "Khám phá tri thức vũ trụ, tự nhiên và giả thuyết khoa học.", accent: "#06B6D4" },
  { slug: "hoc-duong", name: "Học Đường", subtitle: "Ký ức tuổi trẻ, tình bạn và những rung động đầu đời.", accent: "#F472B6" },
  { slug: "am-nhac", name: "Âm Nhạc", subtitle: "Giai điệu truyền cảm hứng và hành trình chinh phục sân khấu.", accent: "#A78BFA" },
  { slug: "tai-lieu", name: "Tài Liệu", subtitle: "Góc nhìn chân thực về con người, lịch sử và thế giới quanh ta.", accent: "#9CA3AF" },
  { slug: "the-thao", name: "Thể Thao", subtitle: "Ý chí vượt giới hạn và tinh thần đồng đội trên đấu trường.", accent: "#10B981" },
  { slug: "kinh-dien", name: "Kinh Điển", subtitle: "Những kiệt tác điện ảnh vượt thời gian đáng xem ít nhất một lần.", accent: "#F5C518" },
];

const TRENDING_WINDOWS: CollectionItem[] = [
  {
    slug: "day",
    name: "Thịnh Hành Trong Ngày",
    subtitle: "Những bộ phim được cộng đồng tìm kiếm và quan tâm nhiều nhất 24 giờ qua.",
    accent: "#F5C518",
  },
  {
    slug: "week",
    name: "Bảng Xếp Hạng Tuần",
    subtitle: "Top phim điện ảnh tạo sức hút mạnh mẽ nhất trong tuần trên toàn cầu.",
    accent: "#F5C518",
  },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(CURRENT_YEAR - i));

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Mới cập nhật" },
  { value: "year", label: "Năm phát hành" },
  { value: "views", label: "Lượt xem nhiều" },
];

const DIMENSION_TABS: { id: BrowseDimension; label: string }[] = [
  { id: "category", label: "Danh mục" },
  { id: "genre", label: "Thể loại" },
  { id: "country", label: "Quốc gia" },
  { id: "trending", label: "Thịnh hành" },
];

function stripVietnameseAccents(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getItemsForDimension(dim: BrowseDimension): CollectionItem[] {
  switch (dim) {
    case "country":
      return COUNTRIES;
    case "genre":
      return GENRES;
    case "trending":
      return TRENDING_WINDOWS;
    case "category":
    default:
      return CATEGORIES;
  }
}

function getDefaultSlugForDimension(dim: BrowseDimension): string {
  return getItemsForDimension(dim)[0].slug;
}

function normalizeDimension(raw: string | null): BrowseDimension {
  if (raw === "country" || raw === "genre" || raw === "trending" || raw === "category") {
    return raw;
  }
  return "category";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const gridTopRef = useRef<HTMLDivElement>(null);

  const dimension: BrowseDimension = normalizeDimension(searchParams.get("type"));
  const dimensionItems = getItemsForDimension(dimension);
  const rawSlug = searchParams.get("slug");
  const activeSlug = dimensionItems.some((item) => item.slug === rawSlug)
    ? (rawSlug as string)
    : getDefaultSlugForDimension(dimension);

  const activeYear = searchParams.get("year") || "";
  const rawSort = searchParams.get("sort");
  const activeSort: SortOption =
    rawSort === "year" || rawSort === "views" ? rawSort : "newest";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [keyword, setKeyword] = useState(() => searchParams.get("q") || "");

  const activeCollection = useMemo(() => {
    return (
      dimensionItems.find((item) => item.slug === activeSlug) ||
      dimensionItems[0]
    );
  }, [dimensionItems, activeSlug]);

  useDocumentTitle(`${activeCollection.name} | Cineverse`);

  const [movies, setMovies] = useState<any[]>([]);
  const [loadedThroughPage, setLoadedThroughPage] = useState<number>(urlPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState<number>(0);

  const updateParams = useCallback(
    (patch: Record<string, string | number | null | undefined>, replace = false) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  // Sync keyword input if URL query changes externally
  useEffect(() => {
    const qParam = searchParams.get("q") || "";
    setKeyword(qParam);
  }, [searchParams]);

  const buildApiFilters = useCallback(() => {
    const sortMap: Record<SortOption, { sort_field: string; sort_type: string }> = {
      newest: { sort_field: "modified.time", sort_type: "desc" },
      year: { sort_field: "year", sort_type: "desc" },
      views: { sort_field: "view", sort_type: "desc" },
    };
    const chosenSort = sortMap[activeSort];
    return {
      year: activeYear || undefined,
      sort_field: chosenSort.sort_field,
      sort_type: chosenSort.sort_type,
    };
  }, [activeYear, activeSort]);

  const fetchCollectionPage = useCallback(
    async (targetPage: number) => {
      if (dimension === "trending") {
        const items = await api.getTrendingTmdb(activeSlug === "week" ? "week" : "day");
        return {
          items: items || [],
          totalPages: 1,
          totalItems: (items || []).length,
        };
      }

      const filters = buildApiFilters();
      let res: { items: any[]; pagination: any };

      if (dimension === "country") {
        res = await api.getByCountry(activeSlug, targetPage, filters);
      } else if (dimension === "genre") {
        res = await api.getByGenre(activeSlug, targetPage, filters);
      } else if (activeSlug === "phim-moi-cap-nhat") {
        res = await api.getNewUpdated(targetPage, filters);
      } else {
        res = await api.getByCategory(activeSlug, targetPage, filters);
      }

      const items = res?.items || [];
      const tp = res?.pagination?.totalPages || 1;
      const ti =
        typeof res?.pagination?.totalItems === "number"
          ? res.pagination.totalItems
          : null;

      return { items, totalPages: tp, totalItems: ti };
    },
    [dimension, activeSlug, buildApiFilters]
  );

  // Initial & page-jump load
  useEffect(() => {
    let cancelled = false;
    const loadPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCollectionPage(urlPage);
        if (cancelled) return;
        setMovies(data.items);
        setLoadedThroughPage(urlPage);
        setTotalPages(Math.max(1, data.totalPages));
        setTotalItems(data.totalItems);
      } catch (err) {
        if (cancelled) return;
        console.warn("[Browse] Failed to load collection:", err);
        setError("Không thể tải danh sách phim. Vui lòng kiểm tra kết nối mạng và thử lại.");
        showToast("Không thể tải danh sách phim.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPage();
    return () => {
      cancelled = true;
    };
  }, [fetchCollectionPage, urlPage, retryNonce, showToast]);

  const handleLoadMore = async () => {
    if (loadingMore || loadedThroughPage >= totalPages || dimension === "trending") return;
    const nextPage = loadedThroughPage + 1;
    setLoadingMore(true);
    try {
      const data = await fetchCollectionPage(nextPage);
      setMovies((prev) => {
        const existingSlugs = new Set(prev.map((m) => m.slug || m._id));
        const fresh = data.items.filter((m: any) => !existingSlugs.has(m.slug || m._id));
        return [...prev, ...fresh];
      });
      setLoadedThroughPage(nextPage);
      if (data.totalPages) setTotalPages(Math.max(1, data.totalPages));
    } catch (err) {
      console.warn("[Browse] Load more failed:", err);
      showToast("Không thể tải thêm phim lúc này.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDimensionChange = (nextDim: BrowseDimension) => {
    if (nextDim === dimension) return;
    const nextSlug = getDefaultSlugForDimension(nextDim);
    updateParams({
      type: nextDim,
      slug: nextSlug,
      page: 1,
      year: nextDim === "trending" ? "" : activeYear,
      sort: nextDim === "trending" ? "" : activeSort === "newest" ? "" : activeSort,
    });
  };

  const handleCollectionSelect = (slug: string) => {
    if (slug === activeSlug) return;
    updateParams({ type: dimension, slug, page: 1 });
  };

  const handleYearChange = (yearVal: string) => {
    updateParams({ year: yearVal || null, page: 1 });
  };

  const handleSortChange = (sortVal: SortOption) => {
    updateParams({ sort: sortVal === "newest" ? null : sortVal, page: 1 });
  };

  const handleKeywordChange = (val: string) => {
    setKeyword(val);
    updateParams({ q: val.trim() ? val : null }, true);
  };

  const handleClearFilters = () => {
    setKeyword("");
    updateParams({ year: null, sort: null, q: null, page: 1 });
  };

  const handlePageJump = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === urlPage) return;
    updateParams({ page: targetPage });
    if (gridTopRef.current) {
      const y = gridTopRef.current.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  };

  const filteredMovies = useMemo(() => {
    let list = movies;

    // For Trending (TMDB), apply year & sort filtering client-side if selected
    if (dimension === "trending") {
      if (activeYear) {
        list = list.filter((m) => String(m.year || "") === activeYear);
      }
      if (activeSort === "year") {
        list = [...list].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
      } else if (activeSort === "views") {
        list = [...list].sort(
          (a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0)
        );
      }
    }

    const cleanQuery = stripVietnameseAccents(keyword);
    if (!cleanQuery) return list;

    return list.filter((m) => {
      const nameNorm = stripVietnameseAccents(m.name || "");
      const origNorm = stripVietnameseAccents(m.origin_name || "");
      const yearStr = String(m.year || "");
      const catNames = Array.isArray(m.category)
        ? m.category.map((c: any) => stripVietnameseAccents(c.name || "")).join(" ")
        : "";
      return (
        nameNorm.includes(cleanQuery) ||
        origNorm.includes(cleanQuery) ||
        yearStr.includes(cleanQuery) ||
        catNames.includes(cleanQuery)
      );
    });
  }, [movies, keyword, dimension, activeYear, activeSort]);

  const hasActiveFilters = Boolean(
    activeYear || activeSort !== "newest" || keyword.trim().length > 0
  );

  const pageNumbers = useMemo(
    () => getPageNumbers(urlPage, totalPages),
    [urlPage, totalPages]
  );

  const sortLabel =
    SORT_OPTIONS.find((s) => s.value === activeSort)?.label || "Mới cập nhật";

  const pageRangeText =
    loadedThroughPage > urlPage
      ? `Trang ${urlPage}–${loadedThroughPage} / ${totalPages}`
      : `Trang ${urlPage} / ${totalPages}`;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Atmospheric Header */}
      <section className="relative pt-24 md:pt-28 pb-8 border-b border-white/[0.08] overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 left-1/4 w-[520px] h-[320px] rounded-full opacity-[0.14] blur-[120px]"
          style={{ backgroundColor: activeCollection.accent }}
        />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-white/65 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang chủ</span>
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-3xl">
              <h1
                className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white tracking-tight leading-tight"
                style={{ textWrap: "balance" }}
              >
                {activeCollection.name}
              </h1>
              <p className="text-sm sm:text-base text-white/65 mt-2 leading-relaxed">
                {activeCollection.subtitle}
              </p>
            </div>

            {/* Unboxed Clean Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/55 tabular-nums shrink-0">
              <span>{filteredMovies.length} phim đang hiển thị</span>
              {totalItems !== null && totalItems > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{totalItems.toLocaleString("vi-VN")} tổng số phim</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{pageRangeText}</span>
              {dimension !== "trending" && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{sortLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Workspace */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 md:pt-8">
        {/* Filter & Navigation Toolbar */}
        <div className="bg-[#121212] border border-white/[0.08] rounded-2xl p-4 sm:p-5 mb-8 space-y-4">
          {/* Top Row: Dimension Tabs + Search & Dropdown Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* Dimension Segmented Switcher */}
            <div
              className="flex items-center gap-1 p-1 bg-[#0A0A0A] border border-white/[0.08] rounded-xl overflow-x-auto no-scrollbar"
              role="tablist"
              aria-label="Phân loại danh mục phim"
            >
              {DIMENSION_TABS.map((tab) => {
                const isActive = dimension === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleDimensionChange(tab.id)}
                    className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#E50914] text-white shadow-sm"
                        : "text-white/65 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search, Year, Sort & Reset */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
              {/* In-page quick search */}
              <div className="relative flex-1 sm:w-60 sm:flex-none">
                <Search className="w-4 h-4 text-white/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => handleKeywordChange(e.target.value)}
                  placeholder="Lọc nhanh tên phim..."
                  aria-label="Lọc nhanh tên phim trong trang"
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-white/10 focus:border-[#E50914] rounded-xl pl-10 pr-10 text-sm text-white placeholder:text-white/40 outline-none transition-colors"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => handleKeywordChange("")}
                    aria-label="Xóa từ khóa lọc"
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-white/50 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                {/* Year Filter */}
                <label className="sr-only" htmlFor="browse-year-select">
                  Năm phát hành
                </label>
                <select
                  id="browse-year-select"
                  value={activeYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="min-h-[44px] flex-1 sm:flex-none bg-[#0A0A0A] border border-white/10 hover:border-white/25 focus:border-[#E50914] rounded-xl px-3.5 text-sm text-white outline-none cursor-pointer transition-colors"
                >
                  <option value="">Tất cả năm</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      Năm {y}
                    </option>
                  ))}
                </select>

                {/* Sort Filter */}
                <label className="sr-only" htmlFor="browse-sort-select">
                  Sắp xếp theo
                </label>
                <select
                  id="browse-sort-select"
                  value={activeSort}
                  onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  className="min-h-[44px] flex-1 sm:flex-none bg-[#0A0A0A] border border-white/10 hover:border-white/25 focus:border-[#E50914] rounded-xl px-3.5 text-sm text-white outline-none cursor-pointer transition-colors"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Reset Filters Button */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="min-h-[44px] px-4 rounded-xl border border-white/15 hover:bg-white/[0.08] text-sm font-medium text-white/85 hover:text-white inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Collection Selector Strip */}
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-1 sm:pb-0">
              {dimensionItems.map((item) => {
                const isSelected = item.slug === activeSlug;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => handleCollectionSelect(item.slug)}
                    className={`min-h-[44px] px-4 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-white text-black border-white font-semibold shadow-sm"
                        : "bg-[#1A1A1A] text-white/75 border-white/[0.06] hover:bg-[#242424] hover:text-white hover:border-white/15"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll Anchor for Direct Page Jumps */}
        <div ref={gridTopRef} />

        {/* Content States */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
            {[...Array(15)].map((_, idx) => (
              <MovieCardSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-10 md:p-16 text-center max-w-xl mx-auto my-8">
            <AlertCircle className="w-10 h-10 text-[#E50914] mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-heading font-bold text-white mb-2">
              Không thể tải danh sách phim
            </h2>
            <p className="text-sm text-white/60 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="min-h-[44px] px-6 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-10 md:p-16 text-center max-w-xl mx-auto my-8">
            <SlidersHorizontal className="w-10 h-10 text-white/40 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-heading font-bold text-white mb-2">
              Không tìm thấy phim phù hợp
            </h2>
            <p className="text-sm text-white/60 mb-6">
              {keyword.trim()
                ? `Không có phim nào khớp với "${keyword.trim()}" trong trang đã tải.`
                : "Thử thay đổi năm phát hành hoặc chọn một danh mục khác."}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
              {keyword.trim() && (
                <Link
                  to={`/search?q=${encodeURIComponent(keyword.trim())}`}
                  className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Tìm trên toàn Cineverse</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* If keyword narrowed results, also offer full catalog jump */}
            {keyword.trim() && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/[0.06] text-sm">
                <p className="text-white/70">
                  Hiển thị <span className="text-white font-semibold tabular-nums">{filteredMovies.length}</span> kết quả khớp với{" "}
                  <span className="text-white font-semibold">"{keyword.trim()}"</span>
                </p>
                <Link
                  to={`/search?q=${encodeURIComponent(keyword.trim())}`}
                  className="text-[#E50914] hover:text-red-400 font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Tìm "{keyword.trim()}" trong toàn bộ kho phim</span>
                </Link>
              </div>
            )}

            {/* Poster Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 gap-y-8 md:gap-y-10">
              {filteredMovies.map((movie, index) => (
                <MovieCard
                  key={`${movie.slug || movie._id || "browse"}-${index}`}
                  movie={movie}
                  priority={index < 5}
                />
              ))}
            </div>

            {/* Hybrid Pagination Footer: Load More + Numbered Page Bar */}
            {dimension !== "trending" && totalPages > 1 && (
              <div className="mt-12 md:mt-16 pt-8 border-t border-white/[0.08] flex flex-col items-center gap-6">
                {/* Load More CTA */}
                {loadedThroughPage < totalPages && (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="min-h-[48px] px-8 rounded-xl bg-[#E50914] hover:bg-[#b80710] disabled:opacity-60 text-white font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-[0_6px_24px_rgba(229,9,20,0.35)] transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang tải trang {loadedThroughPage + 1}...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span className="tabular-nums">
                          Tải thêm phim (Trang {loadedThroughPage + 1} / {totalPages})
                        </span>
                      </>
                    )}
                  </button>
                )}

                {/* Numbered Page Bar */}
                <nav
                  aria-label="Phân trang danh sách phim"
                  className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
                >
                  <button
                    type="button"
                    onClick={() => handlePageJump(urlPage - 1)}
                    disabled={urlPage <= 1}
                    className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] disabled:opacity-40 disabled:pointer-events-none text-sm font-medium text-white inline-flex items-center gap-1.5 border border-white/[0.08] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Trước</span>
                  </button>

                  {pageNumbers.map((p, idx) =>
                    p === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="min-w-[32px] text-center text-white/40 text-sm select-none"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePageJump(p)}
                        aria-current={p === urlPage ? "page" : undefined}
                        className={`min-w-[44px] min-h-[44px] px-3 rounded-xl text-sm font-semibold tabular-nums transition-colors cursor-pointer border ${
                          p === urlPage
                            ? "bg-[#E50914] text-white border-[#E50914] shadow-[0_4px_14px_rgba(229,9,20,0.4)]"
                            : "bg-[#18181B] text-white/75 border-white/[0.08] hover:bg-[#27272A] hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => handlePageJump(urlPage + 1)}
                    disabled={urlPage >= totalPages}
                    className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] disabled:opacity-40 disabled:pointer-events-none text-sm font-medium text-white inline-flex items-center gap-1.5 border border-white/[0.08] transition-colors cursor-pointer"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
