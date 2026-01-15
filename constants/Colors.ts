// Foundry Lab color palette - Glass-morphic Industrial Blue
// Deep blacks with blue accents and glass effects

export const Colors = {
  // Primary dark palette - deeper blacks
  void: {
    950: '#020202', // Deepest background
    900: '#0A0A0A', // Primary background
    850: '#0F0F0F', // Slightly elevated
    800: '#121212', // Card backgrounds
  },
  // Graphite scale - for glass effects and text
  graphite: {
    900: '#1A1A1A', // Dark surfaces
    800: '#242424', // Elevated surfaces
    700: '#2E2E2E', // Borders on dark
    600: '#3D3D3D',
    500: '#525252',
    400: '#6B6B6B', // Secondary text
    300: '#878787',
    200: '#A5A5A5',
    100: '#C4C4C4',
    50: '#E6E6E6',  // Primary text
  },
  // Signal blue - primary accent (industrial blue)
  signal: {
    700: '#1D4ED8',
    600: '#2563EB', // Primary blue
    500: '#3B82F6', // Bright blue
    400: '#60A5FA', // Light blue
    300: '#93C5FD',
    200: '#BFDBFE',
    glow: 'rgba(59, 130, 246, 0.4)', // For shadows
  },
  // Emerald - for completion/success states
  emerald: {
    600: '#059669',
    500: '#10B981', // Primary emerald
    400: '#34D399',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  // Regression/error - for issues
  regression: {
    600: '#DC2626',
    500: '#EF4444',
    400: '#F87171',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  // Oxide orange - sparingly for highlights
  oxide: {
    600: '#D97706',
    500: '#F59E0B',
    400: '#FBBF24',
  },
  // Aliases to match Tailwind config
  progress: {
    600: '#059669', // Same as emerald
    500: '#10B981',
    400: '#34D399',
  },
  warning: {
    600: '#D97706', // Same as oxide
    500: '#F59E0B',
    400: '#FBBF24',
  },
  // Glass effects - for translucent overlays
  glass: {
    white: {
      2: 'rgba(255, 255, 255, 0.02)',
      5: 'rgba(255, 255, 255, 0.05)',
      10: 'rgba(255, 255, 255, 0.1)',
      20: 'rgba(255, 255, 255, 0.2)',
    },
    black: {
      20: 'rgba(0, 0, 0, 0.2)',
      40: 'rgba(0, 0, 0, 0.4)',
      60: 'rgba(0, 0, 0, 0.6)',
      80: 'rgba(0, 0, 0, 0.8)',
    },
    blue: {
      5: 'rgba(59, 130, 246, 0.05)',
      10: 'rgba(59, 130, 246, 0.1)',
      20: 'rgba(59, 130, 246, 0.2)',
    },
  },
};

// Theme-based color sets for light/dark mode
// Note: We force dark mode throughout the app
export default {
  light: {
    text: Colors.graphite[50],
    textSecondary: Colors.graphite[400],
    background: Colors.void[900],
    card: Colors.void[800],
    tint: Colors.signal[500],
    border: 'rgba(255, 255, 255, 0.1)',
    tabIconDefault: Colors.graphite[500],
    tabIconSelected: Colors.signal[500],
    accent: Colors.signal[500],
    success: Colors.emerald[500],
    error: Colors.regression[500],
  },
  dark: {
    text: Colors.graphite[50],
    textSecondary: Colors.graphite[400],
    background: Colors.void[900],
    card: Colors.void[800],
    tint: Colors.signal[500],
    border: 'rgba(255, 255, 255, 0.1)',
    tabIconDefault: Colors.graphite[500],
    tabIconSelected: Colors.signal[500],
    accent: Colors.signal[500],
    success: Colors.emerald[500],
    error: Colors.regression[500],
  },
};
