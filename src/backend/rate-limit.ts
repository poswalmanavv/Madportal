// Fixed-window rate limiter kept in process memory.
//
// LIMITATION: the counter lives in the Node process, so it is per-instance. On a
// single long-lived server this is a real limit; on multi-instance serverless it only
// throttles bursts that land on the same instance. Move to Redis/Upstash before
// relying on this as the sole defence against a determined attacker.

type Bucket = { count: number; resetAt: number };

const globalWithBuckets = global as typeof globalThis & {
  rateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalWithBuckets.rateLimitBuckets ?? new Map<string, Bucket>();
globalWithBuckets.rateLimitBuckets = buckets;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds };
}

// Best-effort client identity. Behind a proxy/CDN the socket address is the proxy, so
// we prefer the forwarded header. It is spoofable, which is why this is a speed bump
// rather than an authorization control.
export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

// Opportunistic cleanup so the map cannot grow without bound.
export function sweepExpired() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
