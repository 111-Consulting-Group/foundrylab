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
        // Forged brand colors - industrial/forge theme
        forge: {
          50: '#fef7ee',
          100: '#fdecd3',
          200: '#fad5a6',
          300: '#f6b76e',
          400: '#f19034',
          500: '#ed7411', // Primary orange - like molten metal
          600: '#de5a09',
          700: '#b8420a',
          800: '#933510',
          900: '#772e10',
          950: '#401406',
        },
        steel: {
          50: '#f6f7f9',
          100: '#ebedf3',
          200: '#d3d8e4',
          300: '#acb6cc',
          400: '#808fb0',
          500: '#607296',
          600: '#4c5a7c',
          700: '#3e4965',
          800: '#363f55',
          900: '#303848',
          950: '#1e232f', // Dark background
        },
        ember: {
          400: '#fb7185',
          500: '#f43f5e', // Accent for PRs/achievements
          600: '#e11d48',
        },
        success: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
