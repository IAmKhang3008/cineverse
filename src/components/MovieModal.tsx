import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Star, Calendar, Clock, Globe, Languages } from "lucide-react";
import { fetchMovieDetails } from "../api";
import { MovieDetail } from "../types";
import { cleanLangString, isVietnameseMovie } from "../lib/utils";

interface MovieModalProps {
  slug: string | null;
  onClose: () => void;
  cdnDomain?: string;
}

export function MovieModal({ slug, onClose, cdnDomain = "https://phimimg.com" }: MovieModalProps) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;
    
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMovieDetails(slug!);
        if (isMounted) {
          if (res.status) {
            setDetail(res.movie);
          } else {
            setError(res.msg || "Failed to load movie details.");
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "An error occurred");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    loadData();
    return () => { isMounted = false; };
  }, [slug]);

  return (
    <Dialog.Root open={!!slug} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-zinc-800 bg-zinc-950 p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl md:w-full overflow-hidden max-h-[90vh] flex flex-col">
          
          <div className="flex flex-col h-full overflow-y-auto">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="flex h-64 items-center justify-center p-6 text-center text-red-400">
                <p>{error}</p>
              </div>
            ) : detail ? (
              <div className="flex flex-col md:flex-row relative">
                <div className="absolute top-4 right-4 z-10">
                  <Dialog.Close className="rounded-full bg-black/50 p-2 text-white hover:bg-black/80 transition-colors">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </Dialog.Close>
                </div>
                
                {/* Left side: Poster */}
                <div className="w-full md:w-[350px] shrink-0 bg-zinc-900 relative">
                  <div className="aspect-[2/3] md:h-full relative w-full">
                    {detail.poster_url ? (
                      <img
                        src={detail.poster_url.startsWith("http") ? detail.poster_url : `${cdnDomain}/${detail.poster_url}`}
                        alt={detail.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-500">
                        No Image
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent md:hidden" />
                  </div>
                </div>
                
                {/* Right side: Info */}
                <div className="flex-1 p-6 sm:p-8 flex flex-col gap-6 text-zinc-300 relative">
                  <div className="-mt-16 relative z-10 md:mt-0">
                    <Dialog.Title className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                      {detail.name}
                    </Dialog.Title>
                    <p className="mt-2 text-lg text-emerald-400 font-medium">
                      {detail.origin_name}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                    {detail.year && (
                      <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        {detail.year}
                      </div>
                    )}
                    {detail.time && (
                      <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1">
                        <Clock className="h-4 w-4 text-zinc-400" />
                        {detail.time}
                      </div>
                    )}
                    {detail.quality && detail.lang && (
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-400">
                        <Languages className="h-4 w-4" />
                        {detail.quality} - {cleanLangString(detail.lang, false, isVietnameseMovie(detail))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {detail.category?.map(c => (
                      <span key={c.id} className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-800/50">
                        {c.name}
                      </span>
                    ))}
                    {detail.country?.map(c => (
                      <span key={c.id} className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-800/50">
                        <Globe className="inline-block h-3 w-3 mr-1 mb-0.5" />
                        {c.name}
                      </span>
                    ))}
                  </div>

                  <div className="prose prose-sm prose-invert max-w-none text-zinc-400 leading-relaxed" 
                       dangerouslySetInnerHTML={{ __html: detail.content }} />
                       
                  <div className="mt-auto pt-6 border-t border-zinc-800 grid gap-4 text-sm sm:grid-cols-2">
                    {detail.director?.length > 0 && detail.director[0] !== "" && (
                      <div>
                        <span className="text-zinc-500 block mb-1">Director</span>
                        <span className="text-zinc-200">{detail.director.join(", ")}</span>
                      </div>
                    )}
                    {detail.actor?.length > 0 && detail.actor[0] !== "" && (
                      <div>
                        <span className="text-zinc-500 block mb-1">Cast</span>
                        <span className="text-zinc-200">{detail.actor.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
