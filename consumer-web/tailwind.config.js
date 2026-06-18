/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        tea: {
          50:  '#f0faf4', 100: '#dcf5e7', 200: '#bbead0', 300: '#8dd8b1',
          400: '#59bf8a', 500: '#35a36c', 600: '#268457', 700: '#1f6844',
          800: '#1c5538', 900: '#19452f',
        },
        cream: { 50: '#fdfaf5', 100: '#faf4e8' },
      },
    },
  },
  plugins: [],
};
