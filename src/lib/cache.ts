// lib/cache.ts

// ============================================================
// CẤU HÌNH TTL THEO TỪNG LOẠI DỮ LIỆU
// ============================================================
export const TTL = {
  // Dữ liệu TMDB: cast, images, rating — gần như không đổi
  TMDB_STATIC:    7 * 24 * 60 * 60 * 1000, // 7 ngày

  // Danh sách phim theo thể loại / quốc gia
  CATEGORY_LIST:  30 * 60 * 1000,           // 30 phút

  // Chi tiết phim (nội dung, trailer)
  MOVIE_DETAIL:   15 * 60 * 1000,           // 15 phút

  // Phim mới cập nhật — cần fresh nhất
  NEW_UPDATED:     2 * 60 * 1000,           // 2 phút

  // Kết quả tìm kiếm — user thường search cùng từ trong 1 session
  SEARCH:          5 * 60 * 1000,           // 5 phút
} as const;

// ============================================================
// NODE CHO DOUBLY LINKED LIST — dùng để implement LRU
// ============================================================
interface CacheNode<T> {
  key:       string;
  value:     T;
  timestamp: number;
  ttl:       number;
  prev:      CacheNode<T> | null;
  next:      CacheNode<T> | null;
  // Đếm số lần được truy cập — dùng cho phân tích hit rate
  hits:      number;
}

// ============================================================
// LRU CACHE CLASS
// ============================================================
export class LRUCache<T = any> {
  private capacity:  number;
  private map:       Map<string, CacheNode<T>>;
  private head:      CacheNode<T>; // Most Recently Used sentinel
  private tail:      CacheNode<T>; // Least Recently Used sentinel
  private cleanupInterval: ReturnType<typeof setInterval>;

  // Thống kê để monitor
  private stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };

  constructor(capacity = 400) {
    this.capacity = capacity;
    this.map      = new Map();

    // Sentinel nodes — không chứa data thật, chỉ để đánh dấu 2 đầu list
    this.head = { key: 'HEAD', value: null as any, timestamp: 0, ttl: 0, prev: null, next: null, hits: 0 };
    this.tail = { key: 'TAIL', value: null as any, timestamp: 0, ttl: 0, prev: null, next: null, hits: 0 };
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // Dọn rác TTL hết hạn mỗi 5 phút
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  // Đưa node lên đầu list (Most Recently Used)
  private moveToFront(node: CacheNode<T>): void {
    this.removeFromList(node);
    this.insertAfterHead(node);
  }

  private removeFromList(node: CacheNode<T>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private insertAfterHead(node: CacheNode<T>): void {
    node.next       = this.head.next;
    node.prev       = this.head;
    this.head.next!.prev = node;
    this.head.next       = node;
  }

  get(key: string): T | null {
    const node = this.map.get(key);

    if (!node) {
      this.stats.misses++;
      return null;
    }

    // Kiểm tra TTL — nếu hết hạn, xóa và báo miss
    if (Date.now() - node.timestamp > node.ttl) {
      this.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return null;
    }

    // Cache HIT — đưa lên đầu list
    this.moveToFront(node);
    node.hits++;
    this.stats.hits++;
    return node.value;
  }

  set(key: string, value: T, ttl: number): void {
    // Nếu key đã tồn tại → cập nhật
    if (this.map.has(key)) {
      const node    = this.map.get(key)!;
      node.value    = value;
      node.timestamp = Date.now();
      node.ttl      = ttl;
      this.moveToFront(node);
      return;
    }

    // Nếu đầy → xóa LRU (node ngay trước tail)
    if (this.map.size >= this.capacity) {
      const lruNode = this.tail.prev!;
      if (lruNode !== this.head) {
        this.delete(lruNode.key);
        this.stats.evictions++;
      }
    }

    // Thêm node mới
    const newNode: CacheNode<T> = {
      key, value,
      timestamp: Date.now(),
      ttl, hits: 0,
      prev: null, next: null,
    };
    this.map.set(key, newNode);
    this.insertAfterHead(newNode);
  }

  delete(key: string): void {
    const node = this.map.get(key);
    if (!node) return;
    this.removeFromList(node);
    this.map.delete(key);
  }

  // Event-based invalidation — xóa tất cả key theo prefix
  // Ví dụ: invalidateByPrefix('movie:avengers') xóa mọi cache liên quan
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  // Dọn rác định kỳ
  private cleanup(): void {
    const now = Date.now();
    for (const [key, node] of this.map.entries()) {
      if (now - node.timestamp > node.ttl) {
        this.delete(key);
        this.stats.expirations++;
      }
    }
  }

  getStats() {
    const total    = this.stats.hits + this.stats.misses;
    const hitRate  = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0';
    return { ...this.stats, hitRate: `${hitRate}%`, size: this.map.size, capacity: this.capacity };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.map.clear();
  }
}

// Singleton — dùng chung toàn app
export const cache = new LRUCache(400);

// ============================================================
// HELPER: fetchWithCache có TTL linh hoạt
// ============================================================
export async function fetchWithCache<T>(
  key:     string,
  fetcher: () => Promise<T>,
  ttl:     number = TTL.CATEGORY_LIST
): Promise<T> {
  const cached = cache.get(key) as T | null;
  if (cached !== null) return cached;

  const data = await fetcher();
  cache.set(key, data, ttl);
  return data;
}

// ============================================================
// EVENT-BASED INVALIDATION
// Gọi khi user thực hiện hành động thay đổi data
// ============================================================
export const invalidate = {
  // Khi user cập nhật thông tin phim (admin)
  movie: (slug: string) => {
    cache.invalidateByPrefix(`movie:${slug}`);
    cache.invalidateByPrefix(`tmdb:${slug}`);
  },

  // Khi danh sách phim mới được cập nhật
  newUpdated: () => {
    cache.invalidateByPrefix('new-updated');
  },

  // Xóa toàn bộ cache TMDB (ví dụ khi đổi API key)
  allTmdb: () => {
    cache.invalidateByPrefix('tmdb:');
  },
};

// Monitor hit rate trong development
if ((import.meta as any).env.DEV) {
  setInterval(() => console.table(cache.getStats()), 30_000);
}
