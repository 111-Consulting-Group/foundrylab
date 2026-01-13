/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Foundry Lab brand colors - industrial lab theme
        carbon: {
          950: '#0E1116',
        },
        graphite: {
          950: '#0E1116',
          900: '#1C222B',
          800: '#282F3A',
          700: '#353D4B',
          600: '#424B5C',
          500: '#525C6E',
          400: '#6B7485',
          300: '#878E9C',
          200: '#A5ABB6',
          100: '#C4C8D0',
          50: '#E6E8EB',
        },
        signal: {
          600: '#1E5FBF',
          500: '#2F80ED',
          400: '#5B9DEF',
          300: '#8BBAF2',
        },
        oxide: {
          600: '#D77A32',
          500: '#F2994A',
          400: '#F5AD6F',
        },
        progress: {
          600: '#1F8A4D',
          500: '#27AE60',
          400: '#51C17E',
        },
        regression: {
          600: '#C93B3B',
          500: '#EB5757',
          400: '#EF7A7A',
        },
        success: {
          500: '#27AE60',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        'lab-mono': ['JetBrains Mono', 'Courier', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
