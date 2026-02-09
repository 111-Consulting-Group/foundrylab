/**
 * Native Storage Adapter
 * Uses MMKV for native platforms (iOS/Android)
 */

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

export const zustandStorage = {
  getItem: (name: string): string | null => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};
