import { BleManager } from 'react-native-ble-plx';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';

// Base64 decode helper (React Native compatible)
/* eslint-disable no-bitwise */
function decodeBase64(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;
  
  base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < base64.length) {
    const enc1 = chars.indexOf(base64.charAt(i++));
    const enc2 = chars.indexOf(base64.charAt(i++));
    const enc3 = chars.indexOf(base64.charAt(i++));
    const enc4 = chars.indexOf(base64.charAt(i++));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    str += String.fromCharCode(chr1);
    
    if (enc3 !== 64) {
      str += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      str += String.fromCharCode(chr3);
    }
  }
  
  return str;
}
/* eslint-enable no-bitwise */

class BluetoothService {
  constructor() {
    this.manager = new BleManager();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      // Wait for BLE manager to be ready
      await this.manager.state();
      this.isInitialized = true;
      console.log('✅ [BLE-PLX] Manager initialized');
    } catch (error) {
      console.error('🔴 [BLE-PLX] Initialization failed:', error);
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
        console.log('✅ [BLE-PLX] Permissions granted');
        return true;
      }
      return false;
    }
    return true; // iOS handles permissions automatically via Plist
  }

  /**
   * Check if Bluetooth is enabled
   * @returns {Promise<{isEnabled: boolean, state: string}>}
   */
  async checkBluetoothState() {
    try {
      const state = await this.manager.state();
      const isEnabled = state === 'PoweredOn';
      return { isEnabled, state };
    } catch (error) {
      console.error('🔴 [BLE-PLX] Error checking Bluetooth state:', error);
      return { isEnabled: false, state: 'Unknown' };
    }
  }

  /**
   * Scan for BLE devices with specific service UUID and name filter
   * @param {string} serviceUUID - Service UUID to filter by
   * @param {string} deviceName - Device name to filter by (optional)
   * @param {Function} onDeviceFound - Callback when device is found
   * @returns {Subscription} Subscription object
   */
  async scanForDevices(serviceUUID, deviceName = 'Kavach', onDeviceFound) {
    try {
      console.log('🔵 [BLE-PLX] Starting scan for service:', serviceUUID, 'name:', deviceName);
      
      // Check if BLE is enabled
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`Bluetooth is not powered on. Current state: ${state}`);
      }
      
      // Start scanning with service UUID filter
      const subscription = this.manager.startDeviceScan(
        [serviceUUID], // Filter by service UUID
        null,
        (error, device) => {
          if (error) {
            console.error('🔴 [BLE-PLX] Scan error:', error);
            if (onDeviceFound) {
              onDeviceFound(error, null);
            }
            return;
          }

          if (device) {
            // Filter by name if provided
            const nameMatch = !deviceName || 
              (device.name && device.name.toLowerCase().includes(deviceName.toLowerCase()));
            
            if (nameMatch) {
              console.log('✅ [BLE-PLX] Found matching device:', device.name || device.id, device.id);
              if (onDeviceFound) {
                onDeviceFound(null, device);
              }
            }
          }
        }
      );

      return subscription;
    } catch (error) {
      console.error('🔴 [BLE-PLX] Scan error:', error);
      throw error;
    }
  }

  /**
   * Stop scanning for devices
   */
  stopScan() {
    try {
      this.manager.stopDeviceScan();
      console.log('🟡 [BLE-PLX] Scan stopped');
    } catch (error) {
      console.error('🔴 [BLE-PLX] Error stopping scan:', error);
    }
  }

  /**
   * Connect to a BLE device
   * @param {string} deviceId - Device ID to connect to
   * @returns {Promise<Device>} Connected device
   */
  async connectToDevice(deviceId) {
    try {
      console.log('🔵 [BLE-PLX] Connecting to device:', deviceId);
      
      const device = await this.manager.connectToDevice(deviceId);
      console.log('✅ [BLE-PLX] Connected to device:', deviceId);
      
      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      console.log('✅ [BLE-PLX] Services and characteristics discovered');
      
      return device;
    } catch (err) {
      console.error('🔴 [BLE-PLX] Connection failed:', err);
      if (err.message) {
        throw new Error(`BLE Connection Error: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Disconnect from a device
   * @param {string} deviceId - Device ID to disconnect from
   */
  async disconnectDevice(deviceId) {
    try {
      await this.manager.cancelDeviceConnection(deviceId);
      console.log('✅ [BLE-PLX] Disconnected from device:', deviceId);
    } catch (error) {
      console.error('🔴 [BLE-PLX] Disconnect error:', error);
    }
  }

  /**
   * Get connected devices
   * @returns {Promise<Array>} Array of connected devices
   */
  async getConnectedDevices(serviceUUIDs) {
    try {
      const devices = await this.manager.connectedDevices(serviceUUIDs);
      console.log('✅ [BLE-PLX] Found connected devices:', devices.length);
      return devices;
    } catch (error) {
      console.error('🔴 [BLE-PLX] Error getting connected devices:', error);
      return [];
    }
  }

  /**
   * Monitor characteristic for notifications
   * @param {Device} device - Connected device
   * @param {string} serviceUUID - Service UUID
   * @param {string} characteristicUUID - Characteristic UUID
   * @param {Function} callback - Callback function for notifications
   * @returns {Subscription} Subscription object
   */
  monitorCharacteristic(device, serviceUUID, characteristicUUID, callback) {
    return device.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          console.error('🔴 [BLE-PLX] Monitor error:', error);
          return;
        }
        if (characteristic && characteristic.value) {
          const base64 = characteristic.value;
          // Convert base64 to hex (React Native compatible)
          // Using a simple base64 decoder
          const binaryString = decodeBase64(base64);
          const hex = Array.from(binaryString)
            .map(char => ('0' + char.charCodeAt(0).toString(16)).slice(-2))
            .join('');
          callback(hex, characteristic);
        }
      }
    );
  }

  /**
   * Read characteristic value
   * @param {Device} device - Connected device
   * @param {string} serviceUUID - Service UUID
   * @param {string} characteristicUUID - Characteristic UUID
   * @returns {Promise<string>} Hex string value
   */
  async readCharacteristic(device, serviceUUID, characteristicUUID) {
    try {
      const characteristic = await device.readCharacteristicForService(
        serviceUUID,
        characteristicUUID
      );
      if (characteristic && characteristic.value) {
        const base64 = characteristic.value;
        // Convert base64 to hex (React Native compatible)
        const binaryString = decodeBase64(base64);
        const hex = Array.from(binaryString)
          .map(char => ('0' + char.charCodeAt(0).toString(16)).slice(-2))
          .join('');
        return hex;
      }
      return '';
    } catch (error) {
      console.error('🔴 [BLE-PLX] Read error:', error);
      throw error;
    }
  }

  // Classic Bluetooth methods (keeping for compatibility)
  async scanClassic() {
    try {
      console.log('🔵 [Classic] Starting scan...');
      try { await RNBluetoothClassic.cancelDiscovery(); } catch(e) {}
      const devices = await RNBluetoothClassic.startDiscovery();
      console.log('✅ [Classic] Scan finished. Found:', devices.length);
      return devices;
    } catch (error) {
      console.error('🔴 [Classic] Scan failed:', error);
      return [];
    }
  }

  async scanClassicDevices() {
    const result = { bonded: [], discovered: [] };
    try {
      if (!RNBluetoothClassic?.startDiscovery) {
        console.log('🔵 [BT Classic] Module not available, skipping classic scan');
        return result;
      }

      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        result.bonded = bonded.map(d => ({ ...d, type: 'classic', isBonded: true }));
        console.log('🔵 [BT Classic] Bonded devices:', result.bonded.length);
      } catch (e) {
        console.warn('⚠️ [BT Classic] Failed to get bonded devices', e);
      }

      try {
        await RNBluetoothClassic.cancelDiscovery();
      } catch (e) {}

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

  // Cleanup
  destroy() {
    if (this.manager) {
      this.manager.destroy();
      this.isInitialized = false;
    }
  }
}

export default new BluetoothService();
