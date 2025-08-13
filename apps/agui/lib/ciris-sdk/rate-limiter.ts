// CIRIS TypeScript SDK - Rate Limiter
// Adaptive rate limiting based on server headers

import { RateLimitInfo } from './types';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private globalLimit: number = 100;
  private globalRemaining: number = 100;
  private globalReset: number = Date.now() / 1000;
  private windowMs: number = 60000; // 1 minute default

  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseDelayMs: number = 1000
  ) {}

  /**
   * Check if a request can be made
   */
  async checkLimit(endpoint: string): Promise<boolean> {
    const now = Date.now() / 1000;

    // Check global limit
    if (this.globalRemaining <= 0 && now < this.globalReset) {
      return false;
    }

    // Check endpoint-specific limit
    const bucket = this.getBucket(endpoint);
    if (bucket.tokens <= 0) {
      const timeSinceRefill = now - bucket.lastRefill;
      const refillRate = this.windowMs / 1000; // tokens per second
      const tokensToAdd = Math.floor(timeSinceRefill * refillRate);

      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.globalLimit);
        bucket.lastRefill = now;
      }
    }

    return bucket.tokens > 0;
  }

  /**
   * Consume a token for the endpoint
   */
  consumeToken(endpoint: string): void {
    const bucket = this.getBucket(endpoint);
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    this.globalRemaining = Math.max(0, this.globalRemaining - 1);
  }

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers: Headers | Record<string, string>): void {
    const getHeader = (name: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(name);
      }
      return headers[name] || null;
    };

    const limit = getHeader('X-RateLimit-Limit');
    const remaining = getHeader('X-RateLimit-Remaining');
    const reset = getHeader('X-RateLimit-Reset');
    const window = getHeader('X-RateLimit-Window');

    if (limit) {
      this.globalLimit = parseInt(limit, 10);
    }
    if (remaining) {
      this.globalRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.globalReset = parseInt(reset, 10);
    }
    if (window) {
      // Window format: "1m", "5m", "1h", etc.
      this.windowMs = this.parseWindow(window);
    }
  }

  /**
   * Get current rate limit info
   */
  getInfo(): RateLimitInfo {
    return {
      limit: this.globalLimit,
      remaining: this.globalRemaining,
      reset: this.globalReset,
      window: `${this.windowMs / 1000}s`
    };
  }

  /**
   * Calculate delay for retry after rate limit hit
   */
  getRetryDelay(attempt: number): number {
    const now = Date.now() / 1000;
    const timeUntilReset = Math.max(0, this.globalReset - now);

    // Exponential backoff with jitter
    const backoff = this.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * backoff;

    // Use the longer of: time until reset or backoff delay
    return Math.max(timeUntilReset * 1000, backoff + jitter);
  }

  private getBucket(endpoint: string): BucketState {
    if (!this.buckets.has(endpoint)) {
      this.buckets.set(endpoint, {
        tokens: this.globalLimit,
        lastRefill: Date.now() / 1000
      });
    }
    return this.buckets.get(endpoint)!;
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smh])$/);
    if (!match) {
      return 60000; // Default to 1 minute
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }
}
