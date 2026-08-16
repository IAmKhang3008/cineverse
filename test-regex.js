const tests = ["Loki Phần 2", "Loki (Phần 2)", "Stranger Things Season 4", "The Witcher Mùa 3"];
tests.forEach(t => {
  const match = t.match(/(?:phần|mùa|season)\s*(\d+)/i);
  console.log(t, "->", match ? match[1] : 1);
});
