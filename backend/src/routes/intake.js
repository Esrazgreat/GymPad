import { Router } from 'express';
import { asyncHandler } from '../util/http.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { analyzeIntake } from '../services/intakeAnalyzer.js';

/**
 * POST /api/intake/analyze
 *
 * The one endpoint that can tell someone not to train. It:
 *   1. validates the submission,
 *   2. runs the layered safety screening (see intakeAnalyzer),
 *   3. persists the intake WITH its clearance verdict, and
 *   4. only creates a plan when clearance is not "defer".
 *
 * A deferred user gets a 200 with `clearance: 'defer'` and no plan — never an
 * error, because being told to see a doctor first is a legitimate outcome, not
 * a failure.
 */

export const intakeRouter = Router();

const GOALS = new Set(['loss', 'build']);
const DURATIONS = new Set([1, 4, 12, 26, 52]);
const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const SEXES = new Set(['male', 'female', 'prefer_not']);
const CONDITIONS = new Set([
  'heart', 'diabetes', 'asthma', 'joint', 'osteoporosis',
  'epilepsy', 'surgery', 'pregnancy', 'obesity', 'other',
]);
const EQUIPMENT = new Set([
  'barbell', 'dumbbells', 'cables', 'smith', 'legpress',
  'pullup', 'bands', 'bodyweight', 'bench', 'kettlebell',
]);

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const filterSet = (arr, allowed) =>
  Array.isArray(arr) ? [...new Set(arr.filter((x) => allowed.has(x)))] : [];

function validate(body) {
  const errors = {};
  const goal = body.goal;
  const durationWeeks = Number(body.duration_weeks);

  if (!GOALS.has(goal)) errors.goal = 'Choose weight loss or muscle building.';
  if (!DURATIONS.has(durationWeeks)) errors.duration_weeks = 'Choose a valid plan length.';

  const age = num(body.age);
  if (age !== null && (age < 13 || age > 90)) errors.age = 'Age must be between 13 and 90.';

  const weight = num(body.weight_kg);
  if (weight !== null && (weight < 25 || weight > 400)) errors.weight_kg = 'Enter a realistic weight in kg.';

  const height = num(body.height_cm);
  if (height !== null && (height < 100 || height > 250)) errors.height_cm = 'Enter a realistic height in cm.';

  const sessions = num(body.sessions_per_week);
  if (sessions !== null && (sessions < 2 || sessions > 6)) {
    errors.sessions_per_week = 'Choose between 2 and 6 days a week.';
  }

  if (Object.keys(errors).length) return { errors };

  return {
    intake: {
      goal,
      duration_weeks: durationWeeks,
      age,
      weight_kg: weight,
      height_cm: height,
      biological_sex: SEXES.has(body.biological_sex) ? body.biological_sex : 'prefer_not',
      fitness_level: LEVELS.has(body.fitness_level) ? body.fitness_level : 'beginner',
      conditions: filterSet(body.conditions, CONDITIONS),
      medications: str(body.medications, 1000),
      injuries: str(body.injuries, 1000),
      available_equipment: filterSet(body.available_equipment, EQUIPMENT),
      sessions_per_week: sessions ?? 3,
      session_duration_min: [30, 45, 60, 90].includes(Number(body.session_duration_min))
        ? Number(body.session_duration_min)
        : 45,
      additional_notes: str(body.additional_notes, 1000),
    },
  };
}

intakeRouter.post(
  '/analyze',
  requireAuth,
  // Plan generation is the most expensive AI call in the app — bound it hard.
  rateLimit({ name: 'intake', max: 6, windowMs: 15 * 60_000 }),
  asyncHandler(async (req, res) => {
    const { errors, intake } = validate(req.body ?? {});
    if (errors) return res.status(400).json({ error: 'Please check your answers.', fields: errors });

    let analysis;
    try {
      analysis = await analyzeIntake(intake);
    } catch (err) {
      console.error('[intake] analysis failed:', err);
      return res.status(503).json({
        error: 'We could not review your answers just now. Please try again in a moment.',
      });
    }

    // Persist the intake together with the verdict, so the decision is auditable.
    const savedIntake = await req.db.createIntake({
      ...intake,
      ai_clearance: analysis.clearance,
      ai_clearance_notes: JSON.stringify(analysis.clearanceNotes),
      bmi: analysis.bmi,
      bmi_category: analysis.bmiCategory ? JSON.stringify(analysis.bmiCategory) : null,
    });

    // Hard rule: a deferred user gets no plan. Enforced here as well as in the
    // analyzer, because this is the layer that actually writes one.
    if (analysis.clearance === 'defer') {
      return res.json({
        intakeId: savedIntake.id,
        planId: null,
        clearance: 'defer',
        clearanceNotes: analysis.clearanceNotes,
        bmi: analysis.bmi,
        bmiCategory: analysis.bmiCategory,
        plan: null,
      });
    }

    await req.db.deactivatePlans();
    const plan = await req.db.createPlan({
      intake_id: savedIntake.id,
      goal: intake.goal,
      duration_weeks: intake.duration_weeks,
      recommended_split: analysis.recommendedSplit,
      phases: analysis.phases,
      is_active: true,
    });

    res.json({
      intakeId: savedIntake.id,
      planId: plan.id,
      clearance: analysis.clearance,
      clearanceNotes: analysis.clearanceNotes,
      bmi: analysis.bmi,
      bmiCategory: analysis.bmiCategory,
      generatedBy: analysis.source,
      plan,
    });
  }),
);
