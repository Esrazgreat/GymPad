/**
 * A tiny in-process rate limiter.
 *
 * The AI endpoints cost real money per call, so they must be bounded even on a
 * free tier — an unbounded coach chat on a public URL is an open invitation to
 * burn the API budget. This is a fixed-window counter keyed by user id (falling
 * back to IP for unauthenticated callers).
 *
 * Deliberately in-memory: it resets on restart and doesn't share state across
 * instances. That's fine for a single free-tier dyno; a multi-instance
 * deployment would move this to Redis (documented in the README).
 */

const buckets = new Map(); // key -> { count, resetAt }

export function rateLimit({ windowMs = 60_000, max = 30, name = 'default' } = {}) {
  return (req, res, next) => {
    const id = req.user?.id || req.ip || 'anon';
    const key = `${name}:${id}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'You are sending requests a little too fast. Take a breath and try again shortly.',
        retryAfter,
      });
    }
    next();
  };
}

// Periodically evict stale buckets so the Map can't grow without bound.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
}, 300_000);
sweep.unref?.();
