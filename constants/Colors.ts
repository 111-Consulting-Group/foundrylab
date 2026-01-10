// Foundry Lab color palette - Industrial lab aesthetic
// Matches tailwind.config.js theme colors

export const Colors = {
  // Primary palette
  carbon: {
    950: '#0E1116', // Primary background
  },
  graphite: {
    900: '#1C222B', // Surfaces/cards
    800: '#282F3A', // Slightly lighter surfaces
    700: '#353D4B', // Borders
    600: '#424B5C',
    500: '#525C6E',
    400: '#6B7485',
    300: '#878E9C',
    200: '#A5ABB6',
    100: '#C4C8D0',
    50: '#E6E8EB',  // Bone white text
  },
  // Accent colors
  signal: {
    600: '#1E5FBF',
    500: '#2F80ED', // Primary accent (blue)
    400: '#5B9DEF',
    300: '#8BBAF2',
  },
  oxide: {
    600: '#D77A32',
    500: '#F2994A', // Secondary accent (orange) - use sparingly
    400: '#F5AD6F',
  },
  // Feedback colors
  progress: {
    600: '#1F8A4D',
    500: '#27AE60', // Green for improvements
    400: '#51C17E',
  },
  regression: {
    600: '#C93B3B',
    500: '#EB5757', // Red for issues
    400: '#EF7A7A',
  },
  success: {
    500: '#27AE60', // Alias for progress
  },
};

// Theme-based color sets for light/dark mode
export default {
  light: {
    text: Colors.carbon[950],
    textSecondary: Colors.graphite[600],
    background: Colors.graphite[50],
    card: '#ffffff',
    tint: Colors.signal[500],
    border: Colors.graphite[200],
    tabIconDefault: Colors.graphite[400],
    tabIconSelected: Colors.signal[500],
    accent: Colors.oxide[500],
    success: Colors.progress[500],
    error: Colors.regression[500],
  },
  dark: {
    text: Colors.graphite[50],
    textSecondary: Colors.graphite[400],
    background: Colors.carbon[950],
    card: Colors.graphite[900],
    tint: Colors.signal[500],
    border: Colors.graphite[700],
    tabIconDefault: Colors.graphite[500],
    tabIconSelected: Colors.signal[500],
    accent: Colors.oxide[500],
    success: Colors.progress[500],
    error: Colors.regression[500],
  },
};
