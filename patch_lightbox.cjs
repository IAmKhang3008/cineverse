const fs = require('fs');
let code = fs.readFileSync('src/pages/Detail.tsx', 'utf8');

if (!code.includes('selectedImage')) {
  code = code.replace(
    /const \[images, setImages\] = useState<any\[\]>\(\[\]\);/,
    `const [images, setImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);`
  );

  code = code.replace(
    /className="rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-\[0_10px_25px_rgba\(229,9,20,0\.3\)\] bg-\[#2A2A2A\]"/,
    `className="rounded-xl overflow-hidden aspect-video cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_10px_25px_rgba(229,9,20,0.3)] bg-[#2A2A2A]"
                          onClick={() => setSelectedImage(\`https://image.tmdb.org/t/p/original\${img.file_path}\`)}`
  );

  // Add the lightbox UI at the very end of the component, just before the closing </div>
  code = code.replace(
    /    <\/div>\n  \);\n}\n$/,
    `
      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={getImageUrl(selectedImage)} 
            alt="Phóng to" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
`
  );
  fs.writeFileSync('src/pages/Detail.tsx', code);
  console.log('lightbox added');
} else {
  console.log('lightbox already exists');
}
