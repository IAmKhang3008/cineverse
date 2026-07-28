// lib/cache.ts

// ============================================================
// CẤU HÌNH TTL THEO TỪNG LOẠI DỮ LIỆU
// ============================================================
export const TTL = {
  TMDB_STATIC:    7 * 24 * 60 * 60 * 1000,
  CATEGORY_LIST:  30 * 60 * 1000,
  MOVIE_DETAIL:   15 * 60 * 1000,
  NEW_UPDATED:     2 * 60 * 1000,
  SEARCH:          5 * 60 * 1000,
} as const;

interface CacheNode<T> {
  key:       string;
  value:     T;
  timestamp: number;
  ttl:       number;
  prev:      CacheNode<T> | null;
  next:      CacheNode<T> | null;
  hits:      number;
}

// Prefix for LocalStorage
const L2_CACHE_PREFIX = 'cineverse_l2_';

export class LRUCache<T = any> {
  private capacity:  number;
  private map:       Map<string, CacheNode<T>>;
  private head:      CacheNode<T>;
  private tail:      CacheNode<T>;
  private cleanupInterval: ReturnType<typeof setInterval>;

  private stats = { hits: 0, misses: 0, evictions: 0, expirations: 0, l2_hits: 0 };

  constructor(capacity = 400) {
    this.capacity = capacity;
    this.map      = new Map();

    this.head = { key: 'HEAD', value: null as any, timestamp: 0, ttl: 0, prev: null, next: null, hits: 0 };
    this.tail = { key: 'TAIL', value: null as any, timestamp: 0, ttl: 0, prev: null, next: null, hits: 0 };
    this.head.next = this.tail;
    this.tail.prev = this.head;

    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

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

  // Get data, with support for returning stale data (SWR pattern)
  get(key: string, allowStale = false): { data: T | null, stale: boolean } {
    let node = this.map.get(key);
    let fromL2 = false;

    // Check L2 (LocalStorage) if not in L1
    if (!node) {
      try {
        const l2Raw = localStorage.getItem(L2_CACHE_PREFIX + key);
        if (l2Raw) {
          const l2Data = JSON.parse(l2Raw);
          this.set(key, l2Data.value, l2Data.ttl, l2Data.timestamp);
          node = this.map.get(key);
          fromL2 = true;
          this.stats.l2_hits++;
        }
      } catch {
        // Ignore L2 parse errors
      }
    }

    if (!node) {
      this.stats.misses++;
      return { data: null, stale: false };
    }

    const isExpired = Date.now() - node.timestamp > node.ttl;

    if (isExpired) {
      this.stats.expirations++;
      if (allowStale) {
        // Trả về data cũ (stale) để UI hiển thị nhanh, trong khi fetch background
        return { data: node.value, stale: true };
      }
      this.delete(key);
      this.stats.misses++;
      return { data: null, stale: false };
    }

    this.moveToFront(node);
    node.hits++;
    if (!fromL2) this.stats.hits++;
    return { data: node.value, stale: false };
  }

  set(key: string, value: T, ttl: number, customTimestamp?: number): void {
    const timestamp = customTimestamp || Date.now();
    
    if (this.map.has(key)) {
      const node    = this.map.get(key)!;
      node.value    = value;
      node.timestamp = timestamp;
      node.ttl      = ttl;
      this.moveToFront(node);
    } else {
      if (this.map.size >= this.capacity) {
        const lruNode = this.tail.prev!;
        if (lruNode !== this.head) {
          this.delete(lruNode.key);
          this.stats.evictions++;
        }
      }

      const newNode: CacheNode<T> = {
        key, value,
        timestamp,
        ttl, hits: 0,
        prev: null, next: null,
      };
      this.map.set(key, newNode);
      this.insertAfterHead(newNode);
    }

    // Persist to L2 safely
    try {
      localStorage.setItem(L2_CACHE_PREFIX + key, JSON.stringify({ value, ttl, timestamp }));
    } catch (e) {
      // LocalStorage quota exceeded, clear old L2
      this.clearL2();
    }
  }

  delete(key: string): void {
    const node = this.map.get(key);
    if (node) {
      this.removeFromList(node);
      this.map.delete(key);
    }
    localStorage.removeItem(L2_CACHE_PREFIX + key);
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        count++;
      }
    }
    // L2 cleanup
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(L2_CACHE_PREFIX + prefix)) {
        localStorage.removeItem(k);
      }
    }
    return count;
  }

  private clearL2(): void {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(L2_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

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
    const total    = this.stats.hits + this.stats.misses + this.stats.l2_hits;
    const hitRate  = total > 0 ? (((this.stats.hits + this.stats.l2_hits) / total) * 100).toFixed(1) : '0';
    return { ...this.stats, hitRate: `${hitRate}%`, size: this.map.size, capacity: this.capacity };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.map.clear();
  }
}

export const cache = new LRUCache(400);

// ============================================================
// HELPER: fetchWithCache sử dụng Stale-While-Revalidate
// ============================================================
export async function fetchWithCache<T>(
  key:     string,
  fetcher: () => Promise<T>,
  ttl:     number = TTL.CATEGORY_LIST
): Promise<T> {
  // Allow stale reads. If stale, we return it immediately and re-fetch in the background.
  const { data: cached, stale } = cache.get(key, true);
  
  if (cached !== null && !stale) {
    return cached as T;
  }

  const fetchPromise = fetcher().then(data => {
    cache.set(key, data, ttl);
    return data;
  }).catch(err => {
    // If background refresh fails but we have stale data, it's fine.
    if (cached !== null) {
      console.warn(`[SWR] Background refresh failed for ${key}, using stale data`, err);
      return cached as T;
    }
    throw err;
  });

  if (stale && cached !== null) {
    // SWR: Return stale immediately, update cache in background
    return cached as T;
  }

  return fetchPromise;
}

export const invalidate = {
  movie: (slug: string) => {
    cache.invalidateByPrefix(`movie:${slug}`);
    cache.invalidateByPrefix(`tmdb:${slug}`);
  },
  newUpdated: () => {
    cache.invalidateByPrefix('new-updated');
  },
  allTmdb: () => {
    cache.invalidateByPrefix('tmdb:');
  },
};

if ((import.meta as any).env.DEV) {
  setInterval(() => console.table(cache.getStats()), 30_000);
}
