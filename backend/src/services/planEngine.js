import { byId, eligibleExercises, hasEquipment, isSafeFor, withinLevel } from './exercises.js';

/**
 * The plan engine.
 *
 * It does two jobs, and the second is the important one:
 *
 *  1. `buildDeterministicPlan` — generates a complete, sane program with no AI
 *     at all. This is the fallback when Anthropic isn't configured or errors,
 *     so a user is never left staring at a broken screen.
 *
 *  2. `sanitizePlan` — runs over the AI's output and strips anything unsafe,
 *     unavailable, or hallucinated. The model is good but it is not the last
 *     word on safety: if it invents an exercise id, prescribes a barbell to
 *     someone with no barbell, or slips a plyometric past a knee injury, this
 *     catches it. Every AI plan goes through here before it reaches a user.
 */

// ─── Bilingual label helpers ────────────────────────────────────────────────
// All user-visible strings the engine produces are bilingual at the source —
// there is no English-only path that later needs translating.

const PHASE_LABELS = [
  { en: 'Foundation', am: 'መሠረት' },
  { en: 'Build', am: 'ግንባታ' },
  { en: 'Intensify', am: 'ማጠናከሪያ' },
  { en: 'Peak', am: 'ከፍታ' },
  { en: 'Sustain', am: 'ማቆያ' },
  { en: 'Mastery', am: 'ብቃት' },
];

const DAY_LABELS = {
  push: { en: 'Push', am: 'ግፋ' },
  pull: { en: 'Pull', am: 'ሳብ' },
  legs: { en: 'Legs', am: 'እግር' },
  upper: { en: 'Upper Body', am: 'የላይኛው አካል' },
  lower: { en: 'Lower Body', am: 'የታችኛው አካል' },
  full: { en: 'Full Body', am: 'ሙሉ አካል' },
  hiit: { en: 'HIIT Circuit', am: 'ኤች አይ አይ ቲ ዙር' },
  cardio: { en: 'Cardio + Core', am: 'ካርዲዮ እና ኮር' },
  metcon: { en: 'Conditioning', am: 'የአካል ብቃት' },
};

const dayLabel = (key, index) => ({
  en: `Day ${index + 1} — ${DAY_LABELS[key].en}`,
  am: `ቀን ${index + 1} — ${DAY_LABELS[key].am}`,
});

// ─── Split selection ────────────────────────────────────────────────────────
// Muscle groups each day must cover. Across a week, every major group appears.

const SPLITS = {
  build: {
    2: [
      { key: 'full', groups: ['chest', 'back', 'legs', 'core'] },
      { key: 'full', groups: ['shoulders', 'legs', 'back', 'biceps', 'triceps'] },
    ],
    3: [
      { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
      { key: 'pull', groups: ['back', 'biceps'] },
      { key: 'legs', groups: ['legs', 'core'] },
    ],
    4: [
      { key: 'upper', groups: ['chest', 'back', 'shoulders'] },
      { key: 'lower', groups: ['legs', 'core'] },
      { key: 'upper', groups: ['back', 'chest', 'biceps', 'triceps'] },
      { key: 'lower', groups: ['legs', 'core'] },
    ],
    5: [
      { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
      { key: 'pull', groups: ['back', 'biceps'] },
      { key: 'legs', groups: ['legs', 'core'] },
      { key: 'upper', groups: ['chest', 'back', 'shoulders'] },
      { key: 'lower', groups: ['legs', 'core'] },
    ],
    6: [
      { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
      { key: 'pull', groups: ['back', 'biceps'] },
      { key: 'legs', groups: ['legs', 'core'] },
      { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
      { key: 'pull', groups: ['back', 'biceps'] },
      { key: 'legs', groups: ['legs', 'core'] },
    ],
  },
};

const SPLIT_NAMES = {
  2: 'Full Body A / Full Body B',
  3: 'Push / Pull / Legs',
  4: 'Upper A / Lower A / Upper B / Lower B',
  5: 'Push / Pull / Legs / Upper / Lower',
  6: 'Push / Pull / Legs ×2',
};

/** Weight-loss days are circuits, not splits — conditioning with a core finisher. */
const LOSS_DAYS = (n) =>
  Array.from({ length: n }, (_, i) => ({
    key: i % 3 === 2 ? 'cardio' : i % 2 === 0 ? 'hiit' : 'metcon',
    groups: ['full_body', 'legs', 'core'],
  }));

// ─── Phase breakdown ────────────────────────────────────────────────────────

/**
 * Split a program length into training phases.
 * Short programs get one phase; long ones get several so load can escalate.
 */
export function phaseBreakdown(durationWeeks) {
  if (durationWeeks <= 1) return [1];
  if (durationWeeks <= 4) return [2, 2];
  if (durationWeeks <= 12) return [4, 4, 4];
  if (durationWeeks <= 26) return [6, 7, 7, 6];
  return [8, 9, 9, 9, 9, 8]; // 52 weeks
}

/** How many exercises fit in a session of a given length. */
const exerciseCount = (minutes) => {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  return 8;
};

// ─── Deterministic plan generation ──────────────────────────────────────────

export function buildDeterministicPlan(intake) {
  const {
    goal,
    duration_weeks: durationWeeks,
    sessions_per_week: sessionsPerWeek = 3,
    session_duration_min: sessionMinutes = 45,
    available_equipment: equipment = [],
    conditions = [],
    fitness_level: fitnessLevel = 'beginner',
  } = intake;

  const pool = goal === 'loss' ? 'loss' : 'build';
  const available = eligibleExercises({
    pool,
    availableEquipment: equipment,
    conditions,
    fitnessLevel,
  });

  // If safety filtering emptied the pool, fall back to bodyweight basics rather
  // than returning an empty plan.
  const usable = available.length >= 3 ? available : eligibleExercises({
    pool,
    availableEquipment: ['bodyweight'],
    conditions,
    fitnessLevel: 'beginner',
  });

  const days =
    pool === 'loss'
      ? LOSS_DAYS(sessionsPerWeek)
      : SPLITS.build[Math.min(6, Math.max(2, sessionsPerWeek))] ?? SPLITS.build[3];

  const perDay = exerciseCount(sessionMinutes);
  const breakdown = phaseBreakdown(durationWeeks);

  const phases = breakdown.map((weeks, phaseIndex) => ({
    phaseNumber: phaseIndex + 1,
    durationWeeks: weeks,
    label: PHASE_LABELS[Math.min(phaseIndex, PHASE_LABELS.length - 1)],
    focusDescription: focusFor(phaseIndex, pool),
    weeklySchedule: days.map((day, dayIndex) => ({
      dayLabel: dayLabel(day.key, dayIndex),
      exercises: pickForDay(usable, day.groups, perDay, phaseIndex, dayIndex, pool),
    })),
  }));

  return {
    recommendedSplit: pool === 'loss' ? 'HIIT & conditioning circuits' : SPLIT_NAMES[sessionsPerWeek] ?? SPLIT_NAMES[3],
    phases,
  };
}

function focusFor(phaseIndex, pool) {
  const build = [
    { en: 'Learn the movements and build a base. Focus on clean technique over heavy loads.', am: 'እንቅስቃሴዎቹን ተማር እና መሠረት ገንባ። ከከባድ ክብደት ይልቅ በትክክለኛ ቴክኒክ ላይ አተኩር።' },
    { en: 'Add volume. You should finish sets feeling like you had 2 reps left.', am: 'መጠኑን ጨምር። እያንዳንዱን ስብስብ ስትጨርስ 2 ተጨማሪ ድግግሞሽ የሚቀርህ ሆኖ ሊሰማህ ይገባል።' },
    { en: 'Push intensity. Heavier loads, slightly fewer reps.', am: 'ጥንካሬውን ጨምር። የበለጠ ከባድ ክብደት፣ ትንሽ ያነሰ ድግግሞሽ።' },
    { en: 'Peak. This is your hardest block — recovery matters more than ever.', am: 'ከፍታ። ይህ በጣም ከባዱ ክፍል ነው — ማገገም ከመቼውም ጊዜ በላይ ወሳኝ ነው።' },
    { en: 'Consolidate your gains and keep the habit alive.', am: 'ያገኘኸውን አጠናክር እና ልማዱን ቀጥል።' },
    { en: 'Refine technique and keep progressing at a sustainable pace.', am: 'ቴክኒክህን አሻሽል እና በዘላቂ ፍጥነት መሻሻልህን ቀጥል።' },
  ];
  const loss = [
    { en: 'Build your engine. Steady effort, full recovery between rounds.', am: 'የልብህን ብቃት ገንባ። ተመጣጣኝ ጥረት፣ በዙሮች መካከል ሙሉ እረፍት።' },
    { en: 'Shorten the rest. Same work, less recovery.', am: 'የእረፍት ጊዜውን አሳጥር። ተመሳሳይ ሥራ፣ ያነሰ ማገገሚያ።' },
    { en: 'Raise the intensity. Push the hard intervals genuinely hard.', am: 'ጥንካሬውን ከፍ አድርግ። ከባዶቹን ክፍተቶች በእውነት አጥብቀህ ግፋ።' },
    { en: 'Peak conditioning. Highest work, tightest rest.', am: 'ከፍተኛ ብቃት። ከፍተኛ ሥራ፣ አጭር እረፍት።' },
    { en: 'Maintain. Keep moving and protect the habit.', am: 'ጠብቅ። መንቀሳቀስህን ቀጥል እና ልማዱን ጠብቅ።' },
    { en: 'Sustainable conditioning you can keep doing for life.', am: 'ለዕድሜ ልክ ልትቀጥልበት የምትችል ዘላቂ የአካል ብቃት።' },
  ];
  const list = pool === 'loss' ? loss : build;
  return list[Math.min(phaseIndex, list.length - 1)];
}

/**
 * Choose exercises for one training day.
 *
 * ROUND-ROBIN across the day's muscle groups, not one pass then top-up. A naive
 * "one per group, then fill from whatever's left" produces days like
 * bench / row / raise / flyes / incline / crossover — four chest movements and
 * one back — because the top-up walks the catalog in order, and the catalog
 * starts with chest. Cycling the groups keeps an Upper day genuinely balanced.
 *
 * The `dayIndex` offset rotates which exercise each group contributes, so a
 * 6-day split doesn't prescribe the identical session twice in one week.
 */
function pickForDay(available, groups, count, phaseIndex, dayIndex, pool) {
  const picked = [];
  const used = new Set();

  const candidatesFor = (group) => available.filter((e) => e.muscleGroup === group && !used.has(e.id));

  // Cycle the groups until the day is full or every group is exhausted.
  let round = 0;
  while (picked.length < count) {
    let addedThisRound = 0;
    for (const group of groups) {
      if (picked.length >= count) break;
      const candidates = candidatesFor(group);
      if (!candidates.length) continue;
      const choice = candidates[(dayIndex + round) % candidates.length];
      used.add(choice.id);
      picked.push(choice);
      addedThisRound += 1;
    }
    if (addedThisRound === 0) break; // every listed group is tapped out
    round += 1;
  }

  // Only if the day's own groups genuinely can't fill it (a tiny equipment set)
  // do we reach outside them.
  for (const e of available) {
    if (picked.length >= count) break;
    if (!used.has(e.id)) {
      used.add(e.id);
      picked.push(e);
    }
  }

  // Order the session compound-first: heavy multi-joint work belongs at the
  // start, while the athlete is fresh. Isolation finishes.
  const ordered = picked.slice(0, count).sort((a, b) => {
    const weight = (e) => (['legs', 'chest', 'back', 'full_body'].includes(e.muscleGroup) ? 0 : 1);
    return weight(a) - weight(b);
  });

  return ordered.map((e) => prescribe(e, phaseIndex, pool));
}

/**
 * Turn an exercise into a prescription, escalating ~10–15% per phase.
 * Reps climb first, then a set is added — the same "earn the reps, then earn
 * the volume" logic a coach would use.
 */
function prescribe(exercise, phaseIndex, pool = 'build') {
  const bump = phaseIndex;
  const sets = exercise.baseSets + (bump >= 2 ? 1 : 0);
  const reps = exercise.mode === 'reps' ? Math.round(exercise.baseReps * (1 + 0.12 * bump)) : 0;
  const timeSeconds = exercise.mode === 'time' ? Math.round(exercise.baseTime * (1 + 0.15 * bump)) : 0;

  // Rest follows the PLAN's goal, not the exercise — the same glute bridge is a
  // strength movement in a build plan and a circuit station in a loss plan.
  // Conditioning rests shrink as phases progress; strength rests stay long.
  const isConditioning = pool === 'loss';
  const baseRest = isConditioning ? 45 : exercise.muscleGroup === 'full_body' ? 120 : 90;
  const restSeconds = isConditioning ? Math.max(20, baseRest - bump * 5) : baseRest;

  return {
    id: exercise.id,
    sets,
    reps,
    timeSeconds,
    restSeconds,
    modification: '',
    safetyNote: '',
  };
}

// ─── Safety net over AI output ──────────────────────────────────────────────

/**
 * Strip anything the model produced that a user should not actually be given.
 *
 * Removes: unknown ids (hallucinations), exercises needing equipment the user
 * doesn't have, exercises contraindicated by their conditions, and movements
 * above their stated level. If a day is emptied by filtering, it is rebuilt from
 * the deterministic engine so the user still gets a usable session.
 */
export function sanitizePlan(plan, intake) {
  const {
    available_equipment: equipment = [],
    conditions = [],
    fitness_level: fitnessLevel = 'beginner',
  } = intake;

  const removed = [];
  const keep = (item) => {
    const exercise = byId.get(item?.id);
    if (!exercise) {
      removed.push({ id: item?.id ?? '(unknown)', reason: 'not in catalog' });
      return false;
    }
    if (!hasEquipment(exercise, equipment)) {
      removed.push({ id: exercise.id, reason: 'equipment unavailable' });
      return false;
    }
    if (!isSafeFor(exercise, conditions)) {
      removed.push({ id: exercise.id, reason: 'contraindicated' });
      return false;
    }
    if (!withinLevel(exercise, fitnessLevel)) {
      removed.push({ id: exercise.id, reason: 'above stated experience level' });
      return false;
    }
    return true;
  };

  const fallback = buildDeterministicPlan(intake);

  const phases = (plan.phases ?? []).map((phase, phaseIndex) => {
    const weeklySchedule = (phase.weeklySchedule ?? []).map((day, dayIndex) => {
      const exercises = (day.exercises ?? []).filter(keep).map(normalizePrescription);
      if (exercises.length === 0) {
        // Everything in this day was filtered out — substitute a safe session.
        const backup =
          fallback.phases[Math.min(phaseIndex, fallback.phases.length - 1)]
            ?.weeklySchedule[dayIndex % fallback.phases[0].weeklySchedule.length];
        return { ...day, exercises: backup?.exercises ?? [] };
      }
      return { ...day, exercises };
    });
    return { ...phase, weeklySchedule };
  });

  return {
    plan: { ...plan, phases: phases.length ? phases : fallback.phases },
    removed,
  };
}

/** Clamp AI-provided numbers into sane ranges. */
function normalizePrescription(item) {
  const exercise = byId.get(item.id);
  const clamp = (n, lo, hi, dflt) => {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
  };
  return {
    id: item.id,
    sets: clamp(item.sets, 1, 8, exercise.baseSets),
    reps: exercise.mode === 'reps' ? clamp(item.reps, 1, 50, exercise.baseReps) : 0,
    timeSeconds: exercise.mode === 'time' ? clamp(item.timeSeconds, 10, 600, exercise.baseTime) : 0,
    restSeconds: clamp(item.restSeconds, 10, 600, 90),
    modification: typeof item.modification === 'string' ? item.modification.slice(0, 300) : '',
    safetyNote: typeof item.safetyNote === 'string' ? item.safetyNote.slice(0, 300) : '',
  };
}

// ─── BMI ────────────────────────────────────────────────────────────────────

/**
 * BMI, with deliberately non-clinical, non-shaming category language.
 * The spec is explicit: never present a bare label like "obese" — always frame
 * it as one limited data point.
 */
export function computeBmi(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!w || !h || h < 50) return { bmi: null, category: null };
  const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;

  let category;
  if (bmi < 18.5) category = { en: 'Below typical range', am: 'ከተለመደው ክልል በታች' };
  else if (bmi < 25) category = { en: 'Typical range', am: 'የተለመደ ክልል' };
  else if (bmi < 30) category = { en: 'Above typical range', am: 'ከተለመደው ክልል በላይ' };
  else category = { en: 'Well above typical range', am: 'ከተለመደው ክልል በጣም በላይ' };

  return { bmi, category };
}
