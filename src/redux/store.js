import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { persistStore, persistReducer } from 'redux-persist';
import { encryptTransform } from 'redux-persist-transform-encrypt';
import reduxStorage from './storage';
import rootReducer from './rootReducer';
import rootSaga from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

const encryptor = encryptTransform({
  secretKey: 'my-super-secret-key', // TODO: Move this to an environment variable (.env)
  onError: function (error) {
    // Handle the error
    console.error('Encryption error:', error);
  },
});

const persistConfig = {
  key: 'root',
  storage: reduxStorage,
  transforms: [encryptor],
  whitelist: ['auth'], // Only persist the 'auth' slice
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'], // Ignore redux-persist actions
      },
      thunk: false,
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(rootSaga);

export const persistor = persistStore(store);
export default store;
