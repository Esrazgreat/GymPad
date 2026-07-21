import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import am from './am.js';

/**
 * Translation layer.
 *
 * `t('intake.stepOf', { current: 2, total: 4 })` → "Step 2 of 4".
 *
 * Two deliberate properties:
 *  • There is NO silent English fallback in Amharic mode. A missing Amharic key
 *    returns the key path itself, which is visibly broken — because a half-
 *    translated screen that looks fine is worse than one that looks wrong. In
 *    development `checkTranslations` logs every gap at startup.
 *  • The chosen language sets `lang` on <html>, so the CSS `:lang(am)` rules
 *    swap in Noto Sans Ethiopic and looser leading automatically.
 */

const DICTS = { en, am };
const STORAGE_KEY = 'gympad.lang';

const I18nContext = createContext(null);

/** Walk a dot path. Returns undefined rather than throwing on a missing branch. */
function lookup(dict, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

/** Replace {placeholders}. */
function interpolate(template, vars) {
  if (typeof template !== 'string' || !vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

function detectInitialLang() {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'am') return stored;
  // Default to Amharic for Ethiopian locales — the primary audience shouldn't
  // have to find a language switcher to read their own app.
  const nav = window.navigator.language || '';
  return nav.toLowerCase().startsWith('am') ? 'am' : 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('lang-am', lang === 'am');
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  useEffect(() => {
    if (import.meta.env.DEV) checkTranslations();
  }, []);

  const t = useCallback(
    (path, vars) => {
      const value = lookup(DICTS[lang], path);
      if (value === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing "${path}" for "${lang}"`);
        return path;
      }
      return interpolate(value, vars);
    },
    [lang],
  );

  /** Arrays (day names, suggestion chips) come back whole. */
  const tList = useCallback(
    (path) => {
      const value = lookup(DICTS[lang], path);
      return Array.isArray(value) ? value : [];
    },
    [lang],
  );

  /** Pick the right side of a {en, am} object returned by the API. */
  const pick = useCallback(
    (bilingual) => {
      if (!bilingual) return '';
      if (typeof bilingual === 'string') return bilingual;
      return bilingual[lang] ?? bilingual.en ?? '';
    },
    [lang],
  );

  const setLang = useCallback((next) => {
    if (next === 'en' || next === 'am') setLangState(next);
  }, []);

  const toggleLang = useCallback(() => setLangState((l) => (l === 'en' ? 'am' : 'en')), []);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, tList, pick, isAmharic: lang === 'am' }),
    [lang, setLang, toggleLang, t, tList, pick],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}

/**
 * Dev-only completeness check: walks the English tree and reports any key the
 * Amharic tree is missing (and vice versa). Catches the "added a string, forgot
 * the translation" bug at startup instead of in front of a user.
 */
export function checkTranslations() {
  const paths = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([key, val]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return val && typeof val === 'object' && !Array.isArray(val) ? paths(val, path) : [path];
    });

  const enPaths = new Set(paths(en));
  const amPaths = new Set(paths(am));

  const missingAm = [...enPaths].filter((p) => !amPaths.has(p));
  const missingEn = [...amPaths].filter((p) => !enPaths.has(p));

  if (missingAm.length) console.warn('[i18n] missing Amharic:', missingAm);
  if (missingEn.length) console.warn('[i18n] missing English:', missingEn);
  if (!missingAm.length && !missingEn.length) {
    console.info(`[i18n] ✓ ${enPaths.size} keys, both languages complete`);
  }
  return { missingAm, missingEn };
}
