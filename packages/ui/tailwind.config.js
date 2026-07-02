import forms from '@tailwindcss/forms'
import scrollbarHide from 'tailwind-scrollbar-hide'
import preset from './tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  plugins: [forms, scrollbarHide],
}
