import { Router } from 'express';
import { asyncHandler } from '../util/http.js';
import { requireAuth } from '../middleware/auth.js';
import { byId } from '../services/exercises.js';

/**
 * GET /api/progress
 *
 * Everything the Progress screen renders, computed in one pass over the user's
 * sessions. All series are returned newest-last (chart-ready), and every bucket
 * is pre-filled with zeros so the frontend never has to reason about gaps —
 * a week with no training is an explicit 0, not a missing point.
 */

export const progressRouter = Router();

progressRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const sessions = await req.db.getSessions({});
  res.json(computeProgress(sessions));
}));

const DAY_MS = 86_400_000;

/** Local calendar day key — streaks must follow the user's clock, not UTC. */
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function computeProgress(sessions) {
  const now = new Date();
  const trainedDays = new Set(sessions.map((s) => dayKey(s.logged_at)));

  // ── Streak ────────────────────────────────────────────────────────────────
  // A streak survives until a full day is missed: if there's no session today,
  // we start counting from yesterday rather than resetting to zero. Someone who
  // trains every evening shouldn't see "0 days" every morning.
  let streak = 0;
  const cursor = new Date(now);
  if (!trainedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (trainedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ── Last 7 days: minutes per day ─────────────────────────────────────────
  const dailyMins = Array(7).fill(0);
  const dayLabels = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * DAY_MS);
    dayLabels.push({ key: dayKey(d), weekday: d.getDay() });
  }
  const labelIndex = new Map(dayLabels.map((l, i) => [l.key, i]));
  for (const s of sessions) {
    const idx = labelIndex.get(dayKey(s.logged_at));
    if (idx !== undefined) dailyMins[idx] += s.duration_min ?? 0;
  }

  // ── Last 8 weeks: session counts + volume ────────────────────────────────
  const weeklyCounts = Array(8).fill(0);
  const volumeTimeline = Array(8).fill(0);
  const weekLabels = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = new Date(now.getTime() - (i + 1) * 7 * DAY_MS + DAY_MS);
    weekLabels.push(`${start.getMonth() + 1}/${start.getDate()}`);
  }
  for (const s of sessions) {
    const ageDays = (now.getTime() - new Date(s.logged_at).getTime()) / DAY_MS;
    if (ageDays < 0 || ageDays >= 56) continue;
    const bucket = 7 - Math.floor(ageDays / 7);
    if (bucket < 0 || bucket > 7) continue;
    weeklyCounts[bucket] += 1;
    volumeTimeline[bucket] += totalReps(s);
  }

  // ── Muscle-group coverage, last 30 days ──────────────────────────────────
  const coverage = {};
  for (const s of sessions) {
    if ((now.getTime() - new Date(s.logged_at).getTime()) / DAY_MS >= 30) continue;
    for (const item of s.exercises_completed ?? []) {
      const exercise = byId.get(item.id);
      if (!exercise) continue;
      coverage[exercise.muscleGroup] = (coverage[exercise.muscleGroup] ?? 0) + (item.sets_done || 1);
    }
  }
  // Always emit every group so the radar chart keeps a stable shape.
  const ALL_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core', 'full_body'];
  const muscleGroupCoverage = ALL_GROUPS.map((g) => ({ group: g, sets: coverage[g] ?? 0 }));

  // ── Headline stats ───────────────────────────────────────────────────────
  const weekMin = dailyMins.reduce((a, b) => a + b, 0);
  const monthCount = sessions.filter(
    (s) => (now.getTime() - new Date(s.logged_at).getTime()) / DAY_MS < 30,
  ).length;

  return {
    streak,
    weekMin,
    monthCount,
    totalSessions: sessions.length,
    dailyMins,
    dayWeekdays: dayLabels.map((l) => l.weekday),
    weeklyCounts,
    weekLabels,
    volumeTimeline,
    muscleGroupCoverage,
  };
}

/** Volume proxy: sets × reps. Time-based work counts its seconds as "reps". */
function totalReps(session) {
  return (session.exercises_completed ?? []).reduce(
    (sum, e) => sum + (e.sets_done || 0) * (e.reps_or_time || 0),
    0,
  );
}
