import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zoca: {
          blue: '#1f4e78',
          blueDeep: '#163a5a',
          accent: '#2563eb',
          pink: '#ec4899',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
