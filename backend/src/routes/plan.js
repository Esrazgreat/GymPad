import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { phaseBreakdown } from '../services/planEngine.js';

/**
 * Plan reads.
 *
 * `GET /api/plan/active` returns the current plan plus a computed "where am I
 * today" pointer. That pointer is derived server-side from the plan's start date
 * rather than stored, so it can never drift out of sync with reality — the
 * client just renders what it's told.
 */

export const planRouter = Router();

planRouter.get('/active', requireAuth, async (req, res) => {
  const plan = await req.db.getActivePlan();
  if (!plan) return res.json({ plan: null, position: null });

  const sessions = await req.db.getSessions({});
  res.json({ plan, position: locate(plan, sessions) });
});

/**
 * Work out which phase / week / day the user is on.
 *
 * Anchored on elapsed calendar time since the plan was created, then nudged by
 * how many sessions they've actually logged this week — so someone who trains
 * ahead of schedule isn't shown a day they already finished.
 */
function locate(plan, sessions) {
  const created = new Date(plan.created_at).getTime();
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - created) / (7 * 86_400_000)));

  const breakdown = plan.phases.map((p) => p.durationWeeks ?? 1);
  let remaining = weeksElapsed;
  let phaseIndex = 0;
  for (let i = 0; i < breakdown.length; i += 1) {
    if (remaining < breakdown[i]) {
      phaseIndex = i;
      break;
    }
    remaining -= breakdown[i];
    phaseIndex = i; // clamp to the final phase once the programme is over
  }

  const phase = plan.phases[phaseIndex];
  const daysInWeek = phase?.weeklySchedule?.length ?? 0;

  // Sessions logged since the start of the current 7-day block.
  const weekStart = created + weeksElapsed * 7 * 86_400_000;
  const doneThisWeek = sessions.filter((s) => new Date(s.logged_at).getTime() >= weekStart).length;

  return {
    phaseIndex,
    phaseNumber: phase?.phaseNumber ?? phaseIndex + 1,
    weekNumber: weeksElapsed + 1,
    weekInPhase: remaining + 1,
    dayIndex: daysInWeek ? Math.min(doneThisWeek, daysInWeek - 1) : 0,
    completedThisWeek: doneThisWeek,
    daysInWeek,
    programmeComplete: weeksElapsed >= breakdown.reduce((a, b) => a + b, 0),
  };
}

/** Handy for the frontend's plan preview before a user commits. */
planRouter.get('/preview/:weeks', (req, res) => {
  const weeks = Number(req.params.weeks);
  if (![1, 4, 12, 26, 52].includes(weeks)) {
    return res.status(400).json({ error: 'Unsupported plan length.' });
  }
  res.json({ weeks, phases: phaseBreakdown(weeks) });
});
