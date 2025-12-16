import AsyncStorage from '@react-native-async-storage/async-storage';

let storage;
let isMMKV = false;

try {
  // Try to import and initialize MMKV
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV();
  isMMKV = true;
  console.log('[ReduxStorage] MMKV initialized successfully');
} catch (error) {
  // MMKV not available (e.g., during remote debugging) - fall back to AsyncStorage
  console.warn("MMKV failed to initialize (likely due to Remote Debugging). Falling back to AsyncStorage.", error);
  storage = AsyncStorage;
  isMMKV = false;
}

const reduxStorage = {
  setItem: (key, value) => {
    // console.log('[ReduxStorage] setItem', key);
    if (isMMKV) {
      storage.set(key, value);
      return Promise.resolve(true);
    } else {
      return storage.setItem(key, value);
    }
  },
  getItem: (key) => {
    // console.log('[ReduxStorage] getItem', key);
    if (isMMKV) {
      const value = storage.getString(key);
      return Promise.resolve(value);
    } else {
      return storage.getItem(key);
    }
  },
  removeItem: (key) => {
    console.log('[ReduxStorage] removeItem', key);
    if (isMMKV) {
      storage.delete(key);
      return Promise.resolve();
    } else {
      return storage.removeItem(key);
    }
  },
};

export default reduxStorage;
