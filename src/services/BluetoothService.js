import BleManager from 'react-native-ble-manager';
import { PermissionsAndroid, Platform } from 'react-native';

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
      if (Platform.Version >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handles permissions automatically via Plist
  }

  scanForDevices(duration = 5, onDiscovered) {
    // Bypass the JS wrapper because of signature mismatch
    // Native expects: scan(ReadableMap options, Callback callback)
    const scanOptions = {
        serviceUUIDs: [],
        seconds: duration,
        allowDuplicates: true,
        scanningOptions: {}
    };
    return new Promise((resolve, reject) => {
        NativeModules.BleManager.scan(scanOptions, (error) => {
            if (error) {
                console.error('Scan failed', error);
                reject(error);
            } else {
                console.log('Scan started');
                resolve();
            }
        });
    });
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
