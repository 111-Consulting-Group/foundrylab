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
        // Foundry Lab - Glass-morphic Industrial Blue
        void: {
          950: '#020202',
          900: '#0A0A0A',
          850: '#0F0F0F',
          800: '#121212',
        },
        graphite: {
          950: '#0A0A0A',
          900: '#1A1A1A',
          800: '#242424',
          700: '#2E2E2E',
          600: '#3D3D3D',
          500: '#525252',
          400: '#6B6B6B',
          300: '#878787',
          200: '#A5A5A5',
          100: '#C4C4C4',
          50: '#E6E6E6',
        },
        signal: {
          700: '#1D4ED8',
          600: '#2563EB',
          500: '#3B82F6',
          400: '#60A5FA',
          300: '#93C5FD',
          200: '#BFDBFE',
        },
        emerald: {
          700: '#047857',
          600: '#059669',
          500: '#10B981',
          400: '#34D399',
          300: '#6EE7B7',
        },
        regression: {
          600: '#DC2626',
          500: '#EF4444',
          400: '#F87171',
        },
        oxide: {
          600: '#D97706',
          500: '#F59E0B',
          400: '#FBBF24',
        },
        // Legacy aliases for compatibility
        carbon: {
          950: '#0A0A0A',
        },
        progress: {
          600: '#059669',
          500: '#10B981',
          400: '#34D399',
        },
        success: {
          500: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        'lab-mono': ['JetBrains Mono', 'Courier', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      backdropBlur: {
        '2xl': '40px',
        '3xl': '64px',
      },
      boxShadow: {
        'glow-blue': '0 0 20px -5px rgba(59, 130, 246, 0.4)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.4)',
        'glow-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
