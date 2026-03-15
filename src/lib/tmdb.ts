export const fetchWithCache = async (url: string, cacheKey: string, ttl: number = 3600000) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ttl) {
        return data;
      }
    }
  } catch (e) {
    // ignore parse error
  }
  const res = await fetch(url);
  const data = await res.json();
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // ignore quota error
  }
  return data;
};
