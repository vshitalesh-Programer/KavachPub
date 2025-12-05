import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, LinearGradient as SvgLinearGradient, Stop, Path} from 'react-native-svg';
import {normalize} from '../utils/AppFonts';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleLogin = () => {
    // Navigate directly to main app (tabs) without authentication
    navigation.replace('MainTabs');
  };

  return (
    <LinearGradient
      colors={['#140e12', '#0a0b10']}
      style={styles.container}>
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
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

       
        </View>
      </View>
   {/* Terms & Privacy */}
   <Text style={styles.termsText}>
            By continuing, you agree to the Terms & Privacy Policy.
          </Text>
      {/* Bottom Left Icon */}
      <View style={styles.bottomIcon}>
        <View style={styles.iconCircle}>
          <Text style={styles.lightningIcon}>⚡</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 22,
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
    borderWidth: 0,
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
