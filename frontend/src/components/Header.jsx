import { useI18n } from '../i18n/index.jsx';

/**
 * App header: brand mark + language switcher.
 *
 * The language pill is always visible, on every screen. Burying a language
 * toggle in a settings menu is a common failure in bilingual apps — the person
 * who most needs it is the one least able to read the menu that hides it.
 */
export default function Header({ title, subtitle, right }) {
  const { t, lang, toggleLang } = useI18n();

  return (
    <header className="flex items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        {title ? (
          <>
            <h1 className="text-2xl font-display truncate">{title}</h1>
            {subtitle && <p className="text-dim text-sm mt-1">{subtitle}</p>}
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display gp-gradient-text">{t('app.name')}</span>
            </div>
            <p className="text-dim text-sm mt-0.5">{t('app.tagline')}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {right}
        <button
          type="button"
          onClick={toggleLang}
          className="gp-chip !min-h-[36px] !px-3"
          // Stable, language-independent hook. Selecting this button by its
          // visible text or aria-label is impossible from a test, because both
          // change with the very setting the button controls.
          data-testid="lang-toggle"
          aria-label={`${t('lang.label')}: ${lang === 'en' ? 'English' : 'አማርኛ'}`}
          title={t('lang.label')}
        >
          <span className={lang === 'en' ? 'font-ethiopic' : ''}>{t('lang.switchTo')}</span>
        </button>
      </div>
    </header>
  );
}
