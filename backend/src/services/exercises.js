/**
 * Exercise catalog — the planning source of truth.
 *
 * The AI planner and the deterministic fallback planner both choose from this
 * list. Each entry carries just enough to make safe, equipment-aware choices:
 *
 *   • `equipment`  — every item must be satisfiable by the user's kit (a plan
 *                    that prescribes a barbell to someone with none is useless).
 *   • `unsafeFor`  — a COARSE contraindication list. It is a backstop, not the
 *                    real screen: the AI intake analyzer does nuanced screening.
 *                    This list only powers the deterministic fallback and a
 *                    final safety filter that runs over the AI's output too.
 *   • `mode`       — 'reps' (count) vs 'time' (hold/interval), which drives
 *                    whether the live screen shows a tap-counter or a countdown.
 *
 * `id`s are the contract between backend and frontend — the frontend's display
 * library (bilingual names, form cues, 3D animation keys) keys off these exact
 * ids. Keep them in sync.
 *
 * Condition keys (must match the intake form):
 *   heart · diabetes · asthma · joint · osteoporosis · epilepsy · surgery ·
 *   pregnancy · obesity
 */

/** @typedef {'build'|'loss'} Pool */

const B = ['build'];
const L = ['loss'];
/** Available to both programmes — mostly the low-impact, universally safe work. */
const BOTH = ['build', 'loss'];

// Equipment tokens (must match the intake checkboxes).
const EQ = {
  barbell: 'barbell',
  dumbbells: 'dumbbells',
  cables: 'cables',
  smith: 'smith',
  legpress: 'legpress',
  pullup: 'pullup',
  bands: 'bands',
  bodyweight: 'bodyweight',
  bench: 'bench',
  kettlebell: 'kettlebell',
};

// High-impact / plyometric — hard on joints and bones, and a fall risk.
const IMPACT = ['joint', 'osteoporosis', 'surgery', 'pregnancy', 'obesity'];
// Heavy axial spinal loading — risky with uncontrolled BP (Valsalva) and bones.
const AXIAL = ['osteoporosis', 'surgery'];
// Inverted / high-intracranial-pressure or breath-holding positions.
const PRONE_CORE = ['pregnancy', 'surgery'];

export const EXERCISES = [
  // ── Chest ──────────────────────────────────────────────────────────────────
  ex('bench_press', 'chest', [EQ.barbell, EQ.bench], 'intermediate', B, { unsafeFor: ['surgery'] }),
  ex('dumbbell_flyes', 'chest', [EQ.dumbbells, EQ.bench], 'intermediate', B),
  ex('incline_dumbbell_press', 'chest', [EQ.dumbbells, EQ.bench], 'beginner', B),
  ex('cable_crossover', 'chest', [EQ.cables], 'intermediate', B),
  ex('push_up', 'chest', [EQ.bodyweight], 'beginner', B, { unsafeFor: ['surgery'] }),

  // ── Back ─────────────────────────────────────────────────────────────────��─
  ex('deadlift', 'back', [EQ.barbell], 'advanced', B, { unsafeFor: AXIAL.concat('joint') }),
  ex('pull_up', 'back', [EQ.pullup], 'advanced', B),
  ex('lat_pulldown', 'back', [EQ.cables], 'beginner', B),
  ex('barbell_row', 'back', [EQ.barbell], 'intermediate', B, { unsafeFor: AXIAL }),
  ex('seated_cable_row', 'back', [EQ.cables], 'beginner', B),
  ex('single_arm_dumbbell_row', 'back', [EQ.dumbbells, EQ.bench], 'beginner', B),

  // ── Shoulders ────────────────────────────────────────────────────────────��─
  ex('overhead_press', 'shoulders', [EQ.barbell], 'intermediate', B, { unsafeFor: AXIAL }),
  ex('dumbbell_lateral_raise', 'shoulders', [EQ.dumbbells], 'beginner', B),
  ex('front_raise', 'shoulders', [EQ.dumbbells], 'beginner', B),
  ex('face_pull', 'shoulders', [EQ.cables], 'beginner', B),
  ex('arnold_press', 'shoulders', [EQ.dumbbells], 'intermediate', B),

  // ── Biceps ───────────────────────────────────────────────────────────────��─
  ex('barbell_curl', 'biceps', [EQ.barbell], 'beginner', B),
  ex('hammer_curl', 'biceps', [EQ.dumbbells], 'beginner', B),
  ex('concentration_curl', 'biceps', [EQ.dumbbells], 'beginner', B),
  ex('preacher_curl', 'biceps', [EQ.barbell, EQ.bench], 'intermediate', B),

  // ── Triceps ──────────────────────────────────────────────────────────────��─
  ex('close_grip_bench', 'triceps', [EQ.barbell, EQ.bench], 'intermediate', B, { unsafeFor: ['surgery'] }),
  ex('overhead_tricep_extension', 'triceps', [EQ.dumbbells], 'beginner', B),
  ex('tricep_pushdown', 'triceps', [EQ.cables], 'beginner', B),
  ex('skull_crusher', 'triceps', [EQ.barbell, EQ.bench], 'intermediate', B),

  // ── Legs ─────────────────────────────────────────────────────────────────��─
  ex('back_squat', 'legs', [EQ.barbell], 'intermediate', B, { unsafeFor: AXIAL.concat('joint') }),
  ex('romanian_deadlift', 'legs', [EQ.barbell], 'intermediate', B, { unsafeFor: AXIAL }),
  ex('leg_press', 'legs', [EQ.legpress], 'beginner', B),
  ex('leg_curl', 'legs', [EQ.legpress], 'beginner', B),
  ex('leg_extension', 'legs', [EQ.legpress], 'beginner', B),
  ex('walking_lunge', 'legs', [EQ.dumbbells, EQ.bodyweight], 'beginner', B, { unsafeFor: ['joint'] }),
  ex('calf_raise', 'legs', [EQ.bodyweight], 'beginner', B),

  // ── Core ─────────────────────────────────────────────────────────────────��─
  ex('plank', 'core', [EQ.bodyweight], 'beginner', B, { mode: 'time', baseTime: 40 }),
  ex('cable_crunch', 'core', [EQ.cables], 'beginner', B),
  ex('hanging_leg_raise', 'core', [EQ.pullup], 'intermediate', B, { unsafeFor: PRONE_CORE }),
  ex('ab_wheel_rollout', 'core', [EQ.bodyweight], 'advanced', B, { unsafeFor: PRONE_CORE.concat('surgery') }),
  ex('russian_twist', 'core', [EQ.bodyweight], 'beginner', B, { unsafeFor: ['pregnancy'] }),

  // ── Compound ─────────────────────────────────────────────────────────────��─
  ex('power_clean', 'full_body', [EQ.barbell], 'advanced', B, { unsafeFor: AXIAL.concat(['joint', 'heart']) }),
  ex('barbell_thruster', 'full_body', [EQ.barbell], 'intermediate', B, { unsafeFor: AXIAL }),

  // ── Weight-loss / conditioning pool ─────────────────────────────────────────
  ex('jumping_jacks', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 40, unsafeFor: IMPACT }),
  ex('high_knees', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 30, unsafeFor: IMPACT }),
  ex('mountain_climbers', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 30, unsafeFor: IMPACT.concat('surgery') }),
  ex('burpees', 'full_body', [EQ.bodyweight], 'intermediate', L, { mode: 'time', baseTime: 30, unsafeFor: IMPACT.concat(['heart', 'surgery']) }),
  ex('jump_rope', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 45, unsafeFor: IMPACT }),
  ex('box_jump', 'legs', [EQ.bodyweight], 'intermediate', L, { mode: 'reps', baseReps: 10, baseSets: 4, unsafeFor: IMPACT }),
  ex('battle_rope', 'full_body', [EQ.bands], 'beginner', L, { mode: 'time', baseTime: 30 }),
  ex('squat_jump', 'legs', [EQ.bodyweight], 'intermediate', L, { mode: 'reps', baseReps: 12, baseSets: 4, unsafeFor: IMPACT }),
  ex('sprint_intervals', 'full_body', [EQ.bodyweight], 'intermediate', L, { mode: 'time', baseTime: 30, unsafeFor: IMPACT.concat(['heart', 'asthma']) }),
  ex('bicycle_crunch', 'core', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 40, unsafeFor: ['pregnancy'] }),
  ex('kettlebell_swing', 'full_body', [EQ.kettlebell], 'intermediate', L, { mode: 'reps', baseReps: 15, baseSets: 4, unsafeFor: AXIAL.concat('joint') }),

  // ── Low-impact pool ─────────────────────────────────────────────────────────
  //
  // These exist because of a real gap found in testing: every conditioning
  // movement above is high-impact, so a user with joint pain, osteoporosis, a
  // heart condition, or a higher body weight had almost their entire weight-loss
  // pool filtered away — and got a one-exercise "plan".
  //
  // That is precisely backwards. The person least able to jump is often the
  // person who most needs an accessible programme. Everything here is
  // joint-friendly, needs no equipment, and carries an empty `unsafeFor` unless
  // there is a specific reason — so safety filtering can never empty the pool.
  ex('brisk_walk', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 300, baseSets: 1 }),
  ex('march_in_place', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 60 }),
  ex('step_touch', 'full_body', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 60 }),
  ex('standing_knee_lift', 'core', [EQ.bodyweight], 'beginner', L, { mode: 'time', baseTime: 45 }),
  ex('chair_squat', 'legs', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 12 }),
  ex('wall_push_up', 'chest', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 12 }),
  ex('knee_push_up', 'chest', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 10, unsafeFor: ['surgery'] }),
  ex('glute_bridge', 'legs', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 15 }),
  ex('bird_dog', 'core', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 10 }),
  ex('dead_bug', 'core', [EQ.bodyweight], 'beginner', BOTH, { mode: 'reps', baseReps: 12 }),
  ex('seated_band_row', 'back', [EQ.bands], 'beginner', BOTH, { mode: 'reps', baseReps: 15 }),
  ex('band_chest_press', 'chest', [EQ.bands], 'beginner', BOTH, { mode: 'reps', baseReps: 15 }),
  ex('band_lateral_raise', 'shoulders', [EQ.bands], 'beginner', BOTH, { mode: 'reps', baseReps: 15 }),
];

/** Compact constructor with sensible defaults. */
function ex(id, muscleGroup, equipment, difficulty, pools, opts = {}) {
  return {
    id,
    muscleGroup,
    equipment,
    difficulty,
    pools: Array.isArray(pools) ? pools : [pools],
    mode: opts.mode ?? 'reps',
    baseSets: opts.baseSets ?? 3,
    baseReps: opts.baseReps ?? 10,
    baseTime: opts.baseTime ?? 40, // seconds, for time-mode exercises
    unsafeFor: opts.unsafeFor ?? [],
  };
}

export const byId = new Map(EXERCISES.map((e) => [e.id, e]));

/** Bodyweight is always available — it is the universal fallback. */
export function hasEquipment(exercise, availableEquipment) {
  const kit = new Set([...(availableEquipment ?? []), EQ.bodyweight]);
  // Smith machine can stand in for a barbell on the main lifts.
  if (kit.has(EQ.smith)) kit.add(EQ.barbell);
  return exercise.equipment.every((need) => kit.has(need));
}

/** Coarse safety backstop — the AI does the real screening. */
export function isSafeFor(exercise, conditions) {
  const c = new Set(conditions ?? []);
  return !exercise.unsafeFor.some((cond) => c.has(cond));
}

/** Difficulty gate: never prescribe advanced lifts to a beginner. */
export function withinLevel(exercise, fitnessLevel) {
  const rank = { beginner: 1, intermediate: 2, advanced: 3 };
  return rank[exercise.difficulty] <= (rank[fitnessLevel] ?? 1);
}

/** The exercises a given athlete can actually, safely perform. */
export function eligibleExercises({ pool, availableEquipment, conditions, fitnessLevel }) {
  return EXERCISES.filter(
    (e) =>
      e.pools.includes(pool) &&
      hasEquipment(e, availableEquipment) &&
      isSafeFor(e, conditions) &&
      withinLevel(e, fitnessLevel),
  );
}

/** Ids only — handed to the AI so it can only pick real, valid exercises. */
export function catalogForPrompt() {
  return EXERCISES.map((e) => ({
    id: e.id,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    difficulty: e.difficulty,
    pools: e.pools,
    mode: e.mode,
    unsafeFor: e.unsafeFor,
  }));
}
