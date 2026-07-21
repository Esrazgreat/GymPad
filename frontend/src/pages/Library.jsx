import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import ExerciseDemo from '../components/ExerciseDemo.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { getDisplay } from '../lib/exercises.js';

/**
 * The exercise library — the one screen open to guests.
 *
 * Letting people see the demos and form cues before creating an account is the
 * whole "try before you commit" path. It needs no auth, so it also works as a
 * standalone reference for someone who never signs up.
 */

const GROUPS = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core', 'full_body'];

export default function Library() {
  const { t, pick, lang } = useI18n();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('all');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.exercises()
      .then(({ exercises: list }) => setExercises(list))
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (group === 'all' ? exercises : exercises.filter((e) => e.muscleGroup === group)),
    [exercises, group],
  );

  return (
    <main className="gp-shell">
      <Header
        title={t('home.exploreLibrary')}
        right={<Link to="/" className="gp-chip !min-h-[36px]">←</Link>}
      />

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 gp-hide-scroll">
        <button
          type="button" onClick={() => setGroup('all')}
          aria-pressed={group === 'all'} className="gp-chip shrink-0"
        >
          {t('common.all')} {exercises.length > 0 && `(${exercises.length})`}
        </button>
        {GROUPS.map((g) => (
          <button
            key={g} type="button" onClick={() => setGroup(g)}
            aria-pressed={group === g} className="gp-chip shrink-0"
          >
            {t(`progress.groups.${g}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="gp-skeleton h-16" />)}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((exercise) => {
            const display = getDisplay(exercise.id);
            const cues = display.cues[lang] ?? display.cues.en ?? [];
            const isOpen = openId === exercise.id;

            return (
              <li key={exercise.id} className="gp-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : exercise.id)}
                  aria-expanded={isOpen}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{pick(display.name)}</p>
                    <p className="text-dim text-xs mt-0.5">
                      {t(`progress.groups.${exercise.muscleGroup}`)} ·{' '}
                      {exercise.equipment.map((eq) => t(`equipment.${eq}`)).join(', ')}
                    </p>
                  </div>
                  <span className="text-dim shrink-0" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 animate-riseIn">
                    <ExerciseDemo exerciseId={exercise.id} height={220} />
                    {cues.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {cues.map((cue, i) => (
                          <li key={i} className="text-dim text-sm flex gap-2">
                            <span className="text-gold shrink-0" aria-hidden="true">›</span>
                            {cue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
