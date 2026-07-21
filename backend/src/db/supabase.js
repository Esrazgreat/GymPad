import { createClient } from '@supabase/supabase-js';
import { config, flags } from '../config.js';

/**
 * Supabase clients.
 *
 * Two distinct clients, for two distinct trust levels:
 *
 *  • `admin` uses the service-role key and BYPASSES row-level security. It is
 *    used only to verify a JWT (`auth.getUser`) and for the signup trigger's
 *    territory. It must never be handed a user-supplied filter and trusted.
 *
 *  • `forUser(token)` builds a per-request client authenticated AS the user, by
 *    forwarding their JWT. Every query it runs is subject to the RLS policies in
 *    schema.sql, so it is *structurally impossible* for it to read another
 *    user's rows even if a route forgot a `.eq('user_id', ...)`. This is the
 *    belt-and-suspenders that makes the data layer safe by construction.
 *
 * Both are null when Supabase isn't configured — callers gate on `flags`.
 */

export const admin = flags.supabaseEnabled
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export function forUser(accessToken) {
  if (!flags.supabaseEnabled) return null;
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
