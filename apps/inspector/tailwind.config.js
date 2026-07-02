import preset from '../../packages/ui/tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic primary accent — overrides preset blue scale (Guide §4.1); other tokens from @codecomply/ui preset
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
      },
      height: {
        dvh: '100dvh',
        svh: '100svh',
      },
      maxHeight: {
        dvh: '100dvh',
        svh: '100svh',
      },
      minHeight: {
        dvh: '100dvh',
        svh: '100svh',
      },
      padding: {
        safe: 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('tailwind-scrollbar-hide')],
}
