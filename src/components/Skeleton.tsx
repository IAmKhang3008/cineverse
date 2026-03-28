import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#2A2A2A]/80", className)}
      {...props}
    />
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4 mt-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function HeroBannerSkeleton() {
  return (
    <div className="w-full h-[60vh] md:h-[80vh] relative bg-[#0A0A0A] overflow-hidden">
      <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      <div className="absolute inset-0 flex items-center">
        <div className="max-w-[1440px] w-full mx-auto px-6 md:px-16 lg:px-24">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-6 w-32 rounded-sm" />
            <Skeleton className="h-12 md:h-16 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="flex gap-4 pt-4">
              <Skeleton className="h-12 w-32 rounded-full" />
              <Skeleton className="h-12 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchSuggestionSkeleton() {
  return (
    <div className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0">
      <Skeleton className="w-12 h-16 flex-shrink-0 rounded-md" />
      <div className="flex-grow min-w-0 py-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 mt-1.5">
          <Skeleton className="h-4 w-8 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export function MovieDetailSkeleton() {
  return (
    <div className="w-full">
      <div className="relative w-full aspect-[21/9] max-h-[70vh] min-h-[40vh] bg-[#0A0A0A]">
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative -mt-32 md:-mt-64 z-10 pb-20">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="w-48 md:w-72 shrink-0 mx-auto md:mx-0">
            <Skeleton className="aspect-[2/3] w-full rounded-2xl shadow-2xl" />
          </div>
          <div className="flex-1 pt-4 md:pt-12 space-y-6">
            <Skeleton className="h-10 md:h-14 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-1/2" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-10 w-12 rounded-full" />
            </div>
            <div className="space-y-3 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
