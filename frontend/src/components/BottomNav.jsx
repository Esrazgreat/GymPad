import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

/**
 * Thumb-reachable bottom navigation.
 *
 * Fixed to the bottom with safe-area padding, because this app is used
 * one-handed, standing between sets, on a phone. Every target is ≥56px tall.
 */

const TABS = [
  { to: '/', key: 'home', icon: '🏠', end: true },
  { to: '/plan', key: 'plan', icon: '🗓️' },
  { to: '/progress', key: 'progress', icon: '📈' },
  { to: '/coach', key: 'coach', icon: '🤖' },
];

export default function BottomNav() {
  const { t } = useI18n();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#150C24]/95 backdrop-blur-lg"
      style={{ paddingBottom: 'var(--gp-safe-bottom)' }}
      aria-label={t('nav.home')}
    >
      <ul className="max-w-[560px] mx-auto grid grid-cols-4">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-bold transition-colors',
                  isActive ? 'text-ink' : 'text-dim hover:text-ink/80',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`text-lg leading-none transition-transform ${isActive ? 'scale-110' : ''}`}
                  >
                    {tab.icon}
                  </span>
                  <span className="truncate max-w-full px-1">{t(`nav.${tab.key}`)}</span>
                  {/* Colour is never the only active indicator — there's a bar too. */}
                  <span
                    aria-hidden="true"
                    className={`h-[3px] w-6 rounded-full transition-all ${
                      isActive ? 'bg-flame' : 'bg-transparent'
                    }`}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
