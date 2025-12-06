import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import AppNavigator from './src/navigation/AppNavigator';
import store, { persistor } from './src/redux/store';

import { useSelector } from 'react-redux';
import ApiService from './src/services/ApiService';

// Component to sync Redux auth state with ApiService
const AuthSync = ({ children }) => {
  const user = useSelector(state => state.auth.user);
  
  React.useEffect(() => {
    if (user && user.token) {
      ApiService.setToken(user.token);
    } else {
      ApiService.setToken(null);
    }
  }, [user]);

  return children;
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthSync>
          <GestureHandlerRootView style={{flex: 1}}>
            <SafeAreaProvider>
              <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
              <AppNavigator />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </AuthSync>
      </PersistGate>
    </Provider>
  );
}

export default App;
