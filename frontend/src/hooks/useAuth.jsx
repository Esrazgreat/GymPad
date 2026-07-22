import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setTokenGetter } from '../lib/api.js';
import { cacheClearAll } from '../lib/cache.js';
import { getSessionToken, sendMagicLink, signOut as sbSignOut, supabase, supabaseEnabled } from '../lib/supabase.js';

/**
 * Authentication state.
 *
 * Presents ONE interface over two very different backends:
 *
 *  • Supabase magic link (production) — the session lives in Supabase's own
 *    storage and refreshes itself; we just read the access token on demand.
 *  • Local dev token (no Supabase configured) — the backend mints a token we
 *    keep in localStorage.
 *
 * Screens never branch on which is active; they read `user` and call
 * `signIn`/`signOut`. Only the sign-in screen cares, via `mode`.
 */

const DEV_TOKEN_KEY = 'gympad.devToken';
const AuthContext = createContext(null);

/** Map a Supabase session's user to our shape — pure, no network. */
function userFromSession(session) {
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.user_metadata?.display_name || (u.email ? u.email.split('@')[0] : 'Athlete'),
    lang: u.user_metadata?.lang || 'en',
  };
}

/** A good-enough profile to render immediately; the real one loads behind it. */
function optimisticProfile(session) {
  const u = userFromSession(session);
  return { id: u.id, display_name: u.name, lang: u.lang };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState(null);

  // Held in a ref so `setTokenGetter` reads the freshest value without needing
  // to be re-registered on every render.
  const devTokenRef = useRef(
    typeof window !== 'undefined' ? window.localStorage.getItem(DEV_TOKEN_KEY) : null,
  );

  // Register the token source with the API client exactly once.
  useEffect(() => {
    setTokenGetter(async () => (supabaseEnabled ? await getSessionToken() : devTokenRef.current));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const { user: u, profile: p } = await api.me();
      setUser(u);
      setProfile(p);
      return true;
    } catch {
      setUser(null);
      setProfile(null);
      return false;
    }
  }, []);

  // Boot: restore an existing session if there is one.
  //
  // Speed matters here more than anywhere else — this runs on every page load
  // and refresh. The key move is OPTIMISTIC restore: the Supabase session lives
  // in localStorage, so we can read it and render the authenticated app in a few
  // milliseconds, then refine the full profile from the backend in the
  // background. Previously we awaited `api.me()` before rendering, so a cold
  // free-tier backend meant a 30–60s full-screen spinner on every refresh.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (supabaseEnabled) {
        const { data } = await supabase.auth.getSession(); // localStorage read, no network
        if (!cancelled && data?.session) {
          setUser(userFromSession(data.session));
          setProfile(optimisticProfile(data.session));
          loadProfile(); // background refine — deliberately not awaited
        }
      } else if (devTokenRef.current) {
        // Dev only (never runs in production). Verify in the background; clear a
        // stale token if the in-memory server was restarted.
        loadProfile().then((ok) => {
          if (!ok && !cancelled) {
            devTokenRef.current = null;
            window.localStorage.removeItem(DEV_TOKEN_KEY);
          }
        });
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // Supabase drives sign-in/out from the magic-link redirect, so react to it.
  useEffect(() => {
    if (!supabaseEnabled) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadProfile();
        setMagicLinkSentTo(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithEmail = useCallback(async (email, displayName) => {
    await sendMagicLink(email, displayName);
    setMagicLinkSentTo(email);
  }, []);

  const signInDev = useCallback(
    async ({ displayName, lang }) => {
      const { token } = await api.devSignIn({ displayName, lang });
      devTokenRef.current = token;
      window.localStorage.setItem(DEV_TOKEN_KEY, token);
      await loadProfile();
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    if (supabaseEnabled) {
      await sbSignOut();
    } else {
      devTokenRef.current = null;
      window.localStorage.removeItem(DEV_TOKEN_KEY);
    }
    cacheClearAll(); // don't leave one user's plan/stats for the next on a shared device
    setUser(null);
    setProfile(null);
    setMagicLinkSentTo(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const { profile: p } = await api.updateMe(patch);
    setProfile(p);
    return p;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isSignedIn: Boolean(user),
      mode: supabaseEnabled ? 'magic_link' : 'dev',
      magicLinkSentTo,
      signInWithEmail,
      signInDev,
      signOut,
      updateProfile,
      refresh: loadProfile,
    }),
    [user, profile, loading, magicLinkSentTo, signInWithEmail, signInDev, signOut, updateProfile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
