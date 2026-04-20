import React from "react";
import { cn } from "@/lib/utils";

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
    <div className="w-full">
      {/* Backdrop — khớp với min/max-h của Detail */}
      <div
        className="relative w-full bg-[#0A0A0A]"
        style={{ minHeight: '60vh', maxHeight: '90vh', height: '75vh' }}
      >
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-[#0A0A0A]/20 to-transparent" />
      </div>

      {/* Content — -mt-32 md:-mt-64 khớp với Detail */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative -mt-32 md:-mt-64 z-10 pb-20">
        <div className="flex flex-col md:flex-row gap-6 md:gap-16">

          {/* Poster — w-48 sm:w-56 md:w-80 khớp chính xác */}
          <div className="w-48 sm:w-56 md:w-80 flex-shrink-0 mx-auto md:mx-0">
            <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-12 space-y-4">
            {/* Title: text-3xl..6xl leading-[1.1] */}
            <Skeleton className="h-10 md:h-14 lg:h-[66px] w-3/4 rounded-lg" />

            {/* Origin name: text-xl md:text-2xl italic */}
            <Skeleton className="h-7 md:h-8 w-1/2 rounded-md" />

            {/* Year • country: text-xl */}
            <Skeleton className="h-7 w-40 rounded-md" />

            {/* Tags row: text-sm px-3 py-1.5 → ~36px */}
            <div className="flex gap-3">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-16 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>

            {/* Description: text-sm md:text-base leading-relaxed → ~22-26px/dòng, 4 dòng */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-[22px] w-full rounded-sm" />
              <Skeleton className="h-[22px] w-full rounded-sm" />
              <Skeleton className="h-[22px] w-5/6 rounded-sm" />
              <Skeleton className="h-[22px] w-4/6 rounded-sm" />
            </div>

            {/* Action buttons: py-3 md:py-4 text-base md:text-lg → ~48-56px, min-w-[160px..180px] */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Skeleton className="h-12 md:h-14 w-full sm:w-[180px] rounded-xl" />
              <Skeleton className="h-12 md:h-14 w-full sm:w-[180px] rounded-xl" />
              <Skeleton className="h-12 md:h-14 w-full sm:w-[180px] rounded-xl" />
              <Skeleton className="h-12 md:h-14 w-full sm:w-[180px] rounded-xl" />
            </div>

            {/* Tab bar skeleton */}
            <div className="mt-8 md:mt-12 rounded-2xl border border-white/5 p-4 md:p-6 bg-[#121212]">
              <div className="flex gap-6 border-b border-white/10 pb-4 mb-6">
                <Skeleton className="h-6 w-16 rounded-sm" />
                <Skeleton className="h-6 w-20 rounded-sm" />
                <Skeleton className="h-6 w-16 rounded-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-[22px] w-28 flex-shrink-0 rounded-sm" />
                    <Skeleton className="h-[22px] flex-1 rounded-sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}