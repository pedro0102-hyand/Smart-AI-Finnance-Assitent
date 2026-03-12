/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        // ── Paleta dark ──────────────────────────────
        graphite: {
          950: '#0a0a0b',
          900: '#111113',
          800: '#1a1a1e',
          700: '#242429',
          600: '#2e2e35',
          500: '#3a3a44',
        },
        // ── Paleta light ─────────────────────────────
        ivory: {
          50:  '#fafaf7',
          100: '#f4f4ef',
          200: '#eaeae2',
          300: '#d8d8ce',
        },
        // ── Acento âmbar dourado ─────────────────────
        amber: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // ── Semânticas ───────────────────────────────
        success: '#4ade80',
        danger:  '#f87171',
        warning: '#fbbf24',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card-dark':  '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)',
        'card-light': '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        'glow-amber': '0 0 24px rgba(251,191,36,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                    to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

