import { Router } from 'express';
import { flags } from '../config.js';
import { encodeDevToken, makeDevUser, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

/**
 * Auth routes.
 *
 * In production, the frontend talks to Supabase Auth directly for magic-link
 * sign-in — the backend never sees an email or handles a credential. These
 * routes exist for two things the client can't do alone:
 *
 *   • `/api/auth/me`      — profile read/write behind a verified token.
 *   • `/api/auth/dev`     — a local-only shortcut that mints a fake session so
 *                           the app is usable with no Supabase project. It is
 *                           hard-disabled whenever Supabase IS configured, so it
 *                           can never become a production bypass.
 */

export const authRouter = Router();

authRouter.get('/config', (_req, res) => {
  res.json({
    supabaseEnabled: flags.supabaseEnabled,
    aiEnabled: flags.anthropicEnabled,
    // The frontend uses this to decide between the magic-link form and the
    // dev sign-in button.
    authMode: flags.supabaseEnabled ? 'magic_link' : 'dev',
  });
});

authRouter.post('/dev', rateLimit({ name: 'auth-dev', max: 20, windowMs: 60_000 }), (req, res) => {
  if (flags.supabaseEnabled) {
    return res.status(404).json({ error: 'Not available — this deployment uses Supabase Auth.' });
  }
  const { email, displayName, lang } = req.body ?? {};
  const user = makeDevUser({ email, displayName, lang });
  res.json({
    token: encodeDevToken(user),
    user: { id: user.id, email: user.email, name: user.name, lang: user.lang },
    notice: 'Development session — data lives in memory and is lost on restart.',
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const profile = await req.db.getProfile();
  res.json({
    user: { id: req.user.id, email: req.user.email, name: req.user.name },
    profile: profile ?? { id: req.user.id, display_name: req.user.name, lang: req.user.lang ?? 'en' },
  });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const { display_name, lang } = req.body ?? {};
  const patch = {};
  if (typeof display_name === 'string' && display_name.trim()) {
    patch.display_name = display_name.trim().slice(0, 80);
  }
  if (lang === 'en' || lang === 'am') patch.lang = lang;
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });

  const profile = await req.db.upsertProfile(patch);
  res.json({ profile });
});
