/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      // mobile-first-design-guide.md §2.1 (aligns with md/lg/xl pixel widths)
      screens: {
        tablet: '768px',
        'tablet-l': '1024px',
        desktop: '1280px',
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // High contrast colors for outdoor/field use
        'hc-bg': '#ffffff',
        'hc-bg-dark': '#0f172a',
        'hc-text': '#0f172a',
        'hc-text-dark': '#f8fafc',
        'hc-border': '#334155',
        'hc-border-dark': '#94a3b8',

        // Semantic tokens (Guide §4.1) — values from CSS variables in packages/ui/src/style.css
        'bg-app': 'rgb(var(--color-bg-app) / <alpha-value>)',
        'bg-surface': 'rgb(var(--color-bg-surface) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--color-bg-elevated) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',
        'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
        'primary-light': 'rgb(var(--color-primary-light) / <alpha-value>)',
      },
      // High contrast for field use
      fontSize: {
        'field-sm': ['0.875rem', { lineHeight: '1.5rem' }],
        'field-base': ['1rem', { lineHeight: '1.75rem' }],
        'field-lg': ['1.125rem', { lineHeight: '2rem' }],
        'field-xl': ['1.25rem', { lineHeight: '2.25rem' }],
      },
      spacing: {
        touch: '44px', // Minimum touch target size (WCAG 2.1)
        // mobile-first-design-guide.md §2.1 — notched devices / home indicators
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      // mobile-first-design-guide.md §2.1 — stacking (nav / modal / toast)
      zIndex: {
        nav: '50',
        modal: '100',
        toast: '110',
      },
    },
  },
  plugins: [],
}
