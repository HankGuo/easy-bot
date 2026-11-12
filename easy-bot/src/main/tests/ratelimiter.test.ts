import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { RateLimiter } from '../core/rate-limiter.js';

describe('Unit Test: RateLimiter Token Bucket & DDoS Defense', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it('9.1 should allow initial request and calculate remaining quota', () => {
    const res = limiter.check('192.168.1.100', 5, 60000);
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 4);
    assert.equal(res.retryAfterSeconds, 0);
  });

  it('9.2 should correctly track and decrement quota on repeated calls', () => {
    limiter.check('user_alice', 3, 60000); // 2 remaining
    const second = limiter.check('user_alice', 3, 60000); // 1 remaining
    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 1);

    const third = limiter.check('user_alice', 3, 60000); // 0 remaining
    assert.equal(third.allowed, true);
    assert.equal(third.remaining, 0);
  });

  it('9.3 should reject requests when limit is exceeded and return retryAfterSeconds', () => {
    for (let i = 0; i < 3; i++) {
      limiter.check('ip_attack', 3, 10000);
    }

    const blocked = limiter.check('ip_attack', 3, 10000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 10);
  });

  it('9.4 should isolate rate limits between different keys independently', () => {
    for (let i = 0; i < 3; i++) {
      limiter.check('user_bad', 3, 60000);
    }

    assert.equal(limiter.check('user_bad', 3, 60000).allowed, false);
    // user_good should be unaffected
    assert.equal(limiter.check('user_good', 3, 60000).allowed, true);
  });

  it('9.5 should reset rate limit on explicit reset(key)', () => {
    for (let i = 0; i < 3; i++) {
      limiter.check('user_locked', 3, 60000);
    }
    assert.equal(limiter.check('user_locked', 3, 60000).allowed, false);

    limiter.reset('user_locked');
    const fresh = limiter.check('user_locked', 3, 60000);
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.remaining, 2);
  });

  it('9.6 should clean up expired rate limit entries on cleanup()', async () => {
    limiter.check('temp_key', 2, 50); // 50ms window
    await new Promise(r => setTimeout(r, 60));

    limiter.cleanup();
    const res = limiter.check('temp_key', 2, 50);
    assert.equal(res.remaining, 1); // Reset to full capacity
  });
});
