/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        tea: {
          50:  '#f0f7f4',
          100: '#dceee6',
          200: '#b9dece',
          300: '#8ec7b0',
          400: '#5fab90',
          500: '#3d9072',
          600: '#2D6A4F', // 메인 컬러
          700: '#255840',
          800: '#1e4633',
          900: '#173829',
        },
        gold: {
          50:  '#fdf9ec',
          100: '#faf0cc',
          200: '#f5e09a',
          300: '#edca61',
          400: '#e5b535',
          500: '#D4A017', // 포인트 컬러
          600: '#b88213',
          700: '#8f6011',
          800: '#754e14',
          900: '#634115',
        },
        cream: {
          50:  '#FAFAF5',
          100: '#F5F5DC',
          200: '#EFEFC0',
        },
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
