const fs = require('fs');
const path = './src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetIIFE = `                  {(() => {
                    const trendingSwiperRef = { current: null as SwiperType | null };
                    return (
                      <div className="relative group/trending">
                        <Swiper
                          modules={[Autoplay]}
                          onSwiper={s => { trendingSwiperRef.current = s; }}
                          spaceBetween={16}
                          slidesPerView={2}
                          allowTouchMove={true}
                          grabCursor={true}
                          autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                          breakpoints={SWIPER_BREAKPOINTS}
                          className="pb-2 !overflow-visible"
                        >
                          {trendingMovies.map((movie, i) => (
                            <SwiperSlide key={\`trending-\${activeTab}-\${movie.slug || movie._id || 'item'}-\${i}\`}>
                              <MovieCard movie={movie} onHoldChange={setIsCardHolding} priority={i < 4} />
                            </SwiperSlide>
                          ))}
                        </Swiper>
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
                      </div>
                    );
                  })()}`;

const replacementIIFE = `                  <div className="relative group/trending">
                    <Swiper
                      modules={[Autoplay]}
                      onSwiper={s => { trendingSwiperRef.current = s; }}
                      spaceBetween={16}
                      slidesPerView={2}
                      allowTouchMove={true}
                      grabCursor={true}
                      autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                      breakpoints={SWIPER_BREAKPOINTS}
                      className="pb-2 !overflow-visible"
                    >
                      {trendingMovies.map((movie, i) => (
                        <SwiperSlide key={\`trending-\${activeTab}-\${movie.slug || movie._id || 'item'}-\${i}\`}>
                          <MovieCard movie={movie} onHoldChange={setIsCardHolding} priority={i < 4} />
                        </SwiperSlide>
                      ))}
                    </Swiper>
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

code = code.replace(targetIIFE, replacementIIFE);

const targetRef = `  const showToastRef = useRef(showToast);`;
const replacementRef = `  const showToastRef = useRef(showToast);
  const trendingSwiperRef = useRef<SwiperType | null>(null);`;

code = code.replace(targetRef, replacementRef);

fs.writeFileSync(path, code);
