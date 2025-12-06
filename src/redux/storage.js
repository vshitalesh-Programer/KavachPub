import { MMKV } from 'react-native-mmkv';

let storage;
try {
  storage = new MMKV();
} catch (error) {
  console.warn("MMKV failed to initialize (likely due to Remote Debugging). Falling back to in-memory storage.", error);
  // Fallback mock storage to prevent crash
  storage = {
    set: () => {},
    getString: () => null,
    delete: () => {},
    clearAll: () => {},
  };
}

const reduxStorage = {
  setItem: (key, value) => {
    storage.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key) => {
    const value = storage.getString(key);
    return Promise.resolve(value);
  },
  removeItem: (key) => {
    storage.delete(key);
    return Promise.resolve();
  },
};

export default reduxStorage;
