/*
  This file configures Tailwind CSS for the frontend of the inventory management system.
  It specifies the content files to scan for class names, enables dark mode,
    and extends the default theme with custom colors.
*/
/** @type {import('tailwindcss').Config} */
const path = require('path');
module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,jsx,ts,tsx}'),
    // Local monorepo (repo/packages/ui)
    path.join(__dirname, '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'),
    // Docker volume mount (/app/packages/ui)
    path.join(__dirname, 'packages/ui/src/**/*.{js,jsx,ts,tsx}'),
    // Symlinked package in node_modules
    path.join(__dirname, 'node_modules/@tcdona/ui/src/**/*.{js,jsx,ts,tsx}'),
    // Absolute Docker path (belt-and-suspenders)
    '/app/packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Accent color (purple/violet theme)
        accent: {
          DEFAULT: 'hsl(270, 70%, 50%)',
          light: 'hsl(270, 70%, 60%)',
          dark: 'hsl(270, 70%, 40%)',
        },
      },
    },
  },
  plugins: [],
  //safelist: ['bg-blue-600', 'hover:bg-blue-700', 'text-black', 'disabled:bg-blue-400'],
}
