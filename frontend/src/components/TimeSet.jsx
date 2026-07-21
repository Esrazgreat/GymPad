import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { completeBeep, goBeep, hapticSet, primeAudio, tickBeep } from '../lib/feedback.js';

/**
 * Countdown widget for time-based work (planks, intervals, walks).
 *
 * Implementation notes that matter:
 *  • The interval callback reads a DEADLINE (an absolute timestamp) rather than
 *    decrementing a counter. setInterval drifts, and a phone that sleeps
 *    mid-plank will fire far fewer ticks than it should — deriving remaining
 *    time from the clock makes both harmless.
 *  • The interval id lives in a ref, never in state, so it can be cleared from
 *    any closure without stale-state bugs.
 *  • Last three seconds beep, and completion beeps + vibrates, because nobody
 *    is watching the screen while holding a plank.
 */
export default function TimeSet({ seconds, onComplete, autoStart = false }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);

  const intervalRef = useRef(null);
  const deadlineRef = useRef(null);
  const lastBeepedRef = useRef(null);
  const completedRef = useRef(false);

  // Reset whenever the prescribed duration changes (moving to the next set).
  useEffect(() => {
    setRemaining(seconds);
    setRunning(autoStart);
    completedRef.current = false;
    lastBeepedRef.current = null;
    deadlineRef.current = autoStart ? Date.now() + seconds * 1000 : null;
  }, [seconds, autoStart]);

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!running) {
      stopInterval();
      return undefined;
    }

    if (deadlineRef.current === null) deadlineRef.current = Date.now() + remaining * 1000;

    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 3 && left > 0 && lastBeepedRef.current !== left) {
        lastBeepedRef.current = left;
        tickBeep();
      }

      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        stopInterval();
        setRunning(false);
        completeBeep();
        hapticSet();
        onComplete?.();
      }
    }, 200); // sub-second so the display never visibly lags the real clock

    return stopInterval;
    // `remaining` intentionally omitted — the deadline is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, onComplete]);

  const start = useCallback(() => {
    primeAudio();
    goBeep();
    deadlineRef.current = Date.now() + remaining * 1000;
    completedRef.current = false;
    setRunning(true);
  }, [remaining]);

  const pause = useCallback(() => {
    setRunning(false);
    deadlineRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    stopInterval();
    deadlineRef.current = null;
    completedRef.current = false;
    lastBeepedRef.current = null;
    setRemaining(seconds);
  }, [seconds]);

  // SVG ring geometry
  const RADIUS = 78;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const offset = CIRCUMFERENCE * (1 - progress);

  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const display = remaining >= 60 ? `${mm}:${ss}` : String(remaining);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg width="200" height="200" className="-rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="12" />
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="url(#timeGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
          />
          <defs>
            <linearGradient id="timeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF6B35" />
              <stop offset="100%" stopColor="#FFC53D" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`gp-num text-mega ${remaining <= 3 && running ? 'text-gold animate-pop' : 'text-ink'}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {display}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-dim font-bold mt-1">
            {t('common.seconds')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!running ? (
          <button type="button" onClick={start} className="gp-btn px-8" disabled={remaining === 0}>
            {remaining === seconds ? t('session.startTimer') : t('session.resume')}
          </button>
        ) : (
          <button type="button" onClick={pause} className="gp-ghost px-8">
            {t('session.pause')}
          </button>
        )}
        <button type="button" onClick={reset} className="gp-ghost">
          {t('session.reset')}
        </button>
      </div>
    </div>
  );
}
