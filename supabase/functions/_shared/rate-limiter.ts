// Simple in-memory rate limiter for edge functions
// For production, consider using Redis or Supabase table-based approach

interface RateLimitConfig {
  points: number; // Number of requests allowed
  duration: number; // Duration in seconds
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private cache = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  async consume(key: string): Promise<void> {
    const now = Date.now();
    const record = this.cache.get(key);

    // No record or expired - create new
    if (!record || now > record.resetAt) {
      this.cache.set(key, {
        count: 1,
        resetAt: now + (this.config.duration * 1000),
      });
      return;
    }

    // Rate limit exceeded
    if (record.count >= this.config.points) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    // Increment count
    record.count++;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.resetAt) {
        this.cache.delete(key);
      }
    }
  }

  getRemainingTime(key: string): number {
    const record = this.cache.get(key);
    if (!record) return 0;
    const now = Date.now();
    return Math.max(0, Math.ceil((record.resetAt - now) / 1000));
  }
}
