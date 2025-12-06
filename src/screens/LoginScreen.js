import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, LinearGradient as SvgLinearGradient, Stop, Path} from 'react-native-svg';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';
import {normalize} from '../utils/AppFonts';

import { loginRequest, signupRequest } from '../redux/slices/authSlice';
import { useDispatch, useSelector } from 'react-redux';

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
      webClientId: '295362807661-3ih4t86k29mk82oenen7kro7e5f1oldk.apps.googleusercontent.com',
      offlineAccess: true, // if you want to access Google API on behalf of the user FROM YOUR SERVER
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('MainTabs');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const handleLogin = () => {
    if (isLogin) {
        // Normal Login (Use isDemo: true ONLY if you want to skip real API)
        // Set isDemo: false to try REAL API
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
      
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      
      // Get the user's ID token
      const userInfo = await GoogleSignin.signIn();
      
      // Get the ID token for backend verification
      const {idToken} = await GoogleSignin.getTokens();
      
      console.log('Google Sign-In Success:', userInfo);
      
      // Dispatch login request with Google token to Redux
      dispatch(loginRequest({ 
        googleToken: idToken || userInfo.idToken,
        email: userInfo.user.email,
        isDemo: false 
      }));
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        Alert.alert('Cancelled', 'Sign in was cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Operation (e.g. sign in) is in progress already
        Alert.alert('In Progress', 'Sign in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Play services not available or outdated
        Alert.alert('Error', 'Play services not available or outdated');
      } else {
        // Some other error happened
        console.error('Google Sign-In Error:', error);
        Alert.alert('Error', error.message || 'Something went wrong with Google Sign-In');
      }
    }
  };

  return (
    <LinearGradient
      colors={['#140e12', '#0a0b10']}
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
                <Svg width={normalize(40)} height={normalize(40)} viewBox="0 0 128 128">
                  <Defs>
                    <SvgLinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#ef4444" />
                      <Stop offset="1" stopColor="#dc2626" />
                    </SvgLinearGradient>
                  </Defs>
                  <Path
                    fill="url(#g)"
                    d="M64 8c12 10 28 12 44 12v40c0 26-18 49-44 60C38 109 20 86 20 60V20c16 0 32-2 44-12z"
                  />
                  <Path
                    fill="white"
                    opacity="0.14"
                    d="M64 14c9 8 22 10 35 11v33c0 22-15 41-35 50-20-9-35-28-35-50V25c13-1 26-3 35-11z"
                  />
                </Svg>
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
              Log in to access your MyoTrack console.
            </Text>

            {/* Input Fields */}
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {/* Login Button */}
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
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
        <View style={styles.bottomIcon}>
          <View style={styles.iconCircle}>
            <Text style={styles.lightningIcon}>⚡</Text>
          </View>
        </View>
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
    paddingBottom: 100,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: normalize(40),
    paddingBottom: normalize(20),
  },
  logoContainer: {
    marginBottom: 16,
    backgroundColor:'#2b1216',
    borderRadius: 16,
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
    backgroundColor:'#10141d',
    marginHorizontal: normalize(14),
    paddingVertical: normalize(26),
    borderRadius: normalize(14),
    borderWidth: 1.5,
    borderColor: '#81869140',
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
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#81869140',
  },
  toggleButtonActive: {
    backgroundColor: '#DC2626',
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
    backgroundColor:'#10141d',
    borderRadius: 16,
    fontSize: normalize(14),
    color: '#FFFFFF',
    marginBottom: 12,
    paddingVertical: normalize(6),
    paddingStart: normalize(10),
    borderWidth: 1.5,
    borderColor: '#81869140',
  },
  loginButton: {
    backgroundColor: '#DC2626',
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
    backgroundColor: '#81869140',
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
