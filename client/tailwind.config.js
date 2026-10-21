/** @type {import('tailwindcss').Config} */
// Semantic palette: ink = text, sand = neutral surfaces/borders, teal = brand,
// amber = accent/warning, moss = success, rust = danger.
// Shades used with white text (teal-600, amber-600, rust-600) meet WCAG AA.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0F172A', soft: '#334155', mute: '#64748B' },
        sand: { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1' },
        teal: { 50: '#F0FDFA', 100: '#CCFBF1', 500: '#0D9488', 600: '#0F766E', 700: '#115E59', 900: '#042F2E' },
        amber: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#B45309', 700: '#92400E' },
        moss: { 50: '#ECFDF5', 500: '#10B981', 600: '#047857' },
        rust: { 50: '#FEF2F2', 500: '#EF4444', 600: '#B91C1C' },
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.05), 0 1px 3px rgba(15,23,42,.05)',
        lift: '0 4px 6px -2px rgba(15,23,42,.05), 0 16px 32px -12px rgba(15,23,42,.18)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        rise: { '0%': { transform: 'translateY(6px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: { pop: 'pop .18s ease-out', rise: 'rise .35s ease-out both' },
    },
  },
  plugins: [],
};
