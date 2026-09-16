// Client-side feed caching utility
const CACHE_KEY_PREFIX = 'thrivein_feed_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCachedFeed<T>(userId: string): T | null {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - entry.timestamp < CACHE_DURATION) {
      console.log('[FeedCache] Using cached feed');
      return entry.data;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('[FeedCache] Error reading cache:', error);
    return null;
  }
}

export function setCachedFeed<T>(userId: string, data: T): void {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log('[FeedCache] Feed cached successfully');
  } catch (error) {
    console.error('[FeedCache] Error writing cache:', error);
  }
}

export function clearFeedCache(userId: string): void {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    localStorage.removeItem(cacheKey);
    console.log('[FeedCache] Cache cleared');
  } catch (error) {
    console.error('[FeedCache] Error clearing cache:', error);
  }
}
