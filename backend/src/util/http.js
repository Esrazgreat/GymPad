/**
 * Async route safety.
 *
 * Express 4 does NOT catch rejected promises from async handlers — a single
 * `await` that throws becomes an unhandledRejection, which crashes the whole
 * Node process. On a free-tier host that means the entire app goes down (and
 * flaps as it restarts) because of one bad request from one user.
 *
 * `asyncHandler` wraps a handler so any rejection is forwarded to Express's
 * error middleware, which returns a clean 500 — the request fails, the server
 * lives. Every async route and middleware is wrapped with it.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
