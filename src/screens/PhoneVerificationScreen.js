/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import ApiService from '../services/ApiService';
import Icon from 'react-native-vector-icons/Feather';

const PhoneVerificationScreen = ({ route, navigation }) => {
  const { phoneExtension, phoneNumber, onVerificationSuccess } = route.params || {};

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verificationId, setVerificationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef([]);

  useEffect(() => {
    // Auto-send OTP when screen loads
    if (phoneExtension && phoneNumber) {
      sendOTP();
    }
  }, []);

  useEffect(() => {
    // Countdown timer for resend OTP
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendOTP = async (isResend = false) => {
    if (!phoneExtension || !phoneNumber) {
      Alert.alert('Error', 'Phone number information is missing');
      return;
    }

    try {
      if (isResend) {
        setIsResending(true);
      } else {
        setIsLoading(true);
      }

      const response = await ApiService.sendOTP(phoneExtension, phoneNumber);

      if (response?.verificationId) {
        setVerificationId(response.verificationId);
        setCountdown(60); // 60 seconds countdown
        Alert.alert(
          'OTP Sent',
          `Verification code has been sent to ${phoneExtension} ${phoneNumber}`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Failed to get verification ID');
      }
    } catch (error) {
      console.error('[PhoneVerification] Error sending OTP:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send OTP. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsResending(false);
    }
  };

  const handleOtpChange = (text, index) => {
    // Only allow digits
    const numericText = text.replace(/[^0-9]/g, '');

    if (numericText.length > 1) {
      // Handle paste: split into individual digits
      const digits = numericText.split('').slice(0, 6);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);

      // Focus next empty input or last input
      const nextIndex = Math.min(index + digits.length, 5);
      if (otpInputRefs.current[nextIndex]) {
        otpInputRefs.current[nextIndex].focus();
      }
    } else {
      const newOtp = [...otp];
      newOtp[index] = numericText;
      setOtp(newOtp);

      // Auto-focus next input
      if (numericText && index < 5 && otpInputRefs.current[index + 1]) {
        otpInputRefs.current[index + 1].focus();
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const verifyOTP = async () => {
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP code');
      return;
    }

    if (!verificationId) {
      Alert.alert('Error', 'Verification ID is missing. Please request a new OTP.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await ApiService.verifyOTP(verificationId, otpString);

      console.log('[PhoneVerification] OTP verified successfully:', response);

      // Call success callback if provided
      if (onVerificationSuccess) {
        onVerificationSuccess({
          phoneExtension,
          phoneNumber,
          ...response,
        });
      }

      Alert.alert(
        '✅ Verification Successful',
        'Your phone number has been verified successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('[PhoneVerification] Error verifying OTP:', error);
      Alert.alert(
        'Verification Failed',
        error.message || 'Invalid OTP. Please try again.'
      );
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      if (otpInputRefs.current[0]) {
        otpInputRefs.current[0].focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#FFFFFF" style={styles.backIcon} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Verify Phone Number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phoneNumber}>
              {phoneExtension} {phoneNumber}
            </Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (otpInputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleOtpKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
          onPress={verifyOTP}
          disabled={isLoading || otp.join('').length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <TouchableOpacity
            onPress={() => sendOTP(true)}
            disabled={isResending || countdown > 0}
            style={styles.resendButton}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#e98f7c" />
            ) : countdown > 0 ? (
              <Text style={styles.resendButtonText}>
                Resend in {countdown}s
              </Text>
            ) : (
              <Text style={styles.resendButtonText}>Resend OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#68778f',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backIcon: {
    marginRight: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B5BA',
    lineHeight: 24,
  },
  phoneNumber: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 60,
    backgroundColor: '#94a0b2',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94a0b2',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#e98f7c',
    backgroundColor: '#68778f',
  },
  verifyButton: {
    backgroundColor: '#e98f7c',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: '#B0B5BA',
    fontSize: 14,
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    color: '#e98f7c',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PhoneVerificationScreen;
