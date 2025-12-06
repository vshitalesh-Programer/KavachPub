import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import AppNavigator from './src/navigation/AppNavigator';
import store, { persistor } from './src/redux/store';

import { useSelector, useDispatch } from 'react-redux';
import { logout } from './src/redux/slices/authSlice';
import ApiService from './src/services/ApiService';

const AuthSync = ({ children }) => {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  
  React.useEffect(() => {
    // Set up the cleanup callback for 401s
    ApiService.setLogoutCallback(() => {
      dispatch(logout());
    });
  }, [dispatch]);
  
  React.useEffect(() => {
    console.log('[App] AuthSync user changed:', user ? 'Logged In' : 'Null');
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
