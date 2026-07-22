import 'dotenv/config';

/**
 * Central config + capability flags.
 *
 * The app is designed to *run with nothing configured*. Each external service
 * (Supabase, Anthropic) is optional at boot: when its keys are absent we fall
 * back to a local implementation so a new contributor can `npm run dev` and see
 * the whole flow work before signing up for anything. The flags below are how
 * the rest of the code decides which path to take.
 */

const clean = (v) => (v && v.trim() ? v.trim() : '');

// Defensive extraction of the FIRST clean URL / JWT from an env value.
//
// A dashboard paste can arrive with stray whitespace — or, as actually happened
// on this deploy, the whole value duplicated across several newline-separated
// lines. `clean()` only trims the ends, so an internal newline survives and
// makes an illegal HTTP header value: every user-scoped Supabase call then
// throws "invalid header value" and the request 500s. A URL / JWT never contains
// whitespace, so pulling the first clean occurrence turns that into a self-heal.
const firstUrl = (v) => (v || '').match(/https?:\/\/[^\s"']+/)?.[0]?.replace(/\/+$/, '') ?? '';
const firstJwt = (v) => (v || '').match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0] ?? '';

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: firstUrl(process.env.FRONTEND_URL) || 'http://localhost:5173',

  supabase: {
    url: firstUrl(process.env.SUPABASE_URL),
    anonKey: firstJwt(process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: firstJwt(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  anthropic: {
    apiKey: clean(process.env.ANTHROPIC_API_KEY),
    // Safety-critical screening gets the most capable model — this decision can
    // tell someone NOT to exercise, so it is not the place to cost-optimise.
    screeningModel: clean(process.env.ANTHROPIC_SCREENING_MODEL) || 'claude-opus-4-8',
    // High-volume, lower-stakes paths (chat, plan text) use the cheaper Sonnet
    // tier — near-Opus quality for a fraction of the cost, right for a free app.
    coachModel: clean(process.env.ANTHROPIC_COACH_MODEL) || 'claude-sonnet-5',
  },

  jwtSecret: clean(process.env.JWT_SECRET) || 'dev-only-insecure-secret',
};

export const flags = {
  supabaseEnabled: Boolean(
    config.supabase.url && config.supabase.anonKey && config.supabase.serviceRoleKey,
  ),
  anthropicEnabled: Boolean(config.anthropic.apiKey),
};

export function logStartupBanner() {
  const line = (label, on, detail) =>
    `  ${on ? '✓' : '○'} ${label.padEnd(18)} ${on ? detail : '(not configured — using local fallback)'}`;

  console.log('\n  GymPad API');
  console.log(line('Supabase', flags.supabaseEnabled, config.supabase.url));
  console.log(
    line(
      'Anthropic',
      flags.anthropicEnabled,
      `${config.anthropic.screeningModel} / ${config.anthropic.coachModel}`,
    ),
  );
  if (!flags.supabaseEnabled) {
    console.log('    → auth + data are in-memory; restart wipes them. Set SUPABASE_* for real persistence.');
  }
  if (!flags.anthropicEnabled) {
    console.log('    → AI coach + screening run on the deterministic engine. Set ANTHROPIC_API_KEY for live Claude.');
  }
  console.log('');
}
