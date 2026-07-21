import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useI18n } from '../i18n/index.jsx';

/**
 * Goal + duration picker.
 *
 * Two decisions only, then straight into the health check. Everything else the
 * planner needs is asked in the intake — this screen exists to establish intent
 * quickly, not to collect data.
 */

const DURATIONS = [1, 4, 12, 26, 52];
const PHASE_COUNT = { 1: 1, 4: 2, 12: 3, 26: 4, 52: 6 };

export default function Plans() {
  const { t, tList } = useI18n();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [weeks, setWeeks] = useState(null);

  const durationLabels = tList('plans.durations');

  const proceed = () => {
    navigate('/intake', { state: { goal, duration_weeks: weeks } });
  };

  return (
    <main className="gp-shell">
      <Header title={t('plans.chooseGoal')} subtitle={t('plans.goalSubtitle')} />

      {/* ── Goal ──────────────────────────────────────────────────────────── */}
      <div className="grid gap-3 mb-8">
        {[
          { id: 'build', icon: '🏋️', title: t('plans.buildGoal'), desc: t('plans.buildDesc') },
          { id: 'loss', icon: '🔥', title: t('plans.lossGoal'), desc: t('plans.lossDesc') },
        ].map((option) => {
          const selected = goal === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setGoal(option.id)}
              aria-pressed={selected}
              className={`gp-card p-5 text-left transition-all ${
                selected ? 'border-orange bg-orange/10 shadow-glowSoft' : 'hover:border-white/25'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0" aria-hidden="true">{option.icon}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-display mb-1 flex items-center gap-2">
                    {option.title}
                    {/* A tick, not just colour — colour is never the sole signal. */}
                    {selected && <span className="text-gold text-base" aria-hidden="true">✓</span>}
                  </h2>
                  <p className="text-dim text-sm leading-relaxed">{option.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Duration ──────────────────────────────────────────────────────── */}
      <div className={goal ? 'animate-riseIn' : 'opacity-40 pointer-events-none'}>
        <h2 className="text-lg font-display mb-1">{t('plans.chooseDuration')}</h2>
        <p className="text-dim text-sm mb-4">{t('plans.durationSubtitle')}</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {DURATIONS.map((value, index) => {
            const selected = weeks === value;
            const phases = PHASE_COUNT[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setWeeks(value)}
                aria-pressed={selected}
                className={`gp-card p-4 text-left transition-all ${
                  selected ? 'border-orange bg-orange/10' : 'hover:border-white/25'
                }`}
              >
                <div className="font-display text-base mb-0.5">{durationLabels[index]}</div>
                <div className="text-dim text-xs">
                  {phases === 1 ? t('plans.onePhase') : t('plans.phasesLabel', { count: phases })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={proceed} disabled={!goal || !weeks} className="gp-btn w-full">
        {t('plans.startHealthCheck')}
      </button>
    </main>
  );
}
