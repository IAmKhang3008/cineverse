const fs = require('fs');
const path = './src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldWrapper = `className="flex w-full sm:w-auto items-center bg-white/5 border border-white/10 rounded-full p-1 gap-1 flex-shrink-0"`;
const newWrapper = `className="grid grid-cols-2 w-full sm:w-auto bg-white/5 border border-white/10 rounded-full p-1 gap-1 flex-shrink-0"`;
code = code.replace(oldWrapper, newWrapper);

const oldButtonClass = `className={\`flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-2 sm:px-6 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 \${`;
const newButtonClass = `className={\`flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-1 sm:px-6 rounded-full text-[11px] sm:text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 \${`;
code = code.replace(oldButtonClass, newButtonClass);

fs.writeFileSync(path, code);
