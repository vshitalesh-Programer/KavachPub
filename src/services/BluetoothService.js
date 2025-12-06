import BleManager from 'react-native-ble-manager';
import { NativeModules, PermissionsAndroid, Platform, Alert } from 'react-native';

class BluetoothService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      await BleManager.start({ showAlert: false });
      this.isInitialized = true;
      console.log('BleManager initialized');
    } catch (error) {
      console.error('BleManager init failed:', error);
    }
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      let granted = false;
      if (Platform.Version >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        granted =
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        granted = permission === PermissionsAndroid.RESULTS.GRANTED;
      }

      if (granted) {
        try {
          await BleManager.enableBluetooth();
          console.log('Bluetooth is enabled');
          return true;
        } catch (error) {
          console.warn('User refused to enable Bluetooth', error);
          Alert.alert(
            'Bluetooth Required', 
            'You refused to enable Bluetooth. Please enable it in your system settings to search for devices.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }
      return false;
    }
    return true; // iOS handles permissions automatically via Plist
  }

  async scanForDevices(duration = 5) {
    try {
      console.log('🔵 [BLE Service] scanForDevices called, duration:', duration);
      
      // Check Bluetooth state
      const state = await BleManager.checkState();
      console.log('🔵 [BLE Service] Bluetooth state:', state);
      
      if (state !== 'on') {
        throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
      }
      
      // Stop any existing scan first
      try {
        await BleManager.stopScan();
        console.log('🔵 [BLE Service] Stopped any existing scan');
      } catch (e) {
        // Ignore if no scan was running
        console.log('🔵 [BLE Service] No existing scan to stop');
      }
      
      // Use NativeModules with proper Map/object format (not array)
      // The native module expects a ReadableMap (object), not an array
      console.log('🔵 [BLE Service] Starting scan with NativeModules...');
      const scanOptions = {
        serviceUUIDs: [], // Empty array means scan all devices
        seconds: duration,
        allowDuplicates: true,
      };
      
      console.log('🔵 [BLE Service] Scan options (Map format):', JSON.stringify(scanOptions));
      
      return new Promise((resolve, reject) => {
        NativeModules.BleManager.scan(scanOptions, (error) => {
          if (error) {
            console.error('🔴 [BLE Service] Scan callback error:', error);
            reject(new Error(error));
          } else {
            console.log('✅ [BLE Service] Scan started successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('🔴 [BLE Service] Scan error:', error);
      console.error('🔴 [BLE Service] Error message:', error.message);
      throw error;
    }
  }

  connectToDevice(deviceId) {
    return BleManager.connect(deviceId)
      .then(() => {
        console.log('Connected to ' + deviceId);
        return BleManager.retrieveServices(deviceId);
      })
      .catch((err) => {
        console.error('Connection failed', err);
        throw err;
      });
  }
}

export default new BluetoothService();
