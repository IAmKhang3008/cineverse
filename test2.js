import('dotenv').then(dotenv => {
  dotenv.config();
  const TMDB_KEY = process.env.VITE_TMDB_API_KEY;
  fetch(`https://api.themoviedb.org/3/collection/10?api_key=${TMDB_KEY}&language=vi-VN&append_to_response=translations`)
    .then(r=>r.json())
    .then(data => console.log(data.overview, data.translations?.translations?.find(t=>t.iso_639_1==='en')?.data?.overview));
});
