import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { flags } from '../config.js';
import { admin } from '../db/supabase.js';
import { makeStore } from '../db/store.js';

/**
 * Authentication.
 *
 * Production: the frontend sends the Supabase session JWT as a Bearer token; we
 * verify it with `admin.auth.getUser(token)`, which cryptographically validates
 * the token against the project and returns the user. We never trust a user id
 * from the request body — only what the verified token says.
 *
 * Dev (no Supabase): magic-link email delivery isn't available, so we mint a
 * self-describing dev token (`dev.<base64 payload>`) in the auth route and
 * decode it here. This is INSECURE by construction and only ever runs when
 * Supabase is unconfigured — it exists so the app is fully demoable offline.
 */

const DEV_PREFIX = 'dev.';

export function encodeDevToken(user) {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  return DEV_PREFIX + payload;
}

function decodeDevToken(token) {
  try {
    const json = Buffer.from(token.slice(DEV_PREFIX.length), 'base64url').toString('utf8');
    const u = JSON.parse(json);
    if (!u?.id) return null;
    return u;
  } catch {
    return null;
  }
}

/** Resolve the bearer token to a user, or null. Does not send a response. */
export async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  if (flags.supabaseEnabled) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    return {
      id: u.id,
      email: u.email ?? null,
      name: u.user_metadata?.display_name || (u.email ? u.email.split('@')[0] : 'Athlete'),
      lang: u.user_metadata?.lang || 'en',
      token,
    };
  }

  if (token.startsWith(DEV_PREFIX)) {
    const u = decodeDevToken(token);
    return u ? { ...u, token } : null;
  }
  return null;
}

/**
 * Hard gate: 401 if not authenticated. Attaches req.user and req.db.
 *
 * The try/catch matters: this runs on every protected request and calls out to
 * Supabase to verify the token. A transient network error to Supabase would
 * otherwise reject this async middleware and crash the process. We fail the one
 * request with a 401, and the server stays up.
 */
export async function requireAuth(req, res, next) {
  let user;
  try {
    user = await resolveUser(req);
  } catch (err) {
    console.error('[auth] token verification failed:', err.message);
    return res.status(401).json({ error: 'Could not verify your session. Please sign in again.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  req.user = user;
  req.db = makeStore(user);
  next();
}

/** Soft gate: attaches req.user/req.db if present, but never blocks. */
export async function optionalAuth(req, _res, next) {
  try {
    const user = await resolveUser(req);
    if (user) {
      req.user = user;
      req.db = makeStore(user);
    }
  } catch (err) {
    // Optional auth never blocks — a verification hiccup just means "guest".
    console.error('[auth] optional verification failed:', err.message);
  }
  next();
}

/** Create a fresh dev user (used by the dev sign-in route). */
export function makeDevUser({ email, displayName, lang = 'en' }) {
  return {
    id: randomUUID(),
    email: email ?? null,
    name: displayName || (email ? email.split('@')[0] : 'Athlete'),
    lang,
  };
}
