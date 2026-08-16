const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldBlock1 = `<h3 className="text-lg sm:text-2xl md:text-3xl font-heading font-extrabold text-white leading-snug mb-3 tracking-wide drop-shadow-md">
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
                      className="bg-white/10 hover:bg-white/20 border border-white/15 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                    >
                      <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-[#E50914]" />
                      <span>Chuyển sang #Vietsub</span>
                    </button>
                  )}
                </div>`;

const newBlock1 = `<h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md">
                  Nguồn phụ đang mở ở cửa sổ mới.
                </h3>

                <p className="text-gray-300 text-xs sm:text-sm mb-6 max-w-sm leading-relaxed font-medium">
                  Nếu xảy ra sự cố trong quá trình phát, vui lòng thử lại nguồn chính.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (currentEpisode?.link_embed) {
                        window.open(currentEpisode.link_embed, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="bg-[#E50914] hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Mở lại tab mới</span>
                  </button>

                  {vietsubServer && (
                    <button
                      onClick={handleSwitchToVietsub}
                      className="bg-white/10 hover:bg-white/20 border border-white/15 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                    >
                      <Tv className="w-4 h-4 text-[#E50914]" />
                      <span>Về nguồn chính</span>
                    </button>
                  )}
                </div>`;

const oldBlock2 = `<h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md text-center">
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
                </button>`;

const newBlock2 = `<h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-heading font-extrabold text-white leading-snug mb-2 tracking-wide drop-shadow-md text-center">
                  Nguồn phát chính không khả dụng.
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-gray-300 mb-6 text-center">
                  Đang tự động chuyển sang nguồn phụ...
                </p>

                <button
                  onClick={triggerVidsrcAuto}
                  className="bg-[#E50914] hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Chuyển nguồn ngay ({autoRedirectTimer}s)</span>
                </button>`;

code = code.replace(oldBlock1, newBlock1);
code = code.replace(oldBlock2, newBlock2);

fs.writeFileSync(path, code);
