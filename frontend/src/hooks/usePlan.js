import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './useAuth.jsx';

/**
 * The user's active plan plus a "where am I today" pointer.
 *
 * The plan is also cached to localStorage. That cache is what makes the app
 * usable in a gym with no signal: `Session` can render today's workout from it
 * even when the network is gone. It is refreshed on every successful fetch.
 */

const CACHE_KEY = 'gympad.plan.cache';

function readCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota or private mode — the cache is a nicety, never required */
  }
}

export function usePlan() {
  const { isSignedIn } = useAuth();
  const [plan, setPlan] = useState(null);
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setPlan(null);
      setPosition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.activePlan();
      setPlan(data.plan);
      setPosition(data.position);
      setFromCache(false);
      if (data.plan) writeCache(data);
    } catch (err) {
      // Fall back to the cached plan rather than showing an error screen — a
      // known-slightly-stale workout beats no workout when you're mid-session.
      const cached = readCache();
      if (cached?.plan) {
        setPlan(cached.plan);
        setPosition(cached.position);
        setFromCache(true);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    load();
  }, [load]);

  return { plan, position, loading, error, fromCache, reload: load };
}

/** Resolve the exact day the user should train right now. */
export function todaysWorkout(plan, position) {
  if (!plan?.phases?.length) return null;
  const phase = plan.phases[Math.min(position?.phaseIndex ?? 0, plan.phases.length - 1)];
  if (!phase?.weeklySchedule?.length) return null;
  const dayIndex = Math.min(position?.dayIndex ?? 0, phase.weeklySchedule.length - 1);
  return { phase, day: phase.weeklySchedule[dayIndex], dayIndex };
}
