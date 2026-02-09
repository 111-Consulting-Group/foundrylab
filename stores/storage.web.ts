/**
 * Web Storage Adapter
 * Uses localStorage for web platform
 */

console.log('🟢 storage.web.ts loading (WEB PLATFORM)');

export const zustandStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // localStorage might be full or disabled
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore errors
    }
  },
};
