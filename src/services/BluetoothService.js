import BleManager from 'react-native-ble-manager';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
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

  async scanClassic() {
    try {
      console.log('🔵 [Classic] Starting scan...');
      // cancelDiscovery() first to be safe?
      try { await RNBluetoothClassic.cancelDiscovery(); } catch(e) {}
      
      const devices = await RNBluetoothClassic.startDiscovery();
      console.log('✅ [Classic] Scan finished. Found:', devices.length);
      return devices;
    } catch (error) {
      console.error('🔴 [Classic] Scan failed:', error);
      return [];
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
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
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

  async getBondedDevices() {
    try {
      const peripherals = await BleManager.getBondedPeripherals();
      return peripherals.map(p => ({
        ...p,
        isBonded: true,
      }));
    } catch (error) {
      console.error('Failed to get bonded devices', error);
      return [];
    }
  }

  async scanForDevices(duration = 20) {
    try {
      console.log('🔵 [BLE Service] scanForDevices called, duration:', duration);

      // Stop any existing scan first
      try {
        await BleManager.stopScan();
      } catch (e) {
        console.log('🔵 [BLE Service] No existing scan to stop');
      }

      // Use NativeModules scan with a ReadableMap (object) to avoid "expected Map got array"
      const scanOptions = {
        serviceUUIDs: [],     // empty = all devices
        seconds: duration,
        allowDuplicates: true,
      };

      console.log('🔵 [BLE Service] Starting scan with NativeModules.BleManager.scan()', scanOptions);
      await new Promise((resolve, reject) => {
        NativeModules.BleManager.scan(scanOptions, (error) => {
          if (error) {
            console.error('🔴 [BLE Service] Scan callback error:', error);
            reject(error);
          } else {
            console.log('✅ [BLE Service] Scan started successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('🔴 [BLE Service] Scan error:', error);
      throw error;
    }
  }

  /**
   * Classic Bluetooth: fetch bonded devices and discover nearby classic devices.
   * Returns { bonded: [], discovered: [] }
   */
  async scanClassicDevices() {
    const result = { bonded: [], discovered: [] };
    try {
      if (!RNBluetoothClassic?.startDiscovery) {
        console.log('🔵 [BT Classic] Module not available, skipping classic scan');
        return result;
      }

      // Bonded (paired) devices
      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        result.bonded = bonded.map(d => ({ ...d, type: 'classic', isBonded: true }));
        console.log('🔵 [BT Classic] Bonded devices:', result.bonded.length);
      } catch (e) {
        console.warn('⚠️ [BT Classic] Failed to get bonded devices', e);
      }

      // Cancel ongoing discovery before starting a new one
      try {
        await RNBluetoothClassic.cancelDiscovery();
      } catch (e) {
        // ignore
      }

      try {
        const discovered = await RNBluetoothClassic.startDiscovery();
        result.discovered = discovered.map(d => ({ ...d, type: 'classic', isBonded: false }));
        console.log('🔵 [BT Classic] Discovered classic devices:', result.discovered.length);
      } catch (e) {
        console.warn('⚠️ [BT Classic] Classic discovery failed', e);
      }

      return result;
    } catch (error) {
      console.error('🔴 [BT Classic] scanClassicDevices error:', error);
      return result;
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

  async connectToClassicDevice(deviceId) {
    try {
        console.log('Connecting to Classic Device:', deviceId);
        const device = await RNBluetoothClassic.connectToDevice(deviceId);
        console.log('Connected to Classic Device:', deviceId);
        return device;
    } catch (error) {
        console.error('Classic Connection failed', error);
        throw error;
    }
  }
}

export default new BluetoothService();
