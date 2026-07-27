const fs = require('fs');
let code = fs.readFileSync('src/pages/Detail.tsx', 'utf8');

const newFetchLogic = `
      try {
        const imagesData = await api.getMovieImages(movie.slug).catch(() => null);
        if (imagesData && imagesData.images && imagesData.images.length > 0) {
          const uniqueImages = imagesData.images.filter((img: any, index: number, self: any[]) =>
            self.findIndex((i: any) => i.file_path === img.file_path) === index
          );
          if (uniqueImages.length > 0) {
            setImages(uniqueImages.slice(0, 16));
            gotImages = true;
          }
        }
      } catch (err) {
        console.warn("[API] Failed to fetch images from phimapi:", err);
      }

      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      
      try {
        let tmdbId = movie.tmdb?.id;
        let tmdbType = movie.tmdb?.type || 'movie';
        
        if (!tmdbId) {
          const yearQuery = movie.year ? \`&year=\${movie.year}\` : '';
          const searchUrl = \`https://api.themoviedb.org/3/search/multi?api_key=\${apiKey}&query=\${encodeURIComponent(movie.origin_name || movie.name)}\${yearQuery}&language=vi-VN\`;
          const searchData = await fetchWithCache(\`tmdb_search_\${movie.slug}\`, () => fetch(searchUrl).then(r => r.json()), TTL.TMDB_STATIC);
          if (searchData.results?.length > 0) {
            tmdbId = searchData.results[0].id;
            tmdbType = searchData.results[0].media_type || (searchData.results[0].first_air_date ? 'tv' : 'movie');
          }
        }

        if (!tmdbId) {
          setLoadingCast(false);
          setLoadingImages(false);
          return;
        }

        const creditsUrl = \`https://api.themoviedb.org/3/\${tmdbType}/\${tmdbId}/credits?api_key=\${apiKey}&language=vi-VN\`;
        const creditsData = await fetchWithCache(\`tmdb_credits_\${tmdbType}_\${tmdbId}\`, () => fetch(creditsUrl).then(r => r.json()), TTL.TMDB_STATIC);
        
        if (creditsData.cast) {
          setCast(creditsData.cast.slice(0, 12));
          gotPeoples = true;
        }
        
        // Also fetch detail for rating if needed, but since we are replacing the append_to_response, 
        // let's fetch detail too to maintain existing rating logic and fallback images
        const detailUrl = \`https://api.themoviedb.org/3/\${tmdbType}/\${tmdbId}?api_key=\${apiKey}&language=vi-VN&append_to_response=images&include_image_language=en,null,vi\`;
        const detailData = await fetchWithCache(\`tmdb_detail_\${tmdbType}_\${tmdbId}\`, () => fetch(detailUrl).then(r => r.json()), TTL.TMDB_STATIC);

        if (!rating && detailData.vote_average) {
          let formattedVotes = '';
          if (detailData.vote_count) {
            formattedVotes = detailData.vote_count >= 1000 
               ? \`\${(detailData.vote_count / 1000).toFixed(1)}K\` 
               : \`\${detailData.vote_count}\`;
          }
          setRating({
            source: 'TMDb',
            score: detailData.vote_average.toFixed(1),
            votes: formattedVotes
          });
        }

        if (!gotImages) {
          let extendedImages: any[] = [];
          if (detailData.images?.backdrops?.length > 0) {
            extendedImages = [...detailData.images.backdrops];
          }
          if (detailData.images?.posters?.length > 0 && extendedImages.length < 5) {
            extendedImages = [...extendedImages, ...detailData.images.posters];
          }
          const uniqueImages = extendedImages.filter((img, index, self) =>
            self.findIndex(i => i.file_path === img.file_path) === index
          );
          setImages(uniqueImages.slice(0, 16));
        }

      } catch (err) {
        console.warn("[TMDB] Error fetching data:", err);
      }
`;

code = code.replace(/      try \{\n        \/\/ Thử lấy dữ liệu từ phimapi.*?\n      \} catch \(err\) \{\n        console\.warn\("\[API\] Failed to fetch peoples\/images from phimapi:", err\);\n      \}\n\n      \/\/ Nếu đã lấy đầy đủ, không cần fetch trực tiếp từ TMDB.*?\n      if \(!gotPeoples && combinedData\.credits\?\.cast\) \{\n        setCast\(combinedData\.credits\.cast\.slice\(0, 12\)\);\n      \}\n\n      if \(!gotImages\) \{\n        \/\/ Xử lý kho ảnh.*?\n        setImages\(uniqueImages\.slice\(0, 16\)\);\n      \}\n    \} catch \(err\) \{\n      console\.warn\("\[API\] Failed to fetch from TMDB:", err\);\n    \}/s, newFetchLogic.trim());

fs.writeFileSync('src/pages/Detail.tsx', code);
