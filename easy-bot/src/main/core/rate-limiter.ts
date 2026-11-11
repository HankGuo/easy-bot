export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export class RateLimiter {
  private records: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if a request identified by key is within limits.
   * @param key IP address or user ID
   * @param maxRequests Maximum allowed requests in the time window
   * @param windowMs Time window in milliseconds
   */
  public check(key: string, maxRequests: number, windowMs: number): RateLimitCheckResult {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      this.records.set(key, record);
      return { allowed: true, retryAfterSeconds: 0, remaining: maxRequests - 1 };
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      return { allowed: false, retryAfterSeconds, remaining: 0 };
    }

    record.count++;
    return { allowed: true, retryAfterSeconds: 0, remaining: maxRequests - record.count };
  }

  /**
   * Reset limits for a specific key (e.g. after successful auth)
   */
  public reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Periodic garbage collection of expired entries
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetTime) {
        this.records.delete(key);
      }
    }
  }
}
