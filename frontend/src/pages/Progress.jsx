import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Header from '../components/Header.jsx';
import BigStat from '../components/BigStat.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';

/**
 * Progress.
 *
 * Every chart carries a plain-language caption underneath saying what it means.
 * A chart without a caption asks the user to interpret their own health data,
 * which most people will do pessimistically — the captions do the interpreting,
 * and they are written to be encouraging without being dishonest.
 *
 * All axis labels and tooltips render in the active language.
 */

const AXIS = { stroke: '#A79BC8', fontSize: 11 };
const GRID = 'rgba(255,255,255,0.07)';

function ChartCard({ title, caption, children, height = 200 }) {
  return (
    <section className="gp-card p-4 mb-4">
      <h2 className="font-display text-base mb-3">{title}</h2>
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      <p className="text-dim text-xs leading-relaxed mt-3">{caption}</p>
    </section>
  );
}

function ChartTooltip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="gp-card-solid px-3 py-2 text-xs">
      <p className="text-dim mb-0.5">{label}</p>
      <p className="font-bold">
        {payload[0].value}
        {suffix ? ` ${suffix}` : ''}
      </p>
    </div>
  );
}

export default function Progress() {
  const { t, tList } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.progress()
      .then(setData)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="gp-shell">
        <Header title={t('progress.title')} />
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => <div key={i} className="gp-skeleton h-24" />)}
        </div>
        <div className="gp-skeleton h-56 mb-4" />
        <div className="gp-skeleton h-56" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="gp-shell">
        <Header title={t('progress.title')} />
        <div className="gp-card p-8 text-center">
          <p className="text-dim mb-4">{t('common.somethingWrong')}</p>
          <button type="button" onClick={() => window.location.reload()} className="gp-btn">
            {t('common.retry')}
          </button>
        </div>
      </main>
    );
  }

  const dayNames = tList('progress.days');
  const groupNames = {
    chest: t('progress.groups.chest'), back: t('progress.groups.back'),
    legs: t('progress.groups.legs'), shoulders: t('progress.groups.shoulders'),
    biceps: t('progress.groups.biceps'), triceps: t('progress.groups.triceps'),
    core: t('progress.groups.core'), full_body: t('progress.groups.full_body'),
  };

  const weekData = data.dailyMins.map((minutes, i) => ({
    name: dayNames[data.dayWeekdays[i]] ?? '',
    minutes,
  }));
  const sessionData = data.weeklyCounts.map((sessions, i) => ({
    name: data.weekLabels[i] ?? '',
    sessions,
  }));
  const volumeData = data.volumeTimeline.map((volume, i) => ({
    name: data.weekLabels[i] ?? '',
    volume,
  }));
  const radarData = data.muscleGroupCoverage.map((c) => ({
    group: groupNames[c.group] ?? c.group,
    sets: c.sets,
  }));

  const isEmpty = data.totalSessions === 0;

  return (
    <main className="gp-shell">
      <Header title={t('progress.title')} />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <BigStat icon="🔥" value={data.streak} label={t('progress.streakDays')} tone="flame" />
        <BigStat icon="⏱" value={data.weekMin} label={t('progress.minThisWeek')} />
        <BigStat icon="💪" value={data.monthCount} label={t('progress.sessionsMonth')} />
      </div>

      {isEmpty ? (
        <div className="gp-card p-8 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">📈</div>
          <h2 className="font-display text-lg mb-2">{t('progress.empty')}</h2>
          <p className="text-dim text-sm">{t('progress.emptyBody')}</p>
        </div>
      ) : (
        <>
          <ChartCard title={t('progress.weekMinutes')} caption={t('progress.weekMinutesCaption')}>
            <BarChart data={weekData}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                content={<ChartTooltip suffix={t('common.minutes')} />}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="minutes" fill="#FF6B35" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title={t('progress.weeklySessions')} caption={t('progress.weeklySessionsCaption')}>
            <LineChart data={sessionData}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Line
                type="monotone" dataKey="sessions" stroke="#35E0D0" strokeWidth={2.5}
                dot={{ r: 3, fill: '#35E0D0' }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartCard>

          <ChartCard title={t('progress.muscleCoverage')} caption={t('progress.muscleCoverageCaption')} height={240}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke={GRID} />
              <PolarAngleAxis dataKey="group" tick={{ fill: '#A79BC8', fontSize: 10 }} />
              <Radar dataKey="sets" stroke="#FFC53D" fill="#FF6B35" fillOpacity={0.35} />
              <Tooltip content={<ChartTooltip suffix={t('common.sets')} />} />
            </RadarChart>
          </ChartCard>

          <ChartCard title={t('progress.volume')} caption={t('progress.volumeCaption')}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} width={38} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Area type="monotone" dataKey="volume" stroke="#FFC53D" strokeWidth={2} fill="url(#volFill)" />
            </AreaChart>
          </ChartCard>
        </>
      )}
    </main>
  );
}
