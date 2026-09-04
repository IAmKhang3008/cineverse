const fs = require('fs');

const file = 'src/pages/Watch.tsx';
let content = fs.readFileSync(file, 'utf8');

// add RefreshCcw to imports
content = content.replace(
  'import { Play, Settings, SkipForward, Volume2, Maximize, AlertCircle, Film, Heart, ArrowLeft, ExternalLink, Tv, Sparkles } from "lucide-react";',
  'import { Play, Settings, SkipForward, Volume2, Maximize, AlertCircle, Film, Heart, ArrowLeft, ExternalLink, Tv, Sparkles, RefreshCcw } from "lucide-react";'
);

// replace not found layout
const oldContent = `  if (!movie || !currentEpisode) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-white">
        <h1 className="text-2xl font-heading">Không tìm thấy tập phim</h1>
      </div>
    );
  }`;

const newContent = `  if (!movie || !currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-white space-y-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Không tìm thấy tập phim</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-4 py-2 md:px-5 md:py-2.5 rounded-full backdrop-blur-md border border-white/10 transition-all font-medium cursor-pointer text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            Quay lại
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-[#E50914] hover:bg-[#b80710] text-white px-4 py-2 md:px-5 md:py-2.5 rounded-full backdrop-blur-md transition-all font-medium cursor-pointer text-sm md:text-base shadow-[0_4px_14px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_20px_rgba(229,9,20,0.6)] hover:-translate-y-0.5"
          >
            <RefreshCcw className="w-4 h-4 md:w-5 md:h-5" />
            Làm mới
          </button>
        </div>
      </div>
    );
  }`;

if(content.includes(oldContent)) {
  content = content.replace(oldContent, newContent);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Watch.tsx patched successfully.");
} else {
  console.log("oldContent not found in Watch.tsx");
}
