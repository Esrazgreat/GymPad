import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { LanguageProvider } from './i18n/index.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';
import { api } from './lib/api.js';
import './styles/globals.css';

// Wake the free-tier backend the instant the app loads, so its ~30–60s cold
// start overlaps with the user reading the first screen instead of stalling
// their first real action. Fire-and-forget; failures are irrelevant here.
api.health().catch(() => {});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
