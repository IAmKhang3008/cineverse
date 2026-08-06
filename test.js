import('dotenv').then(dotenv => {
  dotenv.config();
  const TMDB_KEY = process.env.VITE_TMDB_API_KEY;
  fetch(`https://api.themoviedb.org/3/collection/10?api_key=${TMDB_KEY}&language=vi`)
    .then(r=>r.json())
    .then(console.log);
});
