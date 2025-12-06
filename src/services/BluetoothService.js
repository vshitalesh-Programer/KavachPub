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

  async scanForDevices(duration = 5) {
    try {
      console.log('🔵 [BLE Service] scanForDevices called, duration:', duration);
      
      const state = await BleManager.checkState();
      if (state !== 'on') {
        throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
      }

      // Stop any existing scan first
      try {
        await BleManager.stopScan();
      } catch (e) {
        // ignore
      }

      console.log('🔵 [BLE Service] Starting scan via BleManager.scan()...');
      // scan(serviceUUIDs, seconds, allowDuplicates, options)
      await BleManager.scan(null, duration, true, { numberOfMatches: 1, matchMode: 1, scanMode: 2 });
      console.log('✅ [BLE Service] Scan started successfully');

    } catch (error) {
      console.error('🔴 [BLE Service] Scan error:', error);
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
