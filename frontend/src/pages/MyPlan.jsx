import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import ExerciseDemo from '../components/ExerciseDemo.jsx';
import { usePlan, todaysWorkout } from '../hooks/usePlan.js';
import { useI18n } from '../i18n/index.jsx';
import { getDisplay } from '../lib/exercises.js';

/**
 * The programme view: phases → weekly schedule → exercises.
 *
 * Phases are collapsed by default apart from the current one. A 52-week plan is
 * six phases of six days — rendering it all expanded is an unreadable wall, and
 * the only part that matters today is today.
 */
export default function MyPlan() {
  const { t, pick } = useI18n();
  const { plan, position, loading } = usePlan();
  const navigate = useNavigate();
  const [openPhase, setOpenPhase] = useState(position?.phaseIndex ?? 0);
  const [openDay, setOpenDay] = useState(null);

  if (loading) {
    return (
      <main className="gp-shell">
        <Header title={t('plan.title')} />
        <div className="space-y-3">
          <div className="gp-skeleton h-28" />
          <div className="gp-skeleton h-20" />
          <div className="gp-skeleton h-20" />
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="gp-shell">
        <Header title={t('plan.title')} />
        <div className="gp-card p-8 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">🗓️</div>
          <p className="text-dim mb-6">{t('plan.noPlan')}</p>
          <Link to="/plans" className="gp-btn">{t('home.buildPlan')}</Link>
        </div>
      </main>
    );
  }

  const today = todaysWorkout(plan, position);

  return (
    <main className="gp-shell">
      <Header
        title={t('plan.title')}
        subtitle={`${plan.goal === 'loss' ? t('plans.lossGoal') : t('plans.buildGoal')} · ${t('plan.weeksLong', { count: plan.duration_weeks })}`}
      />

      {/* Today */}
      {today && (
        <section className="gp-card p-5 mb-6 border-orange/30">
          <p className="text-[11px] uppercase tracking-widest text-gold font-bold mb-1">{t('plan.todayIs')}</p>
          <h2 className="text-xl font-display mb-3">{pick(today.day.dayLabel)}</h2>
          <button type="button" onClick={() => navigate('/session')} className="gp-btn w-full">
            {t('plan.startSession')}
          </button>
        </section>
      )}

      {plan.recommended_split && (
        <p className="text-dim text-sm mb-6">
          <span className="gp-label inline !mb-0">{t('plan.split')}: </span>
          {plan.recommended_split}
        </p>
      )}

      {/* Phases */}
      <div className="space-y-3">
        {plan.phases.map((phase, phaseIndex) => {
          const isOpen = openPhase === phaseIndex;
          const isCurrent = phaseIndex === position?.phaseIndex;

          return (
            <section key={phaseIndex} className={`gp-card overflow-hidden ${isCurrent ? 'border-orange/40' : ''}`}>
              <button
                type="button"
                onClick={() => setOpenPhase(isOpen ? -1 : phaseIndex)}
                aria-expanded={isOpen}
                className="w-full p-4 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-widest text-dim font-bold">
                      {t('plan.phase')} {phase.phaseNumber}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-pill bg-flame text-[#1a0d08] font-black uppercase">
                        {t('plan.week')} {position?.weekInPhase}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg truncate">{pick(phase.label)}</h3>
                  <p className="text-dim text-xs">{t('plan.weeksLong', { count: phase.durationWeeks })}</p>
                </div>
                <span className={`text-dim transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 animate-riseIn">
                  <p className="text-dim text-sm leading-relaxed mb-4 pb-4 border-t border-white/10 pt-4">
                    <span className="gp-label">{t('plan.focusThisPhase')}</span>
                    {pick(phase.focusDescription)}
                  </p>

                  <div className="space-y-2">
                    {phase.weeklySchedule.map((day, dayIndex) => {
                      const key = `${phaseIndex}-${dayIndex}`;
                      const dayOpen = openDay === key;
                      return (
                        <div key={key} className="gp-card-solid overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setOpenDay(dayOpen ? null : key)}
                            aria-expanded={dayOpen}
                            className="w-full px-3 py-3 flex items-center justify-between gap-2 text-left"
                          >
                            <span className="font-bold text-sm truncate">{pick(day.dayLabel)}</span>
                            <span className="text-dim text-xs shrink-0">
                              {day.exercises.length} {t('plan.exercises')}
                            </span>
                          </button>

                          {dayOpen && (
                            <ul className="divide-y divide-white/5 animate-riseIn">
                              {day.exercises.map((ex, i) => (
                                <ExerciseRow key={`${ex.id}-${i}`} prescription={ex} />
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function ExerciseRow({ prescription }) {
  // All hooks at the top level of the component — never inside JSX or a helper.
  const { t, pick, lang } = useI18n();
  const [showDemo, setShowDemo] = useState(false);
  const display = getDisplay(prescription.id);
  const cues = display.cues[lang] ?? display.cues.en ?? [];

  const dose = prescription.reps > 0
    ? `${prescription.sets} × ${prescription.reps} ${t('common.reps')}`
    : `${prescription.sets} × ${prescription.timeSeconds}${t('common.seconds')}`;

  return (
    <li className="px-3 py-3">
      <button
        type="button"
        onClick={() => setShowDemo((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
        aria-expanded={showDemo}
      >
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{pick(display.name)}</p>
          <p className="text-dim text-xs mt-0.5">
            {dose} · {t('plan.rest')} {prescription.restSeconds}s
          </p>
        </div>
        <span className="text-dim text-xs shrink-0 mt-0.5" aria-hidden="true">{showDemo ? '▴' : '▾'}</span>
      </button>

      {showDemo && (
        <div className="mt-3 animate-riseIn">
          <ExerciseDemo exerciseId={prescription.id} height={200} />

          {cues.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {cues.map((cue, i) => (
                <li key={i} className="text-dim text-xs flex gap-2">
                  <span className="text-gold shrink-0" aria-hidden="true">›</span>
                  {cue}
                </li>
              ))}
            </ul>
          )}

          {prescription.modification && (
            <p className="mt-3 text-xs text-cyan/90 bg-cyan/10 border border-cyan/30 rounded-lg p-2.5">
              <strong className="block mb-0.5">{t('plan.modification')}</strong>
              {prescription.modification}
            </p>
          )}
          {prescription.safetyNote && (
            <p className="mt-2 text-xs text-gold/90 bg-gold/10 border border-gold/30 rounded-lg p-2.5">
              <strong className="block mb-0.5">{t('plan.safetyNote')}</strong>
              {prescription.safetyNote}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
