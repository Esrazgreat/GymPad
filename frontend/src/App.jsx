import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import { useAuth } from './hooks/useAuth.jsx';
import { useI18n } from './i18n/index.jsx';
import { api } from './lib/api.js';
import { assertCatalogParity } from './lib/exercises.js';

import SignIn from './pages/SignIn.jsx';
import Home from './pages/Home.jsx';
import Plans from './pages/Plans.jsx';
import Intake from './pages/Intake.jsx';
import MyPlan from './pages/MyPlan.jsx';
import Session from './pages/Session.jsx';
import Progress from './pages/Progress.jsx';
import Coach from './pages/Coach.jsx';
import Library from './pages/Library.jsx';

function FullScreenLoader() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-orange animate-spin" />
      <p className="text-dim text-sm">{t('common.loading')}</p>
    </div>
  );
}

/** Routes that need an account. Guests get bounced to sign-in. */
function Protected({ children }) {
  const { isSignedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!isSignedIn) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const { isSignedIn, loading } = useAuth();
  const location = useLocation();

  // Dev-only: verify the frontend display catalog matches the backend catalog.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    api.exercises()
      .then(({ exercises }) => assertCatalogParity(exercises))
      .catch(() => {});
  }, []);

  // The live workout screen hides the nav — it is a focused, full-screen mode.
  const hideNav = location.pathname.startsWith('/session') || location.pathname === '/signin';

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/signin" element={isSignedIn ? <Navigate to="/" replace /> : <SignIn />} />
        <Route path="/library" element={<Library />} />

        <Route path="/" element={<Home />} />
        <Route path="/plans" element={<Protected><Plans /></Protected>} />
        <Route path="/intake" element={<Protected><Intake /></Protected>} />
        <Route path="/plan" element={<Protected><MyPlan /></Protected>} />
        <Route path="/session" element={<Protected><Session /></Protected>} />
        <Route path="/progress" element={<Protected><Progress /></Protected>} />
        <Route path="/coach" element={<Protected><Coach /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideNav && <BottomNav />}
    </div>
  );
}
