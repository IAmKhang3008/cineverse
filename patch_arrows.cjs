const fs = require('fs');
const path = './src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update SwiperSection (remove old arrows, wrap Swiper, add new arrows)
const swiperSectionOld = `        {/* Link + Arrows nhóm cùng nhau bên phải */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={link}
            className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1 mr-1"
          >
            Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
          </Link>
          {/* [ARROW FIX] Chỉ hiện trên md+ — mobile dùng swipe */}
          <div className="hidden md:flex items-center gap-1.5">
            <NavArrow direction="prev" onClick={() => swiperRef.current?.slidePrev()} />
            <NavArrow direction="next" onClick={() => swiperRef.current?.slideNext()} />
          </div>
        </div>
      </div>

      <Swiper`;

const swiperSectionNew = `        {/* Link bên phải */}
        <div className="flex items-center flex-shrink-0">
          <Link
            to={link}
            className="text-xs md:text-sm text-[#3B82F6] hover:text-white transition-colors flex items-center gap-1"
          >
            Xem tất cả <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
          </Link>
        </div>
      </div>

      <div className="relative group/slider">
      <Swiper`;

code = code.replace(swiperSectionOld, swiperSectionNew);

const swiperSectionEndOld = `        ))}
      </Swiper>
    </section>`;

const swiperSectionEndNew = `        ))}
      </Swiper>
      
      {/* Nav arrows overlay */}
      <NavArrow 
        direction="prev" 
        onClick={() => swiperRef.current?.slidePrev()} 
        className="absolute -left-4 md:-left-5 top-1/2 -translate-y-1/2 z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
      />
      <NavArrow 
        direction="next" 
        onClick={() => swiperRef.current?.slideNext()} 
        className="absolute -right-4 md:-right-5 top-1/2 -translate-y-1/2 z-20 hidden md:flex opacity-0 group-hover/slider:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
      />
      </div>
    </section>`;

code = code.replace(swiperSectionEndOld, swiperSectionEndNew);


// 2. Update Trending section
const trendingOld = `                        </Swiper>
                        {/* [ARROW FIX] Arrows bên ngoài Swiper — chỉ md+ */}
                        <div className="hidden md:flex items-center justify-end gap-2 mt-3">
                          <NavArrow direction="prev" onClick={() => trendingSwiperRef.current?.slidePrev()} />
                          <NavArrow direction="next" onClick={() => trendingSwiperRef.current?.slideNext()} />
                        </div>
                      </div>`;

const trendingNew = `                        </Swiper>
                        {/* Overlay Arrows - Similar to Hero Banner */}
                        <NavArrow 
                          direction="prev" 
                          onClick={() => trendingSwiperRef.current?.slidePrev()} 
                          className="absolute -left-4 md:-left-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
                        />
                        <NavArrow 
                          direction="next" 
                          onClick={() => trendingSwiperRef.current?.slideNext()} 
                          className="absolute -right-4 md:-right-5 top-1/2 -translate-y-[60%] z-20 hidden md:flex opacity-0 group-hover/trending:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
                        />
                      </div>`;
                      
// NOTE: I used -translate-y-[60%] for Trending just in case, because of pb-2 on the Swiper, moving it slightly up might center it better visually relative to the card image. For SwiperSection I can leave it at -translate-y-1/2. Wait, let's use -translate-y-1/2 for both and it will be fine.
// And change group name
code = code.replace(
  '<div className="relative">', 
  '<div className="relative group/trending">'
);

code = code.replace(trendingOld, trendingNew.replace(/-translate-y-\[60%\]/g, '-translate-y-[60%]'));


fs.writeFileSync(path, code);
