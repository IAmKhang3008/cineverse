const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `{isVidsrc ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-6 text-center z-20 overflow-hidden">
              {/* Subtle blurred poster backdrop */}
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: \`url(\${bestPosterUrl || getImageUrl(movie.poster_url)})\` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center px-4">
                {/* Glowing Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/40 text-[#E50914] text-xs font-semibold tracking-wide mb-5 shadow-[0_0_15px_rgba(229,9,20,0.25)] animate-pulse">
                  <Sparkles className="w-4 h-4 text-[#E50914]" />
                  <span>Nguồn: Multi-sub</span>
                </div>

                {/* Main Heading requested by user */}
                <h3 className="text-lg sm:text-2xl md:text-3xl font-heading font-extrabold text-white leading-snug mb-3 tracking-wide drop-shadow-md">
                  Phim đang chiếu ở tab khác. Nếu không xem được, thử{" "}
                  <button 
                    onClick={handleSwitchToVietsub}
                    className="text-[#E50914] hover:underline underline-offset-4 cursor-pointer font-extrabold transition-colors inline-block"
                  >
                    #Vietsub
                  </button>
                  .
                </h3>

                <p className="text-gray-400 text-xs sm:text-sm mb-6 max-w-md leading-relaxed">
                  Tự động mở tab mới để trải nghiệm mượt mà hơn.
                </p>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (currentEpisode?.link_embed) {
                        window.open(currentEpisode.link_embed, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="bg-[#E50914] hover:bg-red-700 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Mở lại Tab Mới</span>
                  </button>

                  {vietsubServer && (
                    <button
                      onClick={handleSwitchToVietsub}
                      className="bg-[#2A2A2A] hover:bg-[#3A3A3A] border border-gray-600 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2.5 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <Film className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <span>Trở về #Vietsub</span>
                    </button>
                  )}
                </div>
              </div>
            </div>`;

const target2 = `          ) : isStreamBrokenOrTrailer ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-6 text-center z-20 overflow-hidden">
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: \`url(\${bestPosterUrl || getImageUrl(movie.poster_url)})\` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center px-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-wide mb-5 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Tự động chuyển nguồn phát ({autoRedirectTimer}s)</span>
                </div>

                <h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md text-center">
                  Không tìm thấy nguồn phát cho phim này.
                </h3>
                <p className="text-base sm:text-lg font-semibold text-[#E50914] mb-6 text-center">
                  Bạn sẽ được chuyển sang trình phát Multi-sub.
                </p>

                <button
                  onClick={triggerVidsrcAuto}
                  className="bg-[#E50914] hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Chuyển sang Multi-sub ngay ({autoRedirectTimer}s)</span>
                </button>
              </div>
            </div>`;


const replacement1 = `{isVidsrc ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-4 sm:p-6 text-center z-20 overflow-hidden">
              {/* Subtle blurred poster backdrop */}
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: \`url(\${bestPosterUrl || getImageUrl(movie.poster_url)})\` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center px-4 sm:px-6">
                {/* Glowing Badge */}
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/40 text-[#E50914] text-[10px] sm:text-xs font-semibold tracking-wide mb-4 sm:mb-6 shadow-[0_0_15px_rgba(229,9,20,0.25)] animate-pulse">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-[#E50914]" />
                  <span>Nguồn: Multi-sub</span>
                </div>

                {/* Main Heading requested by user */}
                <h3 className="text-base sm:text-xl md:text-2xl font-heading font-bold text-white leading-tight mb-2 sm:mb-3 tracking-wide drop-shadow-md">
                  Đang phát tại cửa sổ mới
                </h3>

                <p className="text-gray-400 text-[11px] sm:text-sm mb-6 max-w-[90%] sm:max-w-md leading-relaxed">
                  Trình phát Multi-sub đã được tự động mở. Nếu không thấy, vui lòng nhấn nút bên dưới.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col w-full sm:w-auto sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (currentEpisode?.link_embed) {
                        window.open(currentEpisode.link_embed, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="w-full sm:w-auto bg-[#E50914] hover:bg-red-700 text-white px-5 py-3 sm:px-6 sm:py-3 rounded-[10px] font-semibold text-[13px] sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    <span>Mở lại trình phát</span>
                  </button>

                  {vietsubServer && (
                    <button
                      onClick={handleSwitchToVietsub}
                      className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-5 py-3 sm:px-6 sm:py-3 rounded-[10px] font-medium text-[13px] sm:text-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Trở về #Vietsub</span>
                    </button>
                  )}
                </div>
              </div>
            </div>`;

const replacement2 = `          ) : isStreamBrokenOrTrailer ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d12] p-4 sm:p-6 text-center z-20 overflow-hidden">
              {movie?.poster_url && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-125 pointer-events-none"
                  style={{ backgroundImage: \`url(\${bestPosterUrl || getImageUrl(movie.poster_url)})\` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/85 to-[#0d0d12]/95 pointer-events-none" />

              <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center px-4 sm:px-6">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] sm:text-xs font-semibold tracking-wide mb-4 sm:mb-6 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse">
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                  <span>Đang tự động chuyển nguồn ({autoRedirectTimer}s)</span>
                </div>

                <h3 className="text-base sm:text-xl md:text-2xl font-heading font-bold text-white leading-tight mb-2 sm:mb-3 tracking-wide drop-shadow-md text-center">
                  Máy chủ hiện tại không khả dụng
                </h3>
                <p className="text-[#A0A0A0] text-[11px] sm:text-sm mb-6 max-w-[90%] sm:max-w-md text-center">
                  Hệ thống đang điều hướng sang trình phát <span className="text-[#E50914] font-semibold">Multi-sub</span>.
                </p>

                <button
                  onClick={triggerVidsrcAuto}
                  className="w-full sm:w-auto bg-[#E50914] hover:bg-red-700 text-white px-5 py-3 sm:px-6 sm:py-3 rounded-[10px] font-semibold text-[13px] sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <span>Chuyển ngay ({autoRedirectTimer}s)</span>
                </button>
              </div>
            </div>`;


code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
fs.writeFileSync(path, code);
