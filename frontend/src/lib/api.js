/**
 * API client.
 *
 * One place that knows how to reach the backend, attach the bearer token, and
 * turn a non-2xx response into a useful Error. Every call site gets consistent
 * error shapes, so screens can render field-level validation without each one
 * re-implementing fetch plumbing.
 */

// Strip any stray whitespace/newlines a dashboard paste may have introduced, and
// drop trailing slashes. A URL never legitimately contains whitespace, so this is
// safe and prevents an illegal-header / bad-URL fetch crash from a fat-fingered
// env var. (See the matching guard in supabase.js.)
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\s+/g, '').replace(/\/+$/, '');

/** Set by AuthProvider whenever the session changes. */
let tokenGetter = async () => null;
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(message, { status, fields, retryAfter } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields ?? null;
    this.retryAfter = retryAfter ?? null;
  }
}

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };

  if (auth) {
    const token = await tokenGetter();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Network-level failure — distinct from an API error, and the UI says so.
    throw new ApiError('offline', { status: 0 });
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, {
      status: response.status,
      fields: payload?.fields,
      retryAfter: payload?.retryAfter,
    });
  }
  return payload;
}

export const api = {
  health: () => request('/api/health', { auth: false }),
  authConfig: () => request('/api/auth/config', { auth: false }),
  exercises: () => request('/api/exercises', { auth: false }),

  devSignIn: (payload) => request('/api/auth/dev', { method: 'POST', body: payload, auth: false }),
  me: () => request('/api/auth/me'),
  updateMe: (patch) => request('/api/auth/me', { method: 'PATCH', body: patch }),

  analyzeIntake: (intake) => request('/api/intake/analyze', { method: 'POST', body: intake }),
  activePlan: () => request('/api/plan/active'),
  logSession: (session) => request('/api/session/log', { method: 'POST', body: session }),
  progress: () => request('/api/progress'),
};

/**
 * Coach chat over Server-Sent Events.
 *
 * Uses fetch + a ReadableStream rather than EventSource, because EventSource
 * cannot send a POST body or an Authorization header — both of which we need.
 *
 * @param {object}   opts
 * @param {Array}    opts.messages
 * @param {'en'|'am'} opts.lang
 * @param {Function} opts.onDelta      called with each text chunk
 * @param {Function} [opts.onEmergency] called if the red-flag interceptor fires
 * @param {AbortSignal} [opts.signal]
 */
export async function streamCoach({ messages, lang, onDelta, onEmergency, signal }) {
  const token = await tokenGetter();

  const response = await fetch(`${BASE}/api/coach/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, lang }),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.error || 'Coach unavailable', {
      status: response.status,
      retryAfter: payload?.retryAfter,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. Keep the trailing partial frame
    // in the buffer — splitting mid-frame would corrupt multi-byte Ge'ez text.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (event.type === 'emergency') onEmergency?.();
      else if (event.type === 'delta') {
        full += event.text;
        onDelta?.(event.text, full);
      } else if (event.type === 'error') {
        throw new ApiError(event.message, { status: 500 });
      }
    }
  }
  return full;
}
