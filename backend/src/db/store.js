import { randomUUID } from 'node:crypto';
import { flags } from '../config.js';
import { forUser } from './supabase.js';

/**
 * The data access layer.
 *
 * Routes never touch Supabase directly — they call `req.db`, a per-request store
 * bound to the authenticated user. There are two interchangeable implementations
 * behind one interface:
 *
 *   • Supabase-backed (production): every call runs through a user-scoped client,
 *     so RLS enforces isolation.
 *   • In-memory (local dev with no Supabase): a plain Map, wiped on restart.
 *
 * Keeping this behind one interface is what lets the whole app run offline and
 * keeps every route free of `if (supabaseEnabled)` branching.
 */

export function makeStore(user) {
  return flags.supabaseEnabled ? supabaseStore(user) : memoryStore(user);
}

// ─── Supabase implementation ─────────────────────────────────────────────────

function supabaseStore(user) {
  const sb = forUser(user.token);
  const own = (q) => q; // RLS already scopes to auth.uid(); explicit filters are belt-and-suspenders below

  return {
    async getProfile() {
      const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async upsertProfile(patch) {
      const { data, error } = await sb
        .from('profiles')
        .upsert({ id: user.id, ...patch })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async createIntake(intake) {
      const { data, error } = await sb
        .from('intakes')
        .insert({ ...intake, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateIntake(id, patch) {
      const { data, error } = await own(sb.from('intakes').update(patch).eq('id', id).eq('user_id', user.id))
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getLatestIntake() {
      const { data, error } = await sb
        .from('intakes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async deactivatePlans() {
      await sb.from('plans').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true);
    },

    async createPlan(plan) {
      const { data, error } = await sb
        .from('plans')
        .insert({ ...plan, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getActivePlan() {
      const { data, error } = await sb
        .from('plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async logSession(session) {
      const { data, error } = await sb
        .from('sessions')
        .insert({ ...session, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getSessions({ sinceDays } = {}) {
      let q = sb.from('sessions').select('*').eq('user_id', user.id).order('logged_at', { ascending: false });
      if (sinceDays) {
        const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
        q = q.gte('logged_at', since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  };
}

// ─── In-memory implementation (dev only) ─────────────────────────────────────
//
// One shared module-level store so every request in the process sees the same
// data. Keyed by user id; there is no cross-user access path because each store
// instance only ever reads its own user's bucket.

const mem = {
  profiles: new Map(), // userId -> profile
  intakes: new Map(), // userId -> [intake]
  plans: new Map(), // userId -> [plan]
  sessions: new Map(), // userId -> [session]
};

const bucket = (map, userId) => {
  if (!map.has(userId)) map.set(userId, []);
  return map.get(userId);
};

function memoryStore(user) {
  const uid = user.id;
  const now = () => new Date().toISOString();

  return {
    async getProfile() {
      return mem.profiles.get(uid) ?? null;
    },
    async upsertProfile(patch) {
      const merged = { id: uid, lang: 'en', ...(mem.profiles.get(uid) ?? {}), ...patch };
      mem.profiles.set(uid, merged);
      return merged;
    },
    async createIntake(intake) {
      const row = { id: randomUUID(), user_id: uid, created_at: now(), ...intake };
      bucket(mem.intakes, uid).unshift(row);
      return row;
    },
    async updateIntake(id, patch) {
      const list = bucket(mem.intakes, uid);
      const row = list.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
      return row;
    },
    async getLatestIntake() {
      return bucket(mem.intakes, uid)[0] ?? null;
    },
    async deactivatePlans() {
      for (const p of bucket(mem.plans, uid)) p.is_active = false;
    },
    async createPlan(plan) {
      const row = { id: randomUUID(), user_id: uid, created_at: now(), is_active: true, ...plan };
      bucket(mem.plans, uid).unshift(row);
      return row;
    },
    async getActivePlan() {
      return bucket(mem.plans, uid).find((p) => p.is_active) ?? null;
    },
    async logSession(session) {
      const row = { id: randomUUID(), user_id: uid, logged_at: now(), ...session };
      bucket(mem.sessions, uid).unshift(row);
      return row;
    },
    async getSessions({ sinceDays } = {}) {
      const list = bucket(mem.sessions, uid);
      if (!sinceDays) return list;
      const cutoff = Date.now() - sinceDays * 86_400_000;
      return list.filter((s) => new Date(s.logged_at).getTime() >= cutoff);
    },
  };
}
