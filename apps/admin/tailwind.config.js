import preset from '../../packages/ui/tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  plugins: [],
}
