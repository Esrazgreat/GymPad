/**
 * Tiny localStorage cache for a stale-while-revalidate render.
 *
 * Screens read the last-known value synchronously (instant paint on refresh),
 * then fetch fresh data and overwrite. On a cold free-tier backend this is the
 * difference between "my stats are here, updating…" and "blank zeros for 30s".
 *
 * Cleared on sign-out so a shared device never shows the previous user's data.
 */

const PREFIX = 'gympad.cache.';

export function cacheGet(key) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — the cache is a nicety, never required */
  }
}

/** Wipe every cached value (call on sign-out). Also clears the plan cache. */
export function cacheClearAll() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith(PREFIX) || k === 'gympad.plan.cache')) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
