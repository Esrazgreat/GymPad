import { createClient } from '@supabase/supabase-js';

/**
 * Supabase browser client.
 *
 * Only the ANON key ever appears here — it is public by design and safe to ship,
 * because row-level security is what actually protects the data. The
 * service-role key must never appear in frontend code or a VITE_ variable; it
 * would be readable by every visitor.
 *
 * `null` when unconfigured, which switches the app to the backend's local dev
 * sign-in so it still runs with no Supabase project.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The magic link lands back on the app with the session in the URL.
        detectSessionInUrl: true,
      },
    })
  : null;

/** Send a magic link. Supabase creates the user on first click. */
export async function sendMagicLink(email, displayName) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      data: displayName ? { display_name: displayName } : undefined,
    },
  });
  if (error) throw error;
}

export async function getSessionToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
