import express from 'express';
import cors from 'cors';
import { config, flags, logStartupBanner } from './config.js';
import { authRouter } from './routes/auth.js';
import { intakeRouter } from './routes/intake.js';
import { planRouter } from './routes/plan.js';
import { sessionRouter } from './routes/session.js';
import { progressRouter } from './routes/progress.js';
import { coachRouter } from './routes/coach.js';
import { EXERCISES } from './services/exercises.js';

// ─── Last-resort process guards ──────────────────────────────────────────────
//
// The belt to asyncHandler's braces. If anything still slips through — a stray
// rejection in a library, an event-emitter error — we log it and KEEP RUNNING.
// A web server surviving a single unexpected error is far better than it
// crash-looping on a free-tier host, taking every user down each time. The app
// holds no critical in-memory state, so staying up is always the right call.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();

// Render (and most PaaS) sit behind a proxy; without this `req.ip` is the
// proxy's address and the rate limiter would bucket every user together.
app.set('trust proxy', 1);

// CORS allow-list. We accept the explicitly-configured frontend URL, local dev,
// and any *.vercel.app deployment of this app. The Vercel pattern is what avoids
// the classic deploy deadlock — the frontend and backend would otherwise each
// need the other's URL before either could be deployed. Auth is a Bearer token
// (not a cookie), so trusting Vercel's origin here carries no CSRF risk.
const staticOrigins = new Set([
  config.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = a non-browser caller (curl, uptime pings, health
      // checks). Always allow those; CORS only governs browsers.
      if (!origin) return callback(null, true);
      if (staticOrigins.has(origin)) return callback(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '256kb' }));

// ─── Public ─────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabase: flags.supabaseEnabled,
    ai: flags.anthropicEnabled,
    uptime: Math.round(process.uptime()),
  });
});

/**
 * The exercise catalog is public on purpose — guest mode lets people browse the
 * library and watch the demos before creating an account. Only personalised
 * data requires a session.
 */
app.get('/api/exercises', (_req, res) => {
  res.json({ exercises: EXERCISES });
});

// ─── Feature routes ─────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/intake', intakeRouter);
app.use('/api/plan', planRouter);
app.use('/api/session', sessionRouter);
app.use('/api/progress', progressRouter);
app.use('/api/coach', coachRouter);

// ─── Errors ─────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Express needs the 4-arg signature to recognise this as an error handler.
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  if (res.headersSent) return res.end();
  res.status(500).json({
    error: 'Something went wrong on our side. Please try again.',
    ...(config.nodeEnv !== 'production' ? { detail: err.message } : {}),
  });
});

const server = app.listen(config.port, () => {
  logStartupBanner();
  console.log(`  Listening on http://localhost:${config.port}`);
  console.log(`  CORS origin:  ${config.frontendUrl}\n`);
});

// Free-tier hosts send SIGTERM on redeploy/sleep; close cleanly so in-flight
// SSE streams aren't cut mid-message.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`\n${signal} received — shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

export default app;
