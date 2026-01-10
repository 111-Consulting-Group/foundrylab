// Mock MMKV for web builds
// This file is used by metro.config.js to replace react-native-mmkv on web

class MMKVMock {
  constructor() {
    this.storage = new Map();
  }

  getString(key) {
    return this.storage.get(key) || null;
  }

  set(key, value) {
    this.storage.set(key, value);
  }

  delete(key) {
    this.storage.delete(key);
  }

  contains(key) {
    return this.storage.has(key);
  }

  getAllKeys() {
    return Array.from(this.storage.keys());
  }

  clearAll() {
    this.storage.clear();
  }
}

module.exports = {
  MMKV: MMKVMock,
};
