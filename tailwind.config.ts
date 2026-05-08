import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary text colors (navy ink)
        ink: 'rgb(10 37 64)',
        'ink-muted': 'rgb(66 69 83)',
        'ink-dim': 'rgb(107 114 128)',
        // Surfaces
        canvas: 'rgb(255 255 255)',
        elevated: 'rgb(249 250 252)',
        line: 'rgb(227 232 238)',
        'line-soft': 'rgb(243 244 246)',
        // Accents
        'accent-pink': 'rgb(236 72 153)',
        'accent-pink-strong': 'rgb(190 24 93)',
        'accent-pink-bg': 'rgb(252 231 243)',
        'accent-purple': 'rgb(139 92 246)',
        'accent-purple-bg': 'rgb(237 233 254)',
        'accent-green': 'rgb(16 185 129)',
        'accent-green-bg': 'rgb(209 250 229)',
        'accent-red': 'rgb(239 68 68)',
        'accent-red-bg': 'rgb(254 226 226)',
        'accent-yellow': 'rgb(245 158 11)',
        'accent-yellow-bg': 'rgb(254 243 199)',
        // Legacy zoca-blue for backward compat
        zoca: {
          blue: '#1f4e78',
          blueDeep: '#163a5a',
          accent: '#2563eb',
          pink: '#ec4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
