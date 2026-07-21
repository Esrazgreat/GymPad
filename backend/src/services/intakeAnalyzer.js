import { config } from '../config.js';
import { AIRefused, AIUnavailable, aiEnabled, completeJSON } from './anthropic.js';
import { buildDeterministicPlan, computeBmi, sanitizePlan } from './planEngine.js';
import { catalogForPrompt } from './exercises.js';

/**
 * Health screening + plan generation.
 *
 * This is the most safety-sensitive code in the app: its output decides whether
 * someone is shown a workout at all. Three layers guard that decision, in order:
 *
 *   1. The MODEL screens for contraindications (nuanced, reads free-text
 *      medication and injury fields a rule engine can't parse).
 *   2. `enforceSafetyFloor` — hard-coded rules the model CANNOT override. It can
 *      only ever make the clearance *more* cautious, never less. A model that
 *      returns "clear" for someone who listed recent cardiac surgery is
 *      overridden here.
 *   3. `sanitizePlan` (planEngine) — strips individual unsafe exercises from
 *      whatever plan survives.
 *
 * If the model is unavailable we do NOT fail open with a plan and no screening —
 * we run the deterministic engine *and* the same safety floor.
 */

// ─── Response schema ────────────────────────────────────────────────────────
// Structured outputs guarantee this shape. Note what is NOT delegated to the
// model: BMI. That is arithmetic, computed server-side — asking an LLM to do
// deterministic maths and then displaying it as health data is indefensible.

const bilingual = {
  type: 'object',
  properties: { en: { type: 'string' }, am: { type: 'string' } },
  required: ['en', 'am'],
  additionalProperties: false,
};

const prescription = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sets: { type: 'integer' },
    reps: { type: 'integer' },
    timeSeconds: { type: 'integer' },
    restSeconds: { type: 'integer' },
    modification: { type: 'string' },
    safetyNote: { type: 'string' },
  },
  required: ['id', 'sets', 'reps', 'timeSeconds', 'restSeconds', 'modification', 'safetyNote'],
  additionalProperties: false,
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    clearance: { type: 'string', enum: ['clear', 'modify', 'defer'] },
    clearanceNotes: bilingual,
    recommendedSplit: { type: 'string' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phaseNumber: { type: 'integer' },
          durationWeeks: { type: 'integer' },
          label: bilingual,
          focusDescription: bilingual,
          weeklySchedule: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dayLabel: bilingual,
                exercises: { type: 'array', items: prescription },
              },
              required: ['dayLabel', 'exercises'],
              additionalProperties: false,
            },
          },
        },
        required: ['phaseNumber', 'durationWeeks', 'label', 'focusDescription', 'weeklySchedule'],
        additionalProperties: false,
      },
    },
  },
  required: ['clearance', 'clearanceNotes', 'recommendedSplit', 'phases'],
  additionalProperties: false,
};

// ─── Hard safety floor (not overridable by the model or by user input) ───────

/** Conditions that can never silently pass as "clear". */
const MIN_MODIFY = ['heart', 'diabetes', 'asthma', 'joint', 'osteoporosis', 'epilepsy', 'pregnancy', 'obesity'];
/** Conditions that require a doctor before any programme, full stop. */
const FORCE_DEFER = ['surgery'];

const RANK = { clear: 0, modify: 1, defer: 2 };
const atLeast = (current, floor) => (RANK[floor] > RANK[current] ? floor : current);

/**
 * Raise the clearance level when the intake contains something the model may
 * have under-weighted. Only ever ratchets upward.
 */
export function enforceSafetyFloor(analysis, intake) {
  const conditions = new Set(intake.conditions ?? []);
  let clearance = analysis.clearance ?? 'modify';
  const reasons = [];

  for (const c of FORCE_DEFER) {
    if (conditions.has(c)) {
      clearance = atLeast(clearance, 'defer');
      reasons.push('recent surgery');
    }
  }
  for (const c of MIN_MODIFY) {
    if (conditions.has(c)) clearance = atLeast(clearance, 'modify');
  }
  // A declared medication list is always at least a "modify" — we cannot know
  // how a drug interacts with training load, so the plan must carry caveats.
  if (intake.medications && intake.medications.trim().length > 2) {
    clearance = atLeast(clearance, 'modify');
  }
  // Age extremes get extra caution regardless of what the model said.
  const age = Number(intake.age);
  if (Number.isFinite(age) && (age >= 65 || age <= 15)) {
    clearance = atLeast(clearance, 'modify');
  }

  const escalated = clearance !== analysis.clearance;
  return { clearance, escalated, reasons };
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

function systemPrompt(intake) {
  const catalog = JSON.stringify(catalogForPrompt());
  return `You are a certified personal trainer and sports-medicine advisor for GymPad, a free fitness app used in Ethiopia. A user has submitted a health intake form before starting a ${intake.goal === 'loss' ? 'weight loss' : 'muscle building'} plan lasting ${intake.duration_weeks} weeks.

Your job:
1. Screen for medical contraindications that would make exercise dangerous right now.
2. Build an appropriate, phased training plan.

CLEARANCE RULES
- "defer" — a condition or medication makes exercise unsafe until a doctor clears them (uncontrolled heart disease, recent cardiac or abdominal surgery, active seizure disorder without medical clearance, pregnancy complications, medications such as beta-blockers that severely blunt heart-rate response). Explain kindly, say what to do first, and make clear they are welcome back.
- "modify" — conditions exist but training is safe with adjustments (controlled hypertension, Type 2 diabetes, mild asthma, joint pain, older age). List the specific modifications.
- "clear" — nothing flagged.

Be kind and non-alarming, but do not downplay genuine risk. Never diagnose. Never advise stopping prescribed medication.

PROGRAMME RULES
- Only choose exercises from this catalog. Use the exact "id" values. Never invent an id:
${catalog}
- Respect available_equipment: every exercise you prescribe must be satisfiable by the user's equipment. Bodyweight is always available.
- Respect the user's fitness_level; do not prescribe "advanced" movements to a beginner.
- Never prescribe an exercise whose "unsafeFor" list includes one of the user's conditions.
- For muscle building, cover ALL major muscle groups across the week using a split matched to their sessions per week:
  • 2 days → Full Body A / Full Body B
  • 3 days → Push / Pull / Legs
  • 4 days → Upper A / Lower A / Upper B / Lower B
  • 5–6 days → Push / Pull / Legs (repeating)
- For weight loss, build HIIT and conditioning circuits, not a lifting split.
- Fill exactly one of "reps" or "timeSeconds" per exercise, matching that exercise's "mode" in the catalog. Set the unused one to 0.
- Escalate load 10–20% each phase.
- Number of phases should suit the programme length (1 week → 1 phase; 4 → 2; 12 → 3; 26 → 4; 52 → 6).
- If clearance is "defer", return an empty "phases" array. Do not build a plan someone has been told not to start.

LANGUAGE
Every user-facing string is bilingual: provide natural English in "en" and natural Amharic in Ge'ez script in "am". Never romanise Amharic. Never leave "am" empty or copy the English into it.`;
}

function userPrompt(intake) {
  const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : 'none');
  return `Health intake:
- Goal: ${intake.goal === 'loss' ? 'weight loss' : 'muscle building'}
- Programme length: ${intake.duration_weeks} weeks
- Age: ${intake.age ?? 'not given'}
- Weight: ${intake.weight_kg ?? '?'} kg
- Height: ${intake.height_cm ?? '?'} cm
- Biological sex: ${intake.biological_sex ?? 'prefer not to say'}
- Fitness level: ${intake.fitness_level ?? 'beginner'}
- Available equipment: ${list(intake.available_equipment)}
- Sessions per week: ${intake.sessions_per_week ?? 3}
- Session length: ${intake.session_duration_min ?? 45} minutes
- Declared conditions: ${list(intake.conditions)}
- Medications: ${intake.medications?.trim() || 'none reported'}
- Injuries in the last 12 months: ${intake.injuries?.trim() || 'none reported'}
- Anything else: ${intake.additional_notes?.trim() || 'nothing further'}

Screen this person, then build their plan.`;
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * @returns {Promise<{clearance, clearanceNotes, bmi, bmiCategory, recommendedSplit, phases, source, removed}>}
 */
export async function analyzeIntake(intake) {
  const { bmi, category } = computeBmi(intake.weight_kg, intake.height_cm);

  let analysis;
  let source = 'ai';

  if (aiEnabled()) {
    try {
      analysis = await completeJSON({
        system: systemPrompt(intake),
        user: userPrompt(intake),
        schema: ANALYSIS_SCHEMA,
        model: config.anthropic.screeningModel,
        effort: 'high',
      });
    } catch (err) {
      if (err instanceof AIRefused || err instanceof AIUnavailable) {
        source = 'fallback';
      } else {
        console.error('[intakeAnalyzer] model call failed:', err.message);
        source = 'fallback';
      }
    }
  } else {
    source = 'fallback';
  }

  if (!analysis) {
    // Deterministic path. It cannot read free-text medication fields, so it is
    // deliberately more conservative: anything declared lands on "modify".
    const conservative = deterministicScreen(intake);
    analysis = {
      clearance: conservative.clearance,
      clearanceNotes: conservative.notes,
      ...buildDeterministicPlan(intake),
    };
  }

  // Layer 2: the floor. Only ratchets upward.
  const floor = enforceSafetyFloor(analysis, intake);
  if (floor.escalated) {
    analysis.clearance = floor.clearance;
    analysis.clearanceNotes = escalationNotes(floor, analysis.clearanceNotes);
  }

  // A deferred user must never receive a plan, whatever produced the analysis.
  if (analysis.clearance === 'defer') {
    analysis.phases = [];
  }

  // Layer 3: per-exercise filtering.
  let removed = [];
  if (analysis.phases?.length) {
    const result = sanitizePlan(analysis, intake);
    analysis = { ...analysis, phases: result.plan.phases };
    removed = result.removed;
    if (removed.length) {
      console.warn(`[intakeAnalyzer] filtered ${removed.length} unsafe/invalid exercise(s):`, removed);
    }
  }

  return {
    clearance: analysis.clearance,
    clearanceNotes: analysis.clearanceNotes,
    bmi,
    bmiCategory: category,
    recommendedSplit: analysis.recommendedSplit ?? '',
    phases: analysis.phases ?? [],
    source,
    removed,
  };
}

/** Rule-based screening used when the model is unavailable. */
function deterministicScreen(intake) {
  const conditions = new Set(intake.conditions ?? []);
  const hasMeds = Boolean(intake.medications?.trim());

  if (conditions.has('surgery')) {
    return {
      clearance: 'defer',
      notes: {
        en: "You mentioned surgery in the last six months. Before starting any programme, please get the go-ahead from the doctor who treated you — they know how your recovery is going. Come back to GymPad as soon as you have it; your plan will be waiting.",
        am: 'ባለፉት ስድስት ወራት ውስጥ ቀዶ ጥገና እንደተደረገልህ ጠቅሰሃል። ማንኛውንም ፕሮግራም ከመጀመርህ በፊት እባክህ ካከመህ ሐኪም ፈቃድ አግኝ — የማገገምህን ሁኔታ የሚያውቀው እሱ ነው። ፈቃድ እንዳገኘህ ወዲያውኑ ወደ ጂምፓድ ተመለስ፤ ዕቅድህ ይጠብቅሃል።',
      },
    };
  }
  if (conditions.size > 0 || hasMeds) {
    return {
      clearance: 'modify',
      notes: {
        en: 'We have built you a plan with adjustments for what you told us. Start at the easier end of every range, stop if anything hurts, and mention this plan to your doctor at your next visit.',
        am: 'ለነገርከን ነገር ማስተካከያ ያለው ዕቅድ አዘጋጅተንልሃል። እያንዳንዱን ክልል ከቀላሉ ጫፍ ጀምር፣ ማንኛውም ነገር ካመመህ አቁም፣ እና በሚቀጥለው ጉብኝትህ ስለዚህ ዕቅድ ለሐኪምህ ንገር።',
      },
    };
  }
  return {
    clearance: 'clear',
    notes: {
      en: "Nothing in your answers raised a flag. Start steady, focus on technique, and build from there.",
      am: 'በመልሶችህ ውስጥ ምንም አሳሳቢ ነገር አልተገኘም። በእርጋታ ጀምር፣ በቴክኒክ ላይ አተኩር፣ ከዚያም ገንባ።',
    },
  };
}

/** Explain an escalation in the user's own terms, keeping the model's wording too. */
function escalationNotes(floor, original) {
  const deferred = floor.clearance === 'defer';
  const extra = deferred
    ? {
        en: ' Because you told us about recent surgery, we want a doctor to clear you before you start. That is the only step standing between you and your plan.',
        am: ' ስለ ቅርብ ጊዜ ቀዶ ጥገና ስለነገርከን፣ ከመጀመርህ በፊት ሐኪም እንዲፈቅድልህ እንፈልጋለን። በአንተና በዕቅድህ መካከል ያለው ብቸኛ እርምጃ ይህ ነው።',
      }
    : {
        en: ' We have added extra caution to your plan based on what you shared.',
        am: ' ባካፈልከን መረጃ መሠረት በዕቅድህ ላይ ተጨማሪ ጥንቃቄ አክለናል።',
      };

  return {
    en: `${original?.en ?? ''}${extra.en}`.trim(),
    am: `${original?.am ?? ''}${extra.am}`.trim(),
  };
}
