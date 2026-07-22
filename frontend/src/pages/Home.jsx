import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import BigStat from '../components/BigStat.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePlan, todaysWorkout } from '../hooks/usePlan.js';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { getDisplay } from '../lib/exercises.js';

/**
 * Home — the "what do I do right now" screen.
 *
 * Answers one question above the fold: today's session, with a single button to
 * start it. Stats and secondary links come after, because a user opening this at
 * the gym wants to start training, not read a dashboard.
 */
export default function Home() {
  const { t, pick } = useI18n();
  const { isSignedIn, profile } = useAuth();
  const { plan, position, loading, fromCache } = usePlan();
  // Seed from cache so the stat cards show last-known values instantly on
  // refresh, then revalidate in the background.
  const [stats, setStats] = useState(() => cacheGet('progress'));
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSignedIn) return;
    api.progress()
      .then((p) => {
        setStats(p);
        cacheSet('progress', p);
      })
      .catch(() => {});
  }, [isSignedIn]);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'home.morning' : hour < 18 ? 'home.afternoon' : 'home.evening';
  const displayName = profile?.display_name ?? '';

  // ── Guest ────────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <main className="gp-shell">
        <Header />
        <div className="gp-card p-6 text-center animate-riseIn">
          <div className="text-4xl mb-3" aria-hidden="true">💪</div>
          <h2 className="text-xl font-display mb-2">{t('auth.welcome')}</h2>
          <p className="text-dim text-sm mb-6">{t('auth.needAccount')}</p>
          <Link to="/signin" className="gp-btn w-full">
            {t('home.buildPlan')}
          </Link>
        </div>
        <Link to="/library" className="block text-center text-dim text-sm mt-6 hover:text-ink">
          {t('home.exploreLibrary')} →
        </Link>
      </main>
    );
  }

  const today = todaysWorkout(plan, position);

  return (
    <main className="gp-shell">
      <Header
        title={`${t(greetingKey)}${displayName ? `, ${displayName}` : ''}`}
        subtitle={plan ? pick(plan.phases?.[position?.phaseIndex ?? 0]?.label) : t('app.tagline')}
      />

      {fromCache && (
        <p className="text-xs text-gold/80 mb-4 flex items-center gap-2">
          <span aria-hidden="true">⚡</span> {t('common.offline')}
        </p>
      )}

      {/* ── Today ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="gp-skeleton h-44 mb-6" />
      ) : !plan ? (
        <section className="gp-card p-6 mb-6 animate-riseIn">
          <h2 className="text-xl font-display mb-2">{t('home.noPlanTitle')}</h2>
          <p className="text-dim text-sm leading-relaxed mb-5">{t('home.noPlanBody')}</p>
          <button type="button" onClick={() => navigate('/plans')} className="gp-btn w-full">
            {t('home.buildPlan')}
          </button>
        </section>
      ) : (
        <section className="gp-card p-5 mb-6 animate-riseIn border-orange/30">
          <p className="text-[11px] uppercase tracking-widest text-gold font-bold mb-2">
            {t('home.todaysSession')}
          </p>
          <h2 className="text-2xl font-display mb-1">{pick(today?.day?.dayLabel) || t('home.restDay')}</h2>
          <p className="text-dim text-sm mb-4">
            {t('plan.phase')} {position?.phaseNumber} · {t('plan.week')} {position?.weekNumber} ·{' '}
            {today?.day?.exercises?.length ?? 0} {t('plan.exercises')}
          </p>

          {today?.day?.exercises?.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mb-5">
              {today.day.exercises.slice(0, 4).map((ex) => (
                <li key={ex.id} className="gp-chip !min-h-0 !py-1 !px-2.5 !text-[11px] cursor-default">
                  {pick(getDisplay(ex.id).name)}
                </li>
              ))}
              {today.day.exercises.length > 4 && (
                <li className="gp-chip !min-h-0 !py-1 !px-2.5 !text-[11px] cursor-default">
                  +{today.day.exercises.length - 4}
                </li>
              )}
            </ul>
          )}

          <button type="button" onClick={() => navigate('/session')} className="gp-btn w-full">
            {t('home.startWorkout')}
          </button>
        </section>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <BigStat icon="🔥" value={stats?.streak ?? 0} label={t('home.streak')} tone="flame" size="md" />
        <BigStat icon="⏱" value={stats?.weekMin ?? 0} label={t('home.minWeek')} size="md" />
        <BigStat icon="💪" value={stats?.monthCount ?? 0} label={t('home.sessionsMonth')} size="md" />
      </div>

      <Link to="/library" className="block text-center text-dim text-sm hover:text-ink transition-colors">
        {t('home.exploreLibrary')} →
      </Link>
    </main>
  );
}
