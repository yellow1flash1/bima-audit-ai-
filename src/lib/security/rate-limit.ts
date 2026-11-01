/**
 * Token bucket: `capacity` scans, refilled evenly over `windowMs`.
 * In production back this with Postgres/Redis so limits hold across edge
 * instances; the in-memory store is for a single node and for tests.
 */
export interface BucketStore {
  get(key: string): { tokens: number; updatedAt: number } | undefined;
  set(key: string, v: { tokens: number; updatedAt: number }): void;
}

export function memoryStore(): BucketStore {
  const m = new Map<string, { tokens: number; updatedAt: number }>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter({
  capacity = 10,
  windowMs = 15 * 60 * 1000,
  store = memoryStore(),
  now = () => Date.now(),
}: { capacity?: number; windowMs?: number; store?: BucketStore; now?: () => number } = {}) {
  const refillPerMs = capacity / windowMs;

  function take(key: string): RateLimitResult {
    const t = now();
    const b = store.get(key) ?? { tokens: capacity, updatedAt: t };
    const tokens = Math.min(capacity, b.tokens + (t - b.updatedAt) * refillPerMs);
    if (tokens < 1) {
      store.set(key, { tokens, updatedAt: t });
      return { allowed: false, remaining: 0, retryAfterMs: Math.ceil((1 - tokens) / refillPerMs) };
    }
    store.set(key, { tokens: tokens - 1, updatedAt: t });
    return { allowed: true, remaining: Math.floor(tokens - 1), retryAfterMs: 0 };
  }

  /** Both the user and the IP must have a token; a denial consumes neither. */
  function check(userId: string, ip: string): RateLimitResult {
    const u = peek(`u:${userId}`);
    const i = peek(`ip:${ip}`);
    if (!u.allowed) return u;
    if (!i.allowed) return i;
    take(`ip:${ip}`);
    return take(`u:${userId}`);
  }

  function peek(key: string): RateLimitResult {
    const t = now();
    const b = store.get(key) ?? { tokens: capacity, updatedAt: t };
    const tokens = Math.min(capacity, b.tokens + (t - b.updatedAt) * refillPerMs);
    return tokens >= 1
      ? { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 }
      : { allowed: false, remaining: 0, retryAfterMs: Math.ceil((1 - tokens) / refillPerMs) };
  }

  return { take, check };
}
