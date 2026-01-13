import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Foundry Lab color scheme hook
 * Dark mode first (lab instrument aesthetic per design brief)
 * TODO: Add user preference setting to override
 */
export function useColorScheme(): 'dark' | 'light' {
  // Force dark mode for "lab instrument" aesthetic
  // This aligns with the design brief: "Dark mode first (lab instrument feel)"
  return 'dark';
  
  // Uncomment below to respect system preference:
  // const systemScheme = useRNColorScheme();
  // return systemScheme || 'dark';
}
