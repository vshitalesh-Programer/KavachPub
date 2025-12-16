import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  ToastAndroid,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import { normalize } from '../utils/AppFonts';
import { useDispatch } from 'react-redux';
import { setConnectedDevice } from '../redux/slices/deviceSlice';
import { SERVICE_UUID, DEVICE_NAME } from '../constants/BluetoothConstants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_STORAGE_KEY = '@kavach:connected_device_id';

const ConnectDeviceScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState([]);
  const [isCheckingDevices, setIsCheckingDevices] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothError, setBluetoothError] = useState(null);
  const scanSubscriptionRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    checkExistingDevices();
    initializeBluetooth();

    return () => {
      // Cleanup on unmount
      if (scanSubscriptionRef.current) {
        BluetoothService.stopScan();
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeBluetooth = async () => {
    try {
      // Check permissions first
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        setBluetoothError('Bluetooth permissions are required. Please grant permissions in settings.');
        console.warn('⚠️ [ConnectDevice] Permissions not granted');
        return;
      }

      // Initialize BLE
      await BluetoothService.initialize();
      
      // Check if Bluetooth is enabled
      const { isEnabled, state } = await BluetoothService.checkBluetoothState();
      if (!isEnabled) {
        setBluetoothError(`Bluetooth is not enabled. Current state: ${state}. Please enable Bluetooth in settings.`);
        console.warn('⚠️ [ConnectDevice] Bluetooth not enabled, state:', state);
        return;
      }

      setBluetoothError(null);
      console.log('✅ [ConnectDevice] BLE Initialized and enabled');
    } catch (error) {
      console.error('🔴 [ConnectDevice] Initialization failed:', error);
      setBluetoothError(`Bluetooth initialization failed: ${error.message || 'Unknown error'}`);
    }
  };

  const checkExistingDevices = async () => {
    try {
      setIsCheckingDevices(true);
      const devices = await ApiService.getDevices();
      
      // Handle different response formats
      const deviceList = Array.isArray(devices) 
        ? devices 
        : (devices?.devices || devices?.data || []);
      
      console.log('[ConnectDevice] Existing devices:', deviceList);
      
      if (deviceList && deviceList.length > 0) {
        // User has devices, skip to home
        console.log('[ConnectDevice] Devices found, navigating to MainTabs');
        navigation.replace('MainTabs');
        return;
      }
      
      // No devices found, show connect screen
      setIsCheckingDevices(false);
    } catch (error) {
      console.error('[ConnectDevice] Error checking devices:', error);
      // If API fails, still show the connect screen
      setIsCheckingDevices(false);
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Could not check existing devices. Please try connecting manually.', ToastAndroid.LONG);
      } else {
        Alert.alert('Error', 'Could not check existing devices. Please try connecting manually.');
      }
    }
  };

  const startScan = async () => {
    if (isScanning) return;

    // Check permissions and Bluetooth state before scanning
    try {
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to scan for devices.');
        return;
      }

      const { isEnabled, state } = await BluetoothService.checkBluetoothState();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Not Enabled',
          `Bluetooth is not enabled. Current state: ${state}.\n\nPlease enable Bluetooth in your device settings.`
        );
        setBluetoothError(`Bluetooth is not enabled. Current state: ${state}`);
        return;
      }

      setBluetoothError(null);
    } catch (error) {
      Alert.alert('Error', `Failed to check Bluetooth state: ${error.message}`);
      return;
    }

    setIsScanning(true);
    setPeripherals([]);

    const onDeviceFound = (error, device) => {
      if (error) {
        console.error('[ConnectDevice] Device scan error:', error);
        setIsScanning(false);
        Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
        return;
      }

      if (device) {
        console.log('[ConnectDevice] Device found:', device.name, device.id);
        
        // Filter by device name
        if (device.name && device.name.toLowerCase().includes(DEVICE_NAME.toLowerCase())) {
          setPeripherals((prev) => {
            // Avoid duplicates
            const exists = prev.find((p) => p.id === device.id);
            if (exists) return prev;
            return [...prev, device];
          });
        }
      }
    };

    try {
      const subscription = BluetoothService.scanForDevices(
        SERVICE_UUID,
        DEVICE_NAME,
        onDeviceFound
      );
      scanSubscriptionRef.current = subscription;

      // Stop scan after 10 seconds
      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
      }, 10000);
    } catch (error) {
      console.error('[ConnectDevice] Scan error:', error);
      setIsScanning(false);
      Alert.alert('Scan Error', error.message || 'Failed to start scanning');
    }
  };

  const stopScan = () => {
    if (scanSubscriptionRef.current) {
      BluetoothService.stopScan();
      scanSubscriptionRef.current = null;
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
  };

  const connectToDevice = async (device) => {
    try {
      setIsConnecting(true);
      stopScan();

      console.log('[ConnectDevice] Connecting to device:', device.id, device.name);

      // Check permissions
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to connect to devices.');
        setIsConnecting(false);
        return;
      }

      // Check Bluetooth state
      const { isEnabled, state } = await BluetoothService.checkBluetoothState();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Not Enabled',
          `Bluetooth is not enabled. Current state: ${state}.\n\nPlease enable Bluetooth in your device settings.`
        );
        setIsConnecting(false);
        setBluetoothError(`Bluetooth is not enabled. Current state: ${state}`);
        return;
      }

      // Connect to device
      await BluetoothService.connectToDevice(device.id);
      console.log('[ConnectDevice] Connected successfully');

      // Create device in backend with new API format
      try {
        const createdDevice = await ApiService.createDevice({
          deviceId: device.id,
          id: device.id,
        });
        console.log('[ConnectDevice] Device created in backend:', createdDevice);

        // Store device ID in AsyncStorage
        try {
          await AsyncStorage.setItem(DEVICE_STORAGE_KEY, device.id);
          console.log('[ConnectDevice] Device ID stored in AsyncStorage');
        } catch (storageError) {
          console.error('[ConnectDevice] Error storing device ID:', storageError);
          // Continue even if storage fails
        }

        // Store connected device in Redux
        const deviceInfo = {
          id: device.id,
          name: device.name || 'Kavach Device',
          macAddress: device.id,
          deviceId: device.id,
          ...createdDevice, // Include any additional data from API
        };
        
        dispatch(setConnectedDevice(deviceInfo));

        // Navigate to MainTabs
        navigation.replace('MainTabs');
      } catch (apiError) {
        console.error('[ConnectDevice] Error creating device:', apiError);
        
        // Still store device ID locally even if API fails
        try {
          await AsyncStorage.setItem(DEVICE_STORAGE_KEY, device.id);
          dispatch(setConnectedDevice({
            id: device.id,
            name: device.name || 'Kavach Device',
            deviceId: device.id,
          }));
        } catch (storageError) {
          console.error('[ConnectDevice] Error storing device locally:', storageError);
        }

        // Still navigate even if API call fails
        Alert.alert(
          'Connection Successful',
          'Device connected but could not be saved to server. You can try again later.',
          [
            {
              text: 'Continue',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[ConnectDevice] Connection failed:', error);
      setIsConnecting(false);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      
      // Check if it's a Bluetooth state error
      if (errorMsg.includes('Bluetooth') || errorMsg.includes('not powered on')) {
        setBluetoothError(errorMsg);
        Alert.alert(
          'Bluetooth Error',
          `${errorMsg}\n\nPlease ensure Bluetooth is enabled in your device settings.`
        );
      } else {
        Alert.alert(
          'Connection Failed',
          `Failed to connect to device:\n${errorMsg}\n\nPlease ensure:\n- Device is powered on\n- Device is in range\n- Device is not already connected to another app`
        );
      }
    }
  };

  if (isCheckingDevices) {
    return (
      <LinearGradient colors={['#68778f', '#68778f']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Checking for existing devices...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#68778f', '#68778f']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Image source={require('../assets/images/kavach-shield-old.png')} style={styles.logoIcon} />
            </View>
          </View>
          <Text style={styles.title}>Connect Your Device</Text>
          <Text style={styles.subtitle}>
            Connect your Kavach device to get started with safety features
          </Text>
        </View>

          {/* Main Content */}
        <View style={styles.mainContent}>
          {bluetoothError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{bluetoothError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={initializeBluetooth}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isScanning && peripherals.length === 0 && !isConnecting && !bluetoothError && (
            <View style={styles.initialState}>
              <Text style={styles.instructionText}>
                Make sure your Kavach device is powered on and nearby
              </Text>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={startScan}
                disabled={isConnecting}>
                <Text style={styles.scanButtonText}>Start Scanning</Text>
              </TouchableOpacity>
            </View>
          )}

          {isScanning && (
            <View style={styles.scanningState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.scanningText}>Scanning for devices...</Text>
              <TouchableOpacity style={styles.stopButton} onPress={stopScan}>
                <Text style={styles.stopButtonText}>Stop Scanning</Text>
              </TouchableOpacity>
            </View>
          )}

          {isConnecting && (
            <View style={styles.connectingState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.connectingText}>Connecting to device...</Text>
            </View>
          )}

          {!isScanning && !isConnecting && peripherals.length > 0 && (
            <View style={styles.devicesList}>
              <Text style={styles.devicesTitle}>Found Devices:</Text>
              <FlatList
                data={peripherals}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => connectToDevice(item)}
                    disabled={isConnecting}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
                      <Text style={styles.deviceId}>{item.id}</Text>
                    </View>
                    <Text style={styles.connectText}>Connect</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={startScan}
                disabled={isConnecting}>
                <Text style={styles.scanAgainButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Skip Option */}
        {!isScanning && !isConnecting && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.replace('MainTabs')}
            disabled={isConnecting}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    marginTop: 16,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: normalize(40),
    paddingBottom: normalize(30),
  },
  logoContainer: {
    marginBottom: 16,
    backgroundColor: '#68778f',
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
  title: {
    fontSize: normalize(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: normalize(14),
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mainContent: {
    backgroundColor: '#68778f',
    marginHorizontal: normalize(14),
    paddingVertical: normalize(26),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(14),
    borderWidth: 1.5,
    borderColor: '#94a0b2',
    minHeight: 300,
  },
  initialState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    textAlign: 'center',
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: '#e98f7c',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '600',
  },
  scanningState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    marginTop: 16,
    marginBottom: 24,
  },
  stopButton: {
    backgroundColor: '#9CA3AF',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  connectingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  connectingText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    marginTop: 16,
  },
  devicesList: {
    width: '100%',
  },
  devicesTitle: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '600',
    marginBottom: 16,
  },
  deviceItem: {
    backgroundColor: '#94a0b2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceId: {
    color: '#E5E7EB',
    fontSize: normalize(12),
  },
  connectText: {
    color: '#e98f7c',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  scanAgainButton: {
    backgroundColor: '#94a0b2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  scanAgainButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: normalize(14),
    textDecorationLine: 'underline',
  },
  errorContainer: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    marginBottom: 12,
    lineHeight: normalize(20),
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#ef4444',
    fontSize: normalize(14),
    fontWeight: '600',
  },
});

export default ConnectDeviceScreen;
