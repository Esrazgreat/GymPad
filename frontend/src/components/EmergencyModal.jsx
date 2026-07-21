import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

/**
 * Hard-stop safety modal.
 *
 * Shown when a user reports a red-flag symptom during a session. It is
 * deliberately blunt and hard to dismiss by accident:
 *  • It takes over the screen and traps focus.
 *  • The emergency numbers are real `tel:` links — one tap to call, because
 *    someone who is dizzy should not be navigating a dialler.
 *  • The dismiss option is a plain ghost button placed AFTER the calls, so the
 *    path of least resistance is getting help, not carrying on.
 *
 * Escape does NOT close it. This is the one dialog in the app where an
 * accidental key press must not make the warning disappear.
 */
export default function EmergencyModal({ open, onDismiss, onEndSession }) {
  const { t } = useI18n();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();

    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Trap Tab inside the dialog.
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll('a[href], button');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = original;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-body"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="gp-card-solid w-full max-w-md p-6 border-danger/70 animate-riseIn outline-none"
      >
        <div className="text-center mb-5">
          <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
          <h2 id="emergency-title" className="text-2xl font-display text-danger">
            {t('emergency.title')}
          </h2>
          <p id="emergency-body" className="text-ink/90 mt-3 leading-relaxed">
            {t('emergency.body')}
          </p>
        </div>

        <div className="space-y-3">
          <a href="tel:907" className="gp-btn w-full !bg-danger !text-white shadow-none">
            <span aria-hidden="true">📞</span> {t('emergency.call907')}
          </a>
          <a href="tel:911" className="gp-btn w-full !bg-danger !text-white shadow-none">
            <span aria-hidden="true">📞</span> {t('emergency.call911')}
          </a>
        </div>

        <p className="text-dim text-xs text-center mt-5 leading-relaxed">{t('emergency.disclaimer')}</p>

        <div className="flex flex-col gap-2 mt-5 pt-5 border-t border-white/10">
          <button type="button" onClick={onEndSession} className="gp-ghost w-full">
            {t('emergency.endSession')}
          </button>
          <button type="button" onClick={onDismiss} className="text-dim text-sm py-2 hover:text-ink transition-colors">
            {t('emergency.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
