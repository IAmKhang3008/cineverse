import { useState, useEffect } from 'react';

export function useHistory() {
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('cineverse_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cineverse_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (movie: any, episodeName: string, progress: number = 0) => {
    if (!movie?.slug) return;
    const existingIndex = history.findIndex(m => m?.slug === movie.slug);
    const newEntry = { ...movie, currentEpisode: episodeName, progress, viewedAt: Date.now() };
    
    let newHistory = [...history];
    if (existingIndex >= 0) {
      newHistory[existingIndex] = newEntry;
    } else {
      newHistory.unshift(newEntry);
    }
    
    // Sort by viewedAt desc
    newHistory.sort((a, b) => b.viewedAt - a.viewedAt);
    setHistory(newHistory.slice(0, 50)); // Keep last 50
  };

  const removeFromHistory = (slug: string) => {
    if (!slug) return;
    setHistory(history.filter(m => m?.slug !== slug));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
}
