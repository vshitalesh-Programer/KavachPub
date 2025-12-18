import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ToastAndroid,
  Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { normalize } from '../utils/AppFonts';

import { loginRequest, signupRequest } from '../redux/slices/authSlice';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';

const PLACEHOLDER_COLOR = '#9CA3AF';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();
  const { loading, error, isAuthenticated } = useSelector(state => state.auth);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: '217252895046-ru6cksbpustt2ecpvuhc45kg96gst5o4.apps.googleusercontent.com',
      offlineAccess: true, // if you want to access Google API on behalf of the user FROM YOUR SERVER
      forceCodeForRefreshToken: true, // Always show account picker
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('ConnectDevice');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    if (error) {
       if (Platform.OS === 'android') {
        ToastAndroid.show(error, ToastAndroid.SHORT);
      } else {
         Alert.alert('Error', error);
      }
    }
  }, [error]);

  const handleLogin = () => {
    if (isLogin) {
        // Normal Login (Use isDemo: true ONLY if you want to skip real API)
        // Set isDemo: false to try REAL API
        // navigation.replace('MainTabs');
         dispatch(loginRequest({ email, password, isDemo: false }));
    } else {
        // Signup
        // Note: We might need a Name field in the UI for real signup
        dispatch(signupRequest({ email, password, name: 'New User' }));
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
  
      // Check if Google Play Services is available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  
      // Check if user is already signed in and sign out to force account picker
      // Note: isSignedIn() may not be available in all versions, so we wrap it in try-catch
      try {
        if (GoogleSignin.isSignedIn && typeof GoogleSignin.isSignedIn === 'function') {
          const isSignedIn = await GoogleSignin.isSignedIn();
          if (isSignedIn) {
            try {
              await GoogleSignin.signOut();
              console.log('[Google Sign-In] Signed out previous user to show account picker');
            } catch (signOutError) {
              console.warn('[Google Sign-In] Error signing out:', signOutError);
              // Continue anyway - signIn() should still work
            }
          }
        }
      } catch (checkError) {
        // isSignedIn() not available, try to sign out anyway
        try {
          await GoogleSignin.signOut();
          console.log('[Google Sign-In] Signed out to show account picker');
        } catch (signOutError) {
          // Ignore - will proceed with signIn() anyway
          console.log('[Google Sign-In] Proceeding with sign in');
        }
      }
  
      // Sign in - this will always show the account picker popup
      const userInfo = await GoogleSignin.signIn();
  
      console.log("Google Sign-In Success:", JSON.stringify(userInfo, null, 2));
  
      const email = userInfo?.user?.email || userInfo?.data?.user?.email ;
      const idToken = userInfo?.idToken || userInfo?.data?.idToken;
      console.log("Google Sign-In Success: 11", idToken, JSON.stringify(userInfo, null, 2));
      if (!idToken) {
        throw new Error("Google Token missing");
      }

      console.log("Google Sign-In Success: 12", JSON.stringify(userInfo, null, 2));
  
      if (!email) {
        throw new Error("Email not found in Google response");
      }

      console.log("Google Sign-In Success: 13", JSON.stringify(userInfo, null, 2));
  
      dispatch(
        loginRequest({
          googleToken: idToken,
          email: email || '',
          isDemo: false,
        })
      );

      console.log("Google Sign-In Success: 14", JSON.stringify(userInfo, null, 2));
  
    } catch (error) {
      setIsLoading(false);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Cancelled", "Sign in was cancelled");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert("In Progress", "Sign in is already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Error", "Play services not available or outdated");
      } else {
        console.error("Google Sign-In Error:", error);
        Alert.alert("Error", error.message || "Something went wrong with Google Sign-In");
      }
    }
  };
  
  return (
    <LinearGradient
      colors={['#68778f', '#68778f']}
      style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          
          {/* Top Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Image source={require('../assets/images/kavach-shield-old.png')} style={styles.logoIcon} />
              </View>
            </View>
            <Text style={styles.appName}>Kavach</Text>
            <Text style={styles.appSubtitle}>Safety Console</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Login/Signup Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                onPress={() => setIsLogin(true)}>
                <Text
                  style={[
                    styles.toggleButtonText,
                    isLogin && styles.toggleButtonTextActive,
                  ]}>
                  Log In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                onPress={() => setIsLogin(false)}>
                <Text
                  style={[
                    styles.toggleButtonText,
                    !isLogin && styles.toggleButtonTextActive,
                  ]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Welcome Message */}
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>
              Log in to access your Kavach console.
            </Text>

            {/* Input Fields */}
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {/* Login Button */}
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                 {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                 ) : (
                    <Text style={styles.loginButtonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
                 )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity 
                style={[styles.googleButton, isLoading && styles.googleButtonDisabled]} 
                onPress={handleGoogleSignIn}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#1F2937" />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <Svg width={20} height={20} viewBox="0 0 24 24">
                        <Path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <Path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <Path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <Path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </Svg>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms & Privacy */}
          <Text style={styles.termsText}>
            By continuing, you agree to the Terms & Privacy Policy.
          </Text>
        </ScrollView>

        {/* Bottom Left Icon */}
        {/* <View style={styles.bottomIcon}>
          <View style={styles.iconCircle}>
            <Text style={styles.lightningIcon}>⚡</Text>
          </View>
        </View> */}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    // paddingVertical: 100,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: normalize(50),
    paddingBottom: normalize(20),
  },
  logoContainer: {
    marginBottom: 16,
    backgroundColor:'#68778f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#94a0b2',
  },
  logoIcon: {
    width: normalize(80),
    height: normalize(80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: normalize(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: -3,
  },
  appSubtitle: {
    fontSize: normalize(12),
    color: '#9CA3AF',
    fontWeight: '400',
  },
  mainContent: {
    paddingHorizontal: 24,
    backgroundColor:'#68778f',
    marginHorizontal: normalize(14),
    paddingVertical: normalize(26),
    borderRadius: normalize(14),
    borderWidth: 1.5,
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    marginTop: normalize(20),
    marginBottom: normalize(20),
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#94a0b2',
  },
  toggleButtonActive: {
    backgroundColor: '#e98f7c',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  welcomeTitle: {
    fontSize: normalize(20),
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: normalize(14),
    color: '#9CA3AF',
    marginBottom: 24,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor:'#68778f',
    borderRadius: 16,
    fontSize: normalize(14),
    color: '#FFFFFF',
    marginBottom: 12,
    paddingVertical: normalize(6),
    paddingStart: normalize(10),
    borderWidth: 1.5,
    borderColor: '#94a0b2',
  },
  loginButton: {
    backgroundColor: '#e98f7c',
    borderRadius: 15,
    paddingVertical: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(15),
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#94a0b2',
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: normalize(12),
    marginHorizontal: 12,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  googleIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: normalize(15),
    fontWeight: '600',
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  termsText: {
    color: '#9CA3AF',
    fontSize: normalize(12),
    textAlign: 'center',
    marginTop: 24,
    lineHeight: normalize(16),
  },
  bottomIcon: {
    position: 'absolute',
    bottom: 24,
    left: 24,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightningIcon: {
    fontSize: normalize(18),
    color: '#FFFFFF',
  },
});

export default LoginScreen;
