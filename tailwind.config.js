/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Asks (I am learning) - Blue theme
        ask: {
          primary: '#E0F0FF',
          accent: '#66B2FF',
          'primary-dark': '#1a3a5c',
          'accent-dark': '#4a9eff',
        },
        // Offers (I am teaching) - Green theme
        offer: {
          primary: '#F0FFF5',
          accent: '#00C781',
          'primary-dark': '#0d2e1a',
          'accent-dark': '#00e694',
        },
      },
    },
  },
  plugins: [],
}

