import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { byId } from '../services/exercises.js';
import { computeProgress } from './progress.js';

/**
 * POST /api/session/log
 *
 * Records a completed workout and returns the freshly recomputed streak and
 * weekly stats, so the client can show the reward animation without a second
 * round trip.
 */

export const sessionRouter = Router();

sessionRouter.post('/log', requireAuth, async (req, res) => {
  const body = req.body ?? {};

  const durationMin = Number(body.durationMin);
  if (!Number.isFinite(durationMin) || durationMin < 0 || durationMin > 600) {
    return res.status(400).json({ error: 'Session length looks wrong.', fields: { durationMin: 'Enter 0–600 minutes.' } });
  }

  // Only keep entries that reference real exercises — a client bug or a replayed
  // payload must not be able to poison the progress charts with junk ids.
  const completed = Array.isArray(body.exercisesCompleted)
    ? body.exercisesCompleted
        .filter((e) => e && byId.has(e.id))
        .slice(0, 40)
        .map((e) => ({
          id: e.id,
          sets_done: clampInt(e.setsDone ?? e.sets_done, 0, 20),
          reps_or_time: clampInt(e.repsOrTime ?? e.reps_or_time, 0, 3600),
        }))
    : [];

  const session = await req.db.logSession({
    plan_id: body.planId ?? null,
    phase_index: clampInt(body.phaseIndex, 0, 20),
    week_number: clampInt(body.weekNumber, 0, 60),
    day_label: typeof body.dayLabel === 'string' ? body.dayLabel.slice(0, 120) : null,
    duration_min: Math.round(durationMin),
    exercises_completed: completed,
    notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null,
  });

  const sessions = await req.db.getSessions({});
  const progress = computeProgress(sessions);

  res.json({
    session,
    streak: progress.streak,
    weekMin: progress.weekMin,
    monthCount: progress.monthCount,
  });
});

function clampInt(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
