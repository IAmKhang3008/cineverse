import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface SkeletonProps {
  className?: string;
  [key: string]: any;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

// ============================================================
// MOVIE CARD SKELETON
// So sánh với MovieCard thực:
//   - Wrapper: flex flex-col items-center md:items-start
//   - Poster: aspect-[2/3] rounded-[12px]
//   - Info: mt-3 px-1
//   - Title (h3): text-sm (14px) font-heading font-semibold → line-height ~1.5 → cao thực = 21px
//   - Subtitle (p): text-xs (12px) mt-1 → line-height ~1.5 → cao thực = 18px
//   - Mobile: chỉ hiện year (1 dòng text-xs mt-0.5)
//   - Desktop: hiện year • origin (1 dòng text-xs mt-1)
// ============================================================
export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col items-center md:items-start w-full">
      {/* Poster — khớp đúng aspect-ratio và border-radius với Link trong MovieCard */}
      <Skeleton className="aspect-[2/3] w-full rounded-[12px]" />

      {/* Info block — mt-3 px-1 khớp với MovieCard */}
      <div className="mt-3 px-1 w-full text-center md:text-left">
        {/* Title: h3 text-sm font-semibold → line-height 1.5 × 14px = 21px */}
        <Skeleton className="h-[21px] w-3/4 mx-auto md:mx-0 rounded-sm" />

        {/* Subtitle desktop: text-xs mt-1 → 18px */}
        <Skeleton className="h-[18px] w-1/2 mt-1 mx-auto md:mx-0 rounded-sm hidden md:block" />

        {/* Subtitle mobile: text-xs mt-0.5 → 18px */}
        <Skeleton className="h-[18px] w-1/3 mt-0.5 mx-auto rounded-sm md:hidden" />
      </div>
    </div>
  );
}

// ============================================================
// HERO BANNER SKELETON
// So sánh với hero thực trong Home.tsx:
//   - .hero-banner CSS: height: 80vh; min-height: 600px; width: 100vw (full-bleed)
//   - Mobile (.max-width 768px): height: 60vh; min-height: 450px
//   - Badge: text-[10px] md:text-[12px] px-2 py-1 → cao ~24px → h-6 ✓
//   - Title: text-2xl..lg:text-[48px] leading-tight → tối đa ~60px → h-14 (56px) ✓
//   - Description: text-[14px] leading-[21.5px] line-clamp-3 → mỗi dòng 21.5px
//   - Buttons: py-2 md:py-2.5 + text-xs md:text-sm → cao ~32-36px, rounded-[40px]
// ============================================================
export function HeroBannerSkeleton() {
  return (
    <div
      className="w-full relative bg-[#0A0A0A] overflow-hidden"
      style={{ height: '80vh', minHeight: '600px' }}
    >
      <Skeleton className="absolute inset-0 w-full h-full rounded-none" />

      {/* Gradient giống thật để không bị flash khi chuyển */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      <div
        className="absolute inset-x-0 bottom-0 h-[80%] pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.98) 15%, rgba(10,10,10,0.85) 35%, rgba(10,10,10,0.4) 70%, transparent 100%)',
        }}
      />

      <div className="absolute inset-0 flex items-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 lg:px-24 mt-10 md:mt-0">
          <div className="max-w-2xl space-y-3 md:space-y-4">
            {/* Badge: text-[10px/12px] px-2 py-1 → h ~22-24px */}
            <Skeleton className="h-6 w-32 rounded-sm" />

            {/* Title: leading-tight, tối đa 1 dòng ở lg = ~60px */}
            <Skeleton className="h-9 md:h-14 w-3/4 rounded-lg" />

            {/* Description: 3 dòng × 21.5px + gap */}
            <div className="space-y-2 pt-1">
              <Skeleton className="h-[22px] w-full rounded-sm" />
              <Skeleton className="h-[22px] w-5/6 rounded-sm" />
              <Skeleton className="h-[22px] w-4/6 rounded-sm" />
            </div>

            {/* Meta: text-xs → ~18px */}
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-[18px] w-10 rounded-sm" />
              <Skeleton className="h-[18px] w-16 rounded-sm" />
              <Skeleton className="h-[18px] w-14 rounded-sm" />
            </div>

            {/* Buttons: py-2 md:py-2.5 + text-xs md:text-sm = ~32-36px, rounded-[40px] */}
            <div className="flex gap-2 md:gap-3 pt-2">
              <Skeleton className="h-8 md:h-9 w-28 rounded-[40px]" />
              <Skeleton className="h-8 md:h-9 w-24 rounded-[40px]" />
              <Skeleton className="h-8 md:h-9 w-24 rounded-[40px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEARCH SUGGESTION SKELETON — không thay đổi, đã khớp tốt
// ============================================================
export function SearchSuggestionSkeleton() {
  return (
    <div className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0">
      {/* Poster: w-12 h-16 — khớp chính xác */}
      <Skeleton className="w-12 h-16 flex-shrink-0 rounded-md" />
      <div className="flex-grow min-w-0 py-1 space-y-2">
        {/* Title: text-sm font-bold → 21px */}
        <Skeleton className="h-[21px] w-3/4 rounded-sm" />
        {/* Origin: text-xs → 18px */}
        <Skeleton className="h-[18px] w-1/2 rounded-sm" />
        {/* Badges */}
        <div className="flex gap-2 mt-1.5">
          <Skeleton className="h-4 w-8 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOVIE DETAIL SKELETON
// So sánh với Detail.tsx thực:
//   - Backdrop: min-h-[60vh] md:min-h-[75vh] max-h-[90vh]
//   - Content offset: -mt-32 md:-mt-64
//   - Poster: w-48 sm:w-56 md:w-80 aspect-[2/3] rounded-2xl
//   - Title: text-3xl..lg:text-6xl leading-[1.1] → tối đa 1 dòng ~66px → h-14 md:h-[66px]
//   - Subtitle (origin): text-xl md:text-2xl → 28-32px → h-7 md:h-8
//   - Year • country: text-xl → 28px → h-7
//   - Tags: text-sm px-3 py-1.5 → cao ~36px
//   - Buttons: px-6..8 py-3..4 rounded-xl text-base..lg → cao ~48-56px, min-w-[160px..180px]
//   - Description: text-sm md:text-base leading-relaxed → 14-16px * 1.625 = 22-26px/dòng
// ============================================================
export function MovieDetailSkeleton() {
  return (
    <div className="w-full bg-[#0A0A0A] text-white">
      {/* 1. Backdrop Area Skeleton - Khớp chuẩn chiều cao responsive */}
      <div className="relative w-full overflow-hidden min-h-[60vh] md:min-h-[75vh] max-h-[90vh] bg-neutral-900/60 animate-pulse">
        {/* Nút quay lại giả lập */}
        <div className="absolute top-20 md:top-24 left-4 md:left-6 z-50">
          <div className="w-32 h-10 bg-white/10 rounded-full backdrop-blur-md" />
        </div>
        {/* Lớp gradient giả lập phía dưới đáy */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
      </div>

      {/* 2. Content Container Skeleton - Khớp chuẩn khoảng cách âm (-mt-32, -mt-64) */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 -mt-32 md:-mt-64 relative z-10 pb-20">
        <div className="flex flex-col md:flex-row gap-6 md:gap-16">
          
          {/* CỘT TRÁI: Poster phim giả lập (Đảm bảo chuẩn tỉ lệ aspect-[2/3] và không vỡ border-radius) */}
          <div className="w-48 sm:w-56 md:w-80 flex-shrink-0 mx-auto md:mx-0">
            <div className="rounded-2xl bg-neutral-800 border border-white/5 aspect-[2/3] w-full animate-pulse shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
          </div>

          {/* CỘT PHẢI: Thông tin chi tiết phim giả lập */}
          <div className="flex-grow text-center md:text-left pt-4 md:pt-12">
            
            {/* Tên phim (H1 Giả lập) */}
            <div className="h-10 sm:h-12 md:h-14 bg-white/10 rounded-xl w-3/4 mx-auto md:mx-0 mb-3 animate-pulse" />
            
            {/* Tên gốc (H2 Giả lập) */}
            <div className="h-6 bg-white/5 rounded-lg w-1/2 mx-auto md:mx-0 mb-6 animate-pulse" />
            
            {/* Năm phát hành & Quốc gia */}
            <div className="h-5 bg-white/5 rounded-lg w-1/3 mx-auto md:mx-0 mb-6 animate-pulse" />

            {/* Khối Điểm đánh giá & Thể loại (Meta tags) */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
              {/* Điểm số */}
              <div className="w-24 h-8 bg-white/5 rounded-lg animate-pulse" />
              {/* Danh sách các badge thể loại */}
              <div className="flex gap-2">
                <div className="w-16 h-7 bg-white/5 rounded-full animate-pulse" />
                <div className="w-20 h-7 bg-white/5 rounded-full animate-pulse" />
                <div className="w-16 h-7 bg-white/5 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Khối Ngôn ngữ & Chất lượng phim */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-8">
              <div className="w-32 h-8 bg-white/5 rounded-md animate-pulse" />
              <div className="w-16 h-8 bg-white/5 rounded-md animate-pulse" />
            </div>

            {/* Khối DESCRIPTION CARD nổi (Khớp chuẩn border-radius, background, shadow và không tràn overflow) */}
            <div className="max-w-3xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] mb-8">
              <div className="space-y-2.5">
                <div className="h-4 bg-white/10 rounded w-full animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-11/12 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-4/5 animate-pulse" />
              </div>
            </div>
            
            {/* Cụm nút hành động giả lập (Xem ngay, Trailer, Yêu thích) */}
            <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
              {/* Nút Xem Ngay */}
              <div className="w-36 md:w-40 h-12 md:h-14 bg-white/10 rounded-xl animate-pulse" />
              {/* Nút Trailer */}
              <div className="w-28 md:w-32 h-12 md:h-14 bg-white/5 rounded-xl animate-pulse" />
              {/* Nút Yêu Thích */}
              <div className="w-14 h-12 md:h-14 bg-white/5 rounded-xl animate-pulse" />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}