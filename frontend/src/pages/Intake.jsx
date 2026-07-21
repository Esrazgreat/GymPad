import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api, ApiError } from '../lib/api.js';

/**
 * The health intake wizard.
 *
 * Four steps, one decision-cluster each, with a progress bar — a single long
 * form would be abandoned, and this is the data the safety screening depends on.
 *
 * The outcome screen is the important part. `clearance: 'defer'` renders a
 * dedicated, calm screen with NO plan and no way to bypass it — the user is
 * told what to do first and reassured they're welcome back. That path is
 * enforced on the server too; this is the presentation of it, not the guard.
 */

const CONDITIONS = ['heart', 'diabetes', 'asthma', 'joint', 'osteoporosis', 'epilepsy', 'surgery', 'pregnancy', 'obesity', 'other'];
const EQUIPMENT = ['barbell', 'dumbbells', 'cables', 'smith', 'legpress', 'pullup', 'bands', 'bench', 'kettlebell', 'bodyweight'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DAYS = [2, 3, 4, 5, 6];
const LENGTHS = [30, 45, 60, 90];
const TOTAL_STEPS = 4;

export default function Intake() {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const seed = location.state ?? {};
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    goal: seed.goal ?? 'build',
    duration_weeks: seed.duration_weeks ?? 12,
    age: '',
    weight_kg: '',
    height_cm: '',
    biological_sex: 'prefer_not',
    fitness_level: 'beginner',
    available_equipment: ['bodyweight'],
    sessions_per_week: 3,
    session_duration_min: 45,
    conditions: [],
    medications: '',
    injuries: '',
    additional_notes: '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggle = (key, value) =>
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  // Guard against landing here without picking a goal first.
  if (!seed.goal && !result) return <Navigate to="/plans" replace />;

  const canAdvance = useMemo(() => {
    if (step === 0) return form.age !== '' && form.weight_kg !== '' && form.height_cm !== '';
    return true;
  }, [step, form]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        ...form,
        age: Number(form.age) || null,
        weight_kg: Number(form.weight_kg) || null,
        height_cm: Number(form.height_cm) || null,
      };
      const response = await api.analyzeIntake(payload);
      setResult(response);
      window.scrollTo(0, 0);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Outcome ─────────────────────────────────────────────────────────────
  if (result) return <Outcome result={result} onContinue={() => navigate('/plan')} />;

  return (
    <main className="gp-shell">
      <Header title={t('intake.title')} subtitle={t('intake.subtitle')} />

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-dim mb-2 font-bold">
          <span>{t('intake.stepOf', { current: step + 1, total: TOTAL_STEPS })}</span>
          <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-flame transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div key={step} className="animate-riseIn">
        {step === 0 && <StepBody form={form} set={set} errors={fieldErrors} />}
        {step === 1 && <StepFitness form={form} set={set} toggle={toggle} />}
        {step === 2 && <StepHealth form={form} set={set} toggle={toggle} />}
        {step === 3 && <StepReview form={form} />}
      </div>

      {error && (
        <p className="text-danger text-sm mt-4" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="gp-ghost flex-1" disabled={submitting}>
            {t('common.back')}
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="gp-btn flex-1" disabled={!canAdvance}>
            {t('common.next')}
          </button>
        ) : (
          <button type="button" onClick={submit} className="gp-btn flex-1" disabled={submitting}>
            {submitting ? t('intake.submittingLong') : t('intake.submit')}
          </button>
        )}
      </div>
    </main>
  );
}

// ─── Steps ──────────────────────────────────────────────────────────────────

function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="gp-label">{label}</label>
      {children}
      {hint && <p className="text-dim text-xs mt-1.5">{hint}</p>}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function StepBody({ form, set, errors }) {
  const { t } = useI18n();
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-display">{t('intake.stepBody')}</h2>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t('intake.age')} error={errors.age}>
          <input
            type="number" inputMode="numeric" className="gp-input" min={13} max={90}
            value={form.age} onChange={(e) => set({ age: e.target.value })}
          />
        </Field>
        <Field label={t('intake.weight')} error={errors.weight_kg}>
          <input
            type="number" inputMode="decimal" className="gp-input" min={25} max={400}
            value={form.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })}
          />
        </Field>
        <Field label={t('intake.height')} error={errors.height_cm}>
          <input
            type="number" inputMode="numeric" className="gp-input" min={100} max={250}
            value={form.height_cm} onChange={(e) => set({ height_cm: e.target.value })}
          />
        </Field>
      </div>

      <Field label={t('intake.sex')} hint={t('intake.sexWhy')}>
        <div className="flex flex-wrap gap-2">
          {[['male', 'sexMale'], ['female', 'sexFemale'], ['prefer_not', 'sexPreferNot']].map(([value, key]) => (
            <button
              key={value} type="button" onClick={() => set({ biological_sex: value })}
              aria-pressed={form.biological_sex === value} className="gp-chip"
            >
              {t(`intake.${key}`)}
            </button>
          ))}
        </div>
      </Field>
    </section>
  );
}

function StepFitness({ form, set, toggle }) {
  const { t } = useI18n();
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-display">{t('intake.stepFitness')}</h2>

      <Field label={t('intake.level')}>
        <div className="grid gap-2">
          {LEVELS.map((level) => {
            const selected = form.fitness_level === level;
            return (
              <button
                key={level} type="button" onClick={() => set({ fitness_level: level })}
                aria-pressed={selected}
                className={`gp-card p-3 text-left flex items-center justify-between transition-all ${
                  selected ? 'border-orange bg-orange/10' : ''
                }`}
              >
                <span>
                  <span className="font-bold block">
                    {t(`intake.level${level[0].toUpperCase()}${level.slice(1)}`)}
                  </span>
                  <span className="text-dim text-xs">
                    {t(`intake.level${level[0].toUpperCase()}${level.slice(1)}Desc`)}
                  </span>
                </span>
                {selected && <span className="text-gold" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t('intake.equipment')} hint={t('intake.equipmentHint')}>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((item) => (
            <button
              key={item} type="button" onClick={() => toggle('available_equipment', item)}
              aria-pressed={form.available_equipment.includes(item)} className="gp-chip"
            >
              {t(`equipment.${item}`)}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('intake.daysPerWeek')}>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d} type="button" onClick={() => set({ sessions_per_week: d })}
              aria-pressed={form.sessions_per_week === d} className="gp-chip flex-1 justify-center"
            >
              {d}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('intake.sessionLength')}>
        <div className="flex gap-2">
          {LENGTHS.map((m) => (
            <button
              key={m} type="button" onClick={() => set({ session_duration_min: m })}
              aria-pressed={form.session_duration_min === m} className="gp-chip flex-1 justify-center"
            >
              {m}′
            </button>
          ))}
        </div>
      </Field>
    </section>
  );
}

function StepHealth({ form, set, toggle }) {
  const { t } = useI18n();
  const none = form.conditions.length === 0;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-display">{t('intake.stepHealth')}</h2>
      <p className="text-dim text-sm leading-relaxed -mt-3">{t('intake.healthIntro')}</p>

      <Field label={t('intake.conditions')}>
        <div className="grid gap-2">
          <button
            type="button" onClick={() => set({ conditions: [] })} aria-pressed={none}
            className={`gp-card p-3 text-left flex items-center justify-between ${none ? 'border-cyan/60 bg-cyan/10' : ''}`}
          >
            <span className="font-bold text-sm">{t('intake.conditionsNone')}</span>
            {none && <span className="text-cyan" aria-hidden="true">✓</span>}
          </button>

          {CONDITIONS.map((condition) => {
            const selected = form.conditions.includes(condition);
            return (
              <button
                key={condition} type="button" onClick={() => toggle('conditions', condition)}
                aria-pressed={selected}
                className={`gp-card p-3 text-left flex items-center justify-between gap-3 ${
                  selected ? 'border-orange bg-orange/10' : ''
                }`}
              >
                <span className="text-sm">{t(`conditions.${condition}`)}</span>
                {selected && <span className="text-gold shrink-0" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t('intake.meds')}>
        <textarea
          rows={2} className="gp-input resize-none" placeholder={t('intake.medsPlaceholder')}
          value={form.medications} onChange={(e) => set({ medications: e.target.value })}
        />
      </Field>

      <Field label={t('intake.injuries')}>
        <textarea
          rows={2} className="gp-input resize-none" placeholder={t('intake.injuriesPlaceholder')}
          value={form.injuries} onChange={(e) => set({ injuries: e.target.value })}
        />
      </Field>

      <Field label={t('intake.notes')}>
        <textarea
          rows={2} className="gp-input resize-none" placeholder={t('intake.notesPlaceholder')}
          value={form.additional_notes} onChange={(e) => set({ additional_notes: e.target.value })}
        />
      </Field>
    </section>
  );
}

function StepReview({ form }) {
  const { t, tList } = useI18n();
  const durations = tList('plans.durations');
  const durationIndex = [1, 4, 12, 26, 52].indexOf(form.duration_weeks);

  const rows = [
    [t('plans.chooseGoal'), form.goal === 'loss' ? t('plans.lossGoal') : t('plans.buildGoal')],
    [t('plans.chooseDuration'), durations[durationIndex] ?? `${form.duration_weeks}w`],
    [t('intake.age'), form.age || '—'],
    [t('intake.weight'), form.weight_kg ? `${form.weight_kg} kg` : '—'],
    [t('intake.height'), form.height_cm ? `${form.height_cm} cm` : '—'],
    [t('intake.level'), t(`intake.level${form.fitness_level[0].toUpperCase()}${form.fitness_level.slice(1)}`)],
    [t('intake.daysPerWeek'), `${form.sessions_per_week} · ${form.session_duration_min}′`],
    [
      t('intake.equipment'),
      form.available_equipment.length ? form.available_equipment.map((e) => t(`equipment.${e}`)).join(', ') : '—',
    ],
    [
      t('intake.conditions'),
      form.conditions.length ? form.conditions.map((c) => t(`conditions.${c}`)).join(', ') : t('intake.conditionsNone'),
    ],
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-display">{t('intake.stepReview')}</h2>
      <p className="text-dim text-sm -mt-2">{t('intake.reviewIntro')}</p>

      <div className="gp-card divide-y divide-white/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <span className="text-dim shrink-0">{label}</span>
            <span className="text-right font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Outcome ────────────────────────────────────────────────────────────────

function Outcome({ result, onContinue }) {
  const { t, pick } = useI18n();
  const deferred = result.clearance === 'defer';

  return (
    <main className="gp-shell">
      <Header />

      <div
        className={`gp-card p-6 animate-riseIn ${deferred ? 'border-gold/50' : 'border-cyan/40'}`}
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-3" aria-hidden="true">{deferred ? '🩺' : result.clearance === 'modify' ? '🛡️' : '✅'}</div>
          <h1 className="text-2xl font-display">
            {deferred
              ? t('clearance.deferTitle')
              : result.clearance === 'modify'
                ? t('clearance.modifyTitle')
                : t('clearance.clearTitle')}
          </h1>
        </div>

        <p className="text-ink/90 leading-relaxed whitespace-pre-line">{pick(result.clearanceNotes)}</p>

        {/* BMI is always framed as one limited data point, never a bare verdict. */}
        {result.bmi != null && (
          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="flex items-baseline justify-between">
              <span className="gp-label !mb-0">{t('clearance.bmiLabel')}</span>
              <span className="gp-num text-2xl">{result.bmi}</span>
            </div>
            <p className="text-dim text-sm mt-1">{pick(result.bmiCategory)}</p>
            <p className="text-dim/70 text-xs mt-2 leading-relaxed">{t('clearance.bmiDisclaimer')}</p>
          </div>
        )}
      </div>

      {deferred ? (
        <>
          <p className="text-dim text-sm text-center mt-6 leading-relaxed">{t('clearance.deferFooter')}</p>
          {/* No plan link. There is deliberately no way past this screen. */}
          <a href="/" className="gp-ghost w-full mt-6">
            {t('clearance.deferCta')}
          </a>
        </>
      ) : (
        <button type="button" onClick={onContinue} className="gp-btn w-full mt-6">
          {t('clearance.viewPlan')}
        </button>
      )}
    </main>
  );
}
