import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseDemo from '../components/ExerciseDemo.jsx';
import RepSet from '../components/RepSet.jsx';
import TimeSet from '../components/TimeSet.jsx';
import EmergencyModal from '../components/EmergencyModal.jsx';
import { usePlan, todaysWorkout } from '../hooks/usePlan.js';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { getDisplay } from '../lib/exercises.js';
import { goBeep, hapticDone, primeAudio } from '../lib/feedback.js';

/**
 * The live workout screen.
 *
 * Full-screen, no bottom nav — a focused mode. The flow is a small state
 * machine: EXERCISE → (set complete) → REST → next set, repeating until the day
 * is done.
 *
 * Design decisions that matter here:
 *  • The elapsed timer derives from a start timestamp, not an accumulating
 *    counter, so a backgrounded phone still reports the true session length.
 *  • Completed sets are tracked locally and posted ONCE at the end. Logging each
 *    set would mean a network round trip between every set in a basement gym.
 *  • A "something's wrong" button is always visible, opening the emergency
 *    modal. Safety cannot be behind a menu.
 */

const PHASE = { EXERCISE: 'exercise', REST: 'rest', DONE: 'done' };

export default function Session() {
  const { t, pick, lang } = useI18n();
  const navigate = useNavigate();
  const { plan, position, loading } = usePlan();

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhase] = useState(PHASE.EXERCISE);
  const [completed, setCompleted] = useState([]);
  const [showCues, setShowCues] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(null);

  const startedAtRef = useRef(Date.now());

  const today = useMemo(() => todaysWorkout(plan, position), [plan, position]);
  const exercises = today?.day?.exercises ?? [];
  const current = exercises[exerciseIndex];
  const display = current ? getDisplay(current.id) : null;
  const cues = display ? (display.cues[lang] ?? display.cues.en ?? []) : [];

  // Wall-clock elapsed time — immune to the tab being backgrounded.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the screen awake during a workout where the platform allows it.
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => lock?.release?.().catch(() => {});
  }, []);

  const recordSet = useCallback(
    (amount) => {
      setCompleted((list) => {
        const existing = list.find((x) => x.id === current.id);
        if (existing) {
          return list.map((x) =>
            x.id === current.id ? { ...x, setsDone: x.setsDone + 1, repsOrTime: amount } : x,
          );
        }
        return [...list, { id: current.id, setsDone: 1, repsOrTime: amount }];
      });
    },
    [current],
  );

  const onSetComplete = useCallback(
    (amount) => {
      recordSet(amount ?? current.reps ?? current.timeSeconds);

      const isLastSet = setIndex + 1 >= current.sets;
      const isLastExercise = exerciseIndex + 1 >= exercises.length;

      if (isLastSet && isLastExercise) {
        setPhase(PHASE.DONE);
        hapticDone();
        return;
      }
      setPhase(PHASE.REST);
    },
    [current, setIndex, exerciseIndex, exercises.length, recordSet],
  );

  const afterRest = useCallback(() => {
    goBeep();
    if (setIndex + 1 >= current.sets) {
      setExerciseIndex((i) => i + 1);
      setSetIndex(0);
      setShowCues(false);
    } else {
      setSetIndex((s) => s + 1);
    }
    setPhase(PHASE.EXERCISE);
  }, [current, setIndex]);

  const finish = useCallback(async () => {
    setSaving(true);
    const durationMin = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    try {
      const response = await api.logSession({
        planId: plan?.id,
        phaseIndex: position?.phaseIndex ?? 0,
        weekNumber: position?.weekNumber ?? 1,
        dayLabel: pick(today?.day?.dayLabel),
        durationMin,
        exercisesCompleted: completed,
      });
      setSummary({ durationMin, exercises: completed.length, streak: response.streak });
    } catch {
      // Never lose the workout to a network failure — show the summary anyway.
      setSummary({ durationMin, exercises: completed.length, streak: null, offline: true });
    } finally {
      setSaving(false);
      setPhase(PHASE.DONE);
    }
  }, [plan, position, today, completed, pick]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="gp-shell"><div className="gp-skeleton h-72" /></div>;
  }
  if (!today || exercises.length === 0) {
    return (
      <main className="gp-shell text-center">
        <p className="text-dim my-12">{t('home.restDay')}</p>
        <button type="button" onClick={() => navigate('/plan')} className="gp-btn">
          {t('session.backToPlan')}
        </button>
      </main>
    );
  }

  // ── Completion ───────────────────────────────────────────────────────────
  if (phase === PHASE.DONE) {
    return (
      <main className="gp-shell min-h-dvh flex flex-col justify-center text-center">
        <div className="animate-riseIn">
          <div className="text-6xl mb-4" aria-hidden="true">🎉</div>
          <h1 className="text-3xl font-display mb-2">{t('session.completeTitle')}</h1>
          <p className="text-dim mb-8">
            {t('session.completeBody', {
              minutes: summary?.durationMin ?? Math.round(elapsed / 60),
              exercises: summary?.exercises ?? completed.length,
            })}
          </p>

          {summary?.streak > 0 && (
            <div className="gp-card p-5 mb-8 inline-block">
              <div className="gp-num text-mega gp-gradient-text">{summary.streak}</div>
              <div className="text-[11px] uppercase tracking-widest text-dim font-bold mt-1">
                {t('home.streak')}
              </div>
            </div>
          )}

          {summary?.offline && <p className="text-gold/80 text-sm mb-6">{t('common.offline')}</p>}

          {!summary ? (
            <button type="button" onClick={finish} className="gp-btn w-full" disabled={saving}>
              {saving ? t('common.loading') : t('session.finish')}
            </button>
          ) : (
            <div className="space-y-3">
              <button type="button" onClick={() => navigate('/progress')} className="gp-btn w-full">
                {t('progress.title')}
              </button>
              <button type="button" onClick={() => navigate('/plan')} className="gp-ghost w-full">
                {t('session.backToPlan')}
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = completed.reduce((sum, e) => sum + e.setsDone, 0);
  const progressPct = totalSets ? (doneSets / totalSets) * 100 : 0;

  return (
    <main className="min-h-dvh flex flex-col" style={{ paddingTop: 'var(--gp-safe-top)' }}>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3 mb-2">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="text-dim text-sm hover:text-ink transition-colors"
          >
            ← {t('session.finish')}
          </button>

          <span className="gp-num text-sm text-dim">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </span>

          {/* Always reachable, never behind a menu. */}
          <button
            type="button"
            onClick={() => setShowEmergency(true)}
            className="text-danger text-xs font-bold px-2 py-1 rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors"
            aria-label={t('emergency.title')}
          >
            ⚠️
          </button>
        </div>

        <p className="text-[11px] text-dim mb-1.5">
          {pick(today.day.dayLabel)} · {doneSets}/{totalSets} {t('common.sets')}
        </p>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-flame transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-4 pb-6 max-w-[560px] w-full mx-auto">
        {phase === PHASE.REST ? (
          <RestPanel seconds={current.restSeconds} onDone={afterRest} nextLabel={nextLabel()} />
        ) : (
          <>
            <div className="gp-card overflow-hidden mb-4">
              <ExerciseDemo exerciseId={current.id} height={220} />
            </div>

            <div className="text-center mb-4">
              <h1 className="text-2xl font-display leading-tight">{pick(display.name)}</h1>
              <p className="text-dim text-sm mt-1">
                {t('session.setOf', { current: setIndex + 1, total: current.sets })}
              </p>
            </div>

            {cues.length > 0 && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setShowCues((v) => !v)}
                  aria-expanded={showCues}
                  className="text-xs text-gold font-bold flex items-center gap-1.5 mx-auto"
                >
                  {t('session.showCues')} <span aria-hidden="true">{showCues ? '▴' : '▾'}</span>
                </button>
                {showCues && (
                  <ul className="gp-card p-3 mt-2 space-y-1.5 animate-riseIn">
                    {cues.map((cue, i) => (
                      <li key={i} className="text-dim text-xs flex gap-2">
                        <span className="text-gold shrink-0" aria-hidden="true">›</span>
                        {cue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex-1 flex items-center justify-center py-2">
              {current.reps > 0 ? (
                <RepSet key={`${current.id}-${setIndex}`} target={current.reps} onComplete={onSetComplete} />
              ) : (
                <TimeSet
                  key={`${current.id}-${setIndex}`}
                  seconds={current.timeSeconds}
                  onComplete={() => onSetComplete(current.timeSeconds)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Exercise strip ─────────────────────────────────────────────────── */}
      <nav
        className="border-t border-white/10 bg-[#150C24]/95 backdrop-blur-lg px-3 py-2 overflow-x-auto gp-hide-scroll"
        style={{ paddingBottom: 'calc(var(--gp-safe-bottom) + 0.5rem)' }}
        aria-label={t('session.exerciseList')}
      >
        <ul className="flex gap-2 w-max">
          {exercises.map((ex, i) => {
            const done = completed.find((c) => c.id === ex.id)?.setsDone ?? 0;
            const isCurrent = i === exerciseIndex;
            return (
              <li key={`${ex.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => { setExerciseIndex(i); setSetIndex(0); setPhase(PHASE.EXERCISE); setShowCues(false); }}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all ${
                    isCurrent
                      ? 'bg-flame text-[#1a0d08] border-transparent'
                      : done >= ex.sets
                        ? 'border-cyan/40 text-cyan bg-cyan/10'
                        : 'border-white/10 text-dim'
                  }`}
                >
                  {done >= ex.sets && <span aria-hidden="true">✓ </span>}
                  {pick(getDisplay(ex.id).name)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <EmergencyModal
        open={showEmergency}
        onDismiss={() => setShowEmergency(false)}
        onEndSession={() => { setShowEmergency(false); navigate('/'); }}
      />

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="gp-card-solid w-full max-w-sm p-5 animate-riseIn">
            <h2 className="font-display text-lg mb-1">{t('session.finishConfirm')}</h2>
            <p className="text-dim text-sm mb-5">{t('session.finishConfirmBody')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirm(false)} className="gp-ghost flex-1">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => { setShowConfirm(false); finish(); }} className="gp-btn flex-1">
                {t('session.finish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  function nextLabel() {
    if (setIndex + 1 < current.sets) {
      return `${pick(display.name)} · ${t('session.setOf', { current: setIndex + 2, total: current.sets })}`;
    }
    const next = exercises[exerciseIndex + 1];
    return next ? pick(getDisplay(next.id).name) : '';
  }
}

/** Rest countdown between sets, with a skip. */
function RestPanel({ seconds, onDone, nextLabel }) {
  const { t } = useI18n();

  useEffect(() => {
    primeAudio();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-riseIn">
      <p className="text-[11px] uppercase tracking-widest text-cyan font-bold">{t('session.restTitle')}</p>

      <TimeSet seconds={seconds} onComplete={onDone} autoStart />

      {nextLabel && (
        <p className="text-dim text-sm text-center px-6">
          <span className="block text-[11px] uppercase tracking-widest mb-1">{t('session.nextUp')}</span>
          <span className="text-ink font-semibold">{nextLabel}</span>
        </p>
      )}

      <button type="button" onClick={onDone} className="gp-ghost">
        {t('session.skipRest')} →
      </button>
    </div>
  );
}
