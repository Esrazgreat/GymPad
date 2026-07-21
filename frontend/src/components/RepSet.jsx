import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { completeBeep, hapticRep, hapticSet, primeAudio } from '../lib/feedback.js';

/**
 * Tap-to-count widget for rep-based work.
 *
 * The whole circle is the button and it fills the width of the card, because
 * this is tapped with a thumb, mid-set, while out of breath. Every rep gives a
 * short haptic; reaching the target beeps, vibrates, and auto-advances.
 *
 * `onComplete` is fired from an effect keyed on the count rather than inside the
 * tap handler, so a rapid double-tap at the target can't fire it twice.
 */
export default function RepSet({ target, onComplete }) {
  const { t } = useI18n();
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    setCount(0);
    firedRef.current = false;
  }, [target]);

  useEffect(() => {
    if (count >= target && !firedRef.current) {
      firedRef.current = true;
      completeBeep();
      hapticSet();
      // Brief pause so the user sees the completed count before the screen moves.
      const id = setTimeout(() => onComplete?.(count), 550);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [count, target, onComplete]);

  const tap = useCallback(() => {
    primeAudio();
    hapticRep();
    setBump((b) => b + 1);
    setCount((c) => Math.min(target, c + 1));
  }, [target]);

  const undo = useCallback(() => {
    firedRef.current = false;
    setCount((c) => Math.max(0, c - 1));
  }, []);

  const pct = target > 0 ? Math.min(1, count / target) : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={tap}
        disabled={count >= target}
        aria-label={t('session.tapToCount')}
        className="relative rounded-full flex items-center justify-center select-none transition-transform active:scale-[0.97] disabled:active:scale-100"
        style={{
          width: 200,
          height: 200,
          background: `conic-gradient(#FF6B35 ${pct * 360}deg, rgba(255,255,255,0.07) ${pct * 360}deg)`,
        }}
      >
        {/* Inner disc — leaves the conic gradient visible as a progress ring. */}
        <span
          className="absolute rounded-full bg-[#1B1030] border border-white/10"
          style={{ inset: 12 }}
          aria-hidden="true"
        />
        {/* Expanding pulse on each tap, as immediate visual confirmation. */}
        <span
          key={bump}
          className="absolute rounded-full border-2 border-orange animate-pulseRing pointer-events-none"
          style={{ inset: 12 }}
          aria-hidden="true"
        />
        <span className="relative flex flex-col items-center">
          <span className="gp-num text-giga leading-none text-ink" aria-live="polite" aria-atomic="true">
            {count}
          </span>
          <span className="text-dim text-sm font-bold mt-1">
            / {target} {t('common.reps')}
          </span>
        </span>
      </button>

      <p className="text-dim text-xs">{t('session.tapHint')}</p>

      <button type="button" onClick={undo} className="gp-ghost !min-h-[40px] !py-2 text-sm" disabled={count === 0}>
        −1
      </button>
    </div>
  );
}
