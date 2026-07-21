/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // ── Neon Sunset ──────────────────────────────────────────────────────
      // Dark violet night sky, hot orange energy. One accent family (orange →
      // gold) carries every call-to-action and progress indicator; cyan is used
      // sparingly for secondary data so the accent never loses its meaning.
      colors: {
        bg: '#120A1F',
        bg2: '#1B1030',
        panelSolid: '#221540',
        ink: '#F5F0FF',
        dim: '#A79BC8',
        orange: '#FF6B35',
        gold: '#FFC53D',
        cyan: '#35E0D0',
        danger: '#FF4D6D',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        ethiopic: ['"Noto Sans Ethiopic"', 'system-ui', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Oversized numerics for the live workout screen.
        mega: ['4.5rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        giga: ['6rem', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
      },
      boxShadow: {
        glow: '0 8px 30px rgba(255,107,53,0.35)',
        glowSoft: '0 4px 20px rgba(255,107,53,0.18)',
        cyanGlow: '0 8px 30px rgba(53,224,208,0.25)',
      },
      backgroundImage: {
        flame: 'linear-gradient(90deg, #FF6B35, #FFC53D)',
        flameV: 'linear-gradient(180deg, #FF6B35, #FFC53D)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        riseIn: 'riseIn 0.35s ease-out both',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
        pop: 'pop 0.32s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
