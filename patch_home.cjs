const fs = require('fs');
const path = './src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove red line below thumbnails
const redLineCode = `{activeHeroIndex === index && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#E50914]" />
                )}`;
code = code.replace(redLineCode, '');

// 2. Adjust thumbnail container and size
const thumbWrapper = `className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-5 md:right-8 z-20 hidden sm:flex gap-1.5 sm:gap-2 md:gap-3 items-end overflow-x-auto no-scrollbar py-1 max-w-[calc(100vw-6rem)]"`;
const newThumbWrapper = `className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-3 sm:right-5 md:right-8 z-20 hidden sm:flex gap-1.5 sm:gap-2 md:gap-3 items-end overflow-x-auto no-scrollbar py-4 px-2 -my-3 -mx-2 max-w-[calc(100vw-6rem)]"`;
code = code.replace(thumbWrapper, newThumbWrapper);

const thumbSize = `w-[52px] h-[30px] sm:w-[64px] sm:h-[36px] md:w-[80px] md:h-[46px]`;
const newThumbSize = `w-[44px] h-[26px] sm:w-[56px] sm:h-[32px] md:w-[72px] md:h-[40px]`;
code = code.replace(thumbSize, newThumbSize);

// 3. Symmetric tabs
const tabsWrapper = `className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 gap-0.5 flex-shrink-0"`;
const newTabsWrapper = `className="flex w-full sm:w-auto items-center bg-white/5 border border-white/10 rounded-full p-1 gap-1 flex-shrink-0"`;
code = code.replace(tabsWrapper, newTabsWrapper);

const tabButtonClass = `className={\`flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-3 sm:px-5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 \${`;
const newTabButtonClass = `className={\`flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-2 sm:px-6 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 \${`;
code = code.replace(tabButtonClass, newTabButtonClass);

fs.writeFileSync(path, code);
