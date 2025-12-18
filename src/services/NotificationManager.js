import BluetoothService from './BluetoothService';
import { store } from '../redux/store';
import { setLastHex, setNotificationsActive } from '../redux/slices/deviceSlice';
import ApiService from './ApiService';
import { addIncident } from '../redux/slices/incidentSlice';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { InteractionManager } from 'react-native';

// Callback to refresh trigger history (set by HomeScreen)
let refreshTriggerHistoryCallback = null;

/**
 * Set callback to refresh trigger history after SOS is triggered
 * This allows NotificationManager to refresh the history when SOS is triggered
 * from a notification (when HomeScreen might not be mounted)
 */
export const setRefreshTriggerHistoryCallback = (callback) => {
  refreshTriggerHistoryCallback = callback;
};

class NotificationManager {
  constructor() {
    this.sosHandler = null;
  }

  /**
   * Set the SOS handler function
   * This should be set from HomeScreen or wherever handleSOS is defined
   */
  setSOSHandler(handler) {
    this.sosHandler = handler;
  }

  /**
   * Setup notifications for a connected device
   * This can be called from any screen when a device is connected
   * Uses deviceId from Redux or passed as parameter
   * @param {string} deviceId - Optional device ID (if not provided, uses Redux state)
   */
  async setupNotifications(deviceId = null) {
    try {
      // Get deviceId from parameter or Redux state
      const targetDeviceId = deviceId || store.getState().device.connectedDevice?.deviceId || store.getState().device.connectedDevice?.id;
      
      if (!targetDeviceId) {
        throw new Error('No device ID available. Device must be connected and stored in Redux.');
      }

      console.log('🔔 [NotificationManager] Setting up notifications for device:', targetDeviceId);

      const onHexReceived = (hex) => {
        // Update Redux state
        store.dispatch(setLastHex(hex));
        console.log('🔔 [NotificationManager] Hex received:', hex);
      };

      const onSOSDetected = () => {
        console.log('🚨 [NotificationManager] SOS detected, triggering handler');
        // Ensure SOS handler runs on main thread to prevent crashes
        // BLE callbacks may run on background threads
        InteractionManager.runAfterInteractions(() => {
          if (this.sosHandler) {
            console.log('🚨 [NotificationManager] Calling registered SOS handler');
            this.sosHandler();
          } else {
            console.log('🚨 [NotificationManager] No handler registered, using fallback');
            // Fallback: trigger SOS directly if handler not set
            this.triggerSOS();
          }
        });
      };

      await BluetoothService.setupNotifications(targetDeviceId, onHexReceived, onSOSDetected);
      store.dispatch(setNotificationsActive(true));
      console.log('✅ [NotificationManager] Notifications setup complete');
    } catch (error) {
      console.error('🔴 [NotificationManager] Failed to setup notifications:', error);
      store.dispatch(setNotificationsActive(false));
      throw error;
    }
  }

  /**
   * Stop notifications
   */
  stopNotifications() {
    BluetoothService.stopNotifications();
    store.dispatch(setNotificationsActive(false));
    store.dispatch(setLastHex(null));
    console.log('🟡 [NotificationManager] Notifications stopped');
  }

  /**
   * Trigger SOS (fallback if handler not set)
   */
  async triggerSOS() {
    try {
      console.log('🚨 [NotificationManager] Triggering SOS...');

      let ipAddress = '0.0.0.0';
      try {
        ipAddress = await DeviceInfo.getIpAddress();
      } catch (e) {
        console.warn('Failed to get IP', e);
      }

      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('Location permission denied');
          }
        } catch (err) {
          console.warn('Permission request error', err);
        }
      }

      const dispatchIncident = async (lat, lng) => {
        const timestamp = new Date().toLocaleString();
        const incidentData = {
          id: Date.now().toString(),
          time: timestamp,
          lat: lat || 0,
          lng: lng || 0,
          mode: 'Loud',
          ip: ipAddress,
        };

        console.log('Dispatching SOS incident:', incidentData);
        store.dispatch(addIncident(incidentData));

        // Send to API
        try {
          const locationData = {
            latitude: lat || 0,
            longitude: lng || 0,
            deviceId: DeviceInfo ? await DeviceInfo.getUniqueId() : 'unknown',
            deviceInfo: DeviceInfo ? await DeviceInfo.getDeviceName() : 'unknown',
          };
          console.log('🚨 [NotificationManager] Calling API triggerEmergency with:', locationData);
          const response = await ApiService.triggerEmergency(locationData);
          const message = response?.message || 'Emergency Alert Sent! Help is on the way.';
          console.log('✅ [NotificationManager] API call successful:', response);
          
          // Alert must run on main thread - BLE callbacks may be on background thread
          InteractionManager.runAfterInteractions(() => {
            Alert.alert('SOS Sent', message);
          });
          
          // Refresh trigger history if callback is available
          if (refreshTriggerHistoryCallback) {
            console.log('🔄 [NotificationManager] Refreshing trigger history...');
            InteractionManager.runAfterInteractions(() => {
              try {
                refreshTriggerHistoryCallback();
              } catch (err) {
                console.warn('Failed to refresh trigger history:', err);
              }
            });
          } else {
            console.warn('⚠️ [NotificationManager] No refresh callback registered');
          }
        } catch (err) {
          console.error('🔴 [NotificationManager] API Error:', err);
          // Alert must run on main thread
          InteractionManager.runAfterInteractions(() => {
            Alert.alert('SOS Saved', 'Logged locally. Failed to send to server.');
          });
        }
      };

      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          dispatchIncident(latitude, longitude);
        },
        (error) => {
          console.error('Location Error:', error);
          dispatchIncident(0, 0);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    } catch (error) {
      // Alert must run on main thread
      InteractionManager.runAfterInteractions(() => {
        Alert.alert('Error', `Failed to initiate SOS: ${error.message || error}`);
      });
    }
  }
}

export default new NotificationManager();
