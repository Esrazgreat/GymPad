import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n/index.jsx';

/**
 * Sign-in.
 *
 * One screen, two modes. With Supabase configured it sends a magic link (no
 * password to remember — a real usability win on shared and low-end devices).
 * Without it, a one-tap local session so the app is never a dead end.
 *
 * Guests can reach the exercise library without an account; only plan
 * generation needs identity.
 */
export default function SignIn() {
  const { t, lang } = useI18n();
  const { mode, signInWithEmail, signInDev, magicLinkSentTo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const destination = location.state?.from ?? '/';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'magic_link') {
        await signInWithEmail(email.trim(), name.trim());
      } else {
        await signInDev({ displayName: name.trim() || undefined, lang });
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  if (magicLinkSentTo) {
    return (
      <main className="gp-shell min-h-dvh flex flex-col justify-center">
        <div className="gp-card p-8 text-center animate-riseIn">
          <div className="text-5xl mb-4" aria-hidden="true">📬</div>
          <h1 className="text-2xl font-display mb-3">{t('auth.checkEmail')}</h1>
          <p className="text-dim leading-relaxed">
            {t('auth.checkEmailBody', { email: magicLinkSentTo })}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="gp-shell min-h-dvh flex flex-col justify-center !pb-8">
      <Header />

      <div className="gp-card p-6 animate-riseIn">
        <h1 className="text-2xl font-display mb-2">{t('auth.welcome')}</h1>
        <p className="text-dim text-sm mb-6">
          {mode === 'magic_link' ? t('auth.subtitle') : t('auth.devNotice')}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="gp-label" htmlFor="name">
              {t('auth.nameLabel')}
            </label>
            <input
              id="name"
              className="gp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              autoComplete="name"
            />
          </div>

          {mode === 'magic_link' && (
            <div>
              <label className="gp-label" htmlFor="email">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                className="gp-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                inputMode="email"
              />
            </div>
          )}

          {error && (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="gp-btn w-full" disabled={busy}>
            {busy ? t('common.loading') : mode === 'magic_link' ? t('auth.sendLink') : t('auth.devSignIn')}
          </button>
        </form>
      </div>

      <Link to="/library" className="text-dim text-sm text-center mt-6 hover:text-ink transition-colors">
        {t('auth.guest')} →
      </Link>

      <p className="text-center text-xs text-dim/70 mt-8">{t('app.free')}</p>
    </main>
  );
}
