const fs = require('fs');
const path = './src/pages/Watch.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = `{isVidsrcServer && (
                          <span className="text-[10px] bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/40 px-2 py-0.5 rounded-full font-semibold">
                            Mở Tab Mới
                          </span>
                        )}`;
const replacement = `{isVidsrcServer && (
                          <span className="text-[8px] sm:text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 px-2 py-0.5 rounded-full font-medium sm:font-semibold whitespace-nowrap" title="Nguồn phụ này không phải lúc nào cũng có sẵn phim">
                            Có thể không có sẵn
                          </span>
                        )}`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
