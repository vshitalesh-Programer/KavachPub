import { AppState, Platform, InteractionManager, PermissionsAndroid } from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, EventType } from '@notifee/react-native';
import BluetoothService from './BluetoothService';
import ApiService from './ApiService';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import { SERVICE_UUID, CHAR_UUID, DEVICE_NAME } from '../constants/BluetoothConstants';
import store from '../redux/store';
import { setLastHex, setNotificationsActive } from '../redux/slices/deviceSlice';
import { addIncident } from '../redux/slices/incidentSlice';

class BackgroundService {
  constructor() {
    this.isMonitoring = false;
    this.notificationSubscriptionRef = null;
    this.appStateSubscription = null;
    this.currentDeviceId = null;
    this.backgroundTaskId = null;
    this.foregroundSOSHandler = null; // Callback for foreground SOS handling
  }

  /**
   * Set callback for foreground SOS handling (called from HomeScreen)
   */
  setForegroundSOSHandler(handler) {
    this.foregroundSOSHandler = handler;
    console.log('✅ [BackgroundService] Foreground SOS handler registered');
  }

  /**
   * Request notification permissions
   */
  async requestNotificationPermissions() {
    try {
      if (Platform.OS === 'android') {
        // For Android 13+ (API 33+), we need to request POST_NOTIFICATIONS permission explicitly
        const androidVersion = Platform.Version;
        console.log(`📱 [BackgroundService] Android version: ${androidVersion}`);
        
        let postNotificationsGranted = false;
        if (androidVersion >= 33) {
          // Android 13+ requires explicit POST_NOTIFICATIONS permission
          try {
            // First check current permission status
            const currentStatus = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            console.log(`📱 [BackgroundService] Current POST_NOTIFICATIONS status: ${currentStatus}`);
            
            if (currentStatus) {
              console.log('✅ [BackgroundService] POST_NOTIFICATIONS permission already granted');
              postNotificationsGranted = true;
            } else {
              // Permission not granted - request it
              console.log('📱 [BackgroundService] POST_NOTIFICATIONS not granted, requesting permission...');
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                {
                  title: 'Notification Permission',
                  message: 'Kavach needs notification permission to send you emergency alerts and background updates.',
                  buttonNeutral: 'Ask Me Later',
                  buttonNegative: 'Cancel',
                  buttonPositive: 'OK',
                }
              );
              
              console.log(`📱 [BackgroundService] POST_NOTIFICATIONS request result: ${granted}`);
              postNotificationsGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
              
              if (postNotificationsGranted) {
                console.log('✅ [BackgroundService] POST_NOTIFICATIONS permission granted');
              } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
                console.warn('⚠️ [BackgroundService] POST_NOTIFICATIONS permission denied permanently');
              } else {
                console.warn('⚠️ [BackgroundService] POST_NOTIFICATIONS permission denied');
              }
            }
          } catch (permError) {
            console.error('🔴 [BackgroundService] Error requesting POST_NOTIFICATIONS:', permError);
            // Continue with notifee request
          }
        }
        
        // Check notifee permission status first
        const currentNotifeeSettings = await notifee.getNotificationSettings();
        console.log('📢 [BackgroundService] Current Notifee permission status:', currentNotifeeSettings);
        
        // Only request if not already authorized
        let notifeeSettings;
        if (currentNotifeeSettings.authorizationStatus === 1) {
          // Already authorized
          console.log('✅ [BackgroundService] Notifee permission already authorized');
          notifeeSettings = currentNotifeeSettings;
        } else {
          // Request permission (will show dialog if not determined)
          console.log('📢 [BackgroundService] Requesting Notifee permission...');
          notifeeSettings = await notifee.requestPermission();
          console.log('📢 [BackgroundService] Notifee permission request result:', notifeeSettings);
        }
        
        if (notifeeSettings.authorizationStatus === 1) { // AUTHORIZED
          console.log('✅ [BackgroundService] Notifee permission authorized');
        } else if (notifeeSettings.authorizationStatus === 0) { // NOT_DETERMINED
          console.warn('⚠️ [BackgroundService] Notifee permission not determined');
        } else {
          console.warn('⚠️ [BackgroundService] Notifee permission denied or restricted');
        }
        
        // Create a channel for background notifications
        const channelId = await notifee.createChannel({
          id: 'kavach-background',
          name: 'Kavach Background Service',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });
        console.log('✅ [BackgroundService] Notification channel created:', channelId);
        
        // Create a channel for debug notifications with actions
        const debugChannelId = await notifee.createChannel({
          id: 'kavach-debug',
          name: 'Kavach Debug Notifications',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });
        console.log('✅ [BackgroundService] Debug notification channel created:', debugChannelId);
        
        // Return true if either permission method succeeded
        const isAuthorized = notifeeSettings.authorizationStatus === 1 || (androidVersion >= 33 && postNotificationsGranted);
        return isAuthorized;
      }
      return true;
    } catch (error) {
      console.error('🔴 [BackgroundService] Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Show a debug notification with optional test API button
   */
  async showDebugNotification(title, body, data = {}, showTestButton = false) {
    try {
      // Delete and recreate channel to ensure fresh settings (helps with action buttons)
      if (Platform.OS === 'android') {
        try {
          await notifee.deleteChannel('kavach-debug');
          console.log('🗑️ [BackgroundService] Deleted old debug channel');
        } catch (e) {
          // Channel might not exist, that's okay
          console.log('ℹ️ [BackgroundService] Channel does not exist yet');
        }
      }

      // Ensure channel exists with proper settings for actions
      const channelId = await notifee.createChannel({
        id: 'kavach-debug',
        name: 'Kavach Debug Notifications',
        importance: AndroidImportance.HIGH, // HIGH importance required for actions
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FF0000',
      });
      console.log('✅ [BackgroundService] Created debug channel:', channelId);

      const notificationConfig = {
        id: Date.now().toString(), // Unique ID for each notification
        title,
        body,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'default',
          },
          data,
          ongoing: false,
          autoCancel: true,
          // Make notification expandable
          style: {
            type: 1, // BigTextStyle - makes notification expandable
            text: body,
          },
        },
      };

      // Add test API button if requested
      if (showTestButton) {
        notificationConfig.android.actions = [
          {
            title: '🧪 Test API',
            pressAction: {
              id: 'test_api',
            },
          },
        ];
        
        // Add more text to body to make it expandable
        notificationConfig.body = `${body}\n\nSwipe down to expand and see Test API button`;
        notificationConfig.android.style.text = notificationConfig.body;
        
        console.log('📢 [BackgroundService] Adding Test API button to notification');
        console.log('📢 [BackgroundService] Notification config:', JSON.stringify(notificationConfig, null, 2));
      }

      const notificationId = await notifee.displayNotification(notificationConfig);
      console.log(`📢 [BackgroundService] Debug notification displayed: ${title} - ${body}${showTestButton ? ' (with Test API button, ID: ' + notificationId + ')' : ''}`);
      
      // Verify the notification was created with actions
      if (showTestButton) {
        try {
          const displayedNotifications = await notifee.getDisplayedNotifications();
          const ourNotification = displayedNotifications.find(n => n.id === notificationId);
          if (ourNotification) {
            console.log('📢 [BackgroundService] Notification details:', JSON.stringify(ourNotification, null, 2));
            if (ourNotification.android?.actions && ourNotification.android.actions.length > 0) {
              console.log('✅ [BackgroundService] Actions found in notification:', ourNotification.android.actions);
            } else {
              console.warn('⚠️ [BackgroundService] No actions found in displayed notification');
              console.warn('⚠️ [BackgroundService] Android config:', JSON.stringify(ourNotification.android, null, 2));
            }
          } else {
            console.warn('⚠️ [BackgroundService] Notification not found in displayed notifications');
          }
        } catch (verifyError) {
          console.warn('⚠️ [BackgroundService] Error verifying notification:', verifyError);
        }
      }
      
      return notificationId;
    } catch (error) {
      console.error('🔴 [BackgroundService] Failed to show debug notification:', error);
      console.error('🔴 [BackgroundService] Error details:', JSON.stringify(error, null, 2));
    }
  }

  /**
   * Setup notification event handlers (for action buttons)
   */
  setupNotificationHandlers() {
    console.log('🔔 [BackgroundService] Setting up notification event handlers...');
    
    // Handle notification events (button presses, etc.)
    notifee.onForegroundEvent(async ({ type, detail }) => {
      console.log('🔔 [BackgroundService] Foreground event:', type, detail);
      const { pressAction } = detail;
      
      if (type === EventType.ACTION_PRESS) {
        console.log('🔔 [BackgroundService] Action pressed:', pressAction?.id);
        if (pressAction?.id === 'test_api') {
          console.log('🧪 [BackgroundService] Test API button pressed (foreground)');
          await this.handleTestAPICall();
        }
      } else if (type === EventType.PRESS) {
        console.log('🔔 [BackgroundService] Notification pressed (not action)');
      }
    });

    // Handle background events
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('🔔 [BackgroundService] Background event:', type, detail);
      const { pressAction } = detail;
      
      if (type === EventType.ACTION_PRESS) {
        console.log('🔔 [BackgroundService] Action pressed (background):', pressAction?.id);
        if (pressAction?.id === 'test_api') {
          console.log('🧪 [BackgroundService] Test API button pressed (background)');
          await this.handleTestAPICall();
        }
      }
    });
    
    console.log('✅ [BackgroundService] Notification event handlers setup complete');
  }

  /**
   * Handle test API call
   */
  async handleTestAPICall() {
    try {
      console.log('🧪 [BackgroundService] Calling test API...');
      
      // Show notification that API call is in progress
      await this.showDebugNotification(
        '🧪 Testing API',
        'Calling test endpoint...',
        { type: 'test_api_in_progress' }
      );

      // Get location for test
      const location = await this.getCurrentLocation();
      
      // Get device info - use BLE device ID
      let deviceId = this.currentDeviceId || 'test-device';
      let deviceInfo = 'test-device-info';
      try {
        // Use mobile device info for deviceInfo field
        deviceInfo = await DeviceInfo.getDeviceName();
      } catch (e) {
        console.warn('⚠️ [BackgroundService] Failed to get device info:', e);
      }
      
      if (!deviceId || deviceId === 'test-device') {
        console.warn('⚠️ [BackgroundService] No BLE device ID available, using fallback');
      }

      // Call test API (using triggerEmergency as test endpoint)
      const testData = {
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
        deviceId,
        deviceInfo,
      };

      console.log('🧪 [BackgroundService] Calling triggerEmergency API with test data:', testData);
      const response = await ApiService.triggerEmergency(testData);
      console.log('✅ [BackgroundService] Test API call successful:', response);

      // Show success notification
      await this.showDebugNotification(
        '✅ Test API Success',
        `Response: ${JSON.stringify(response?.message || 'Success')}`,
        { type: 'test_api_success', response: JSON.stringify(response) }
      );
    } catch (error) {
      console.error('🔴 [BackgroundService] Test API call failed:', error);
      await this.showDebugNotification(
        '❌ Test API Failed',
        `Error: ${error.message || 'Unknown error'}`,
        { type: 'test_api_failed', error: error.message }
      );
    }
  }

  /**
   * Get current location (works in background)
   */
  async getCurrentLocation() {
    return new Promise((resolve) => {
      // Request location permission if needed (for background)
      if (Platform.OS === 'android') {
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ).then(() => {
          Geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              console.error('🔴 [BackgroundService] Location error:', error);
              resolve({ latitude: 0, longitude: 0 });
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
          );
        }).catch((error) => {
          console.error('🔴 [BackgroundService] Permission error:', error);
          resolve({ latitude: 0, longitude: 0 });
        });
      } else {
        Geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            console.error('🔴 [BackgroundService] Location error:', error);
            resolve({ latitude: 0, longitude: 0 });
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
        );
      }
    });
  }

  /**
   * Trigger SOS in background
   */
  async triggerSOS() {
    try {
      console.log('🚨 [BackgroundService] Triggering SOS in background...');
      
      // Show notification
      await this.showDebugNotification(
        '🚨 SOS Triggered',
        'Emergency alert is being sent...',
        { type: 'sos_triggered' }
      );

      // Get location
      const location = await this.getCurrentLocation();
      
      // Get device info - use BLE device ID
      let deviceId = this.currentDeviceId || 'unknown';
      let deviceInfo = 'unknown';
      try {
        // Use mobile device info for deviceInfo field
        deviceInfo = await DeviceInfo.getDeviceName();
      } catch (e) {
        console.warn('⚠️ [BackgroundService] Failed to get device info:', e);
      }
      
      if (!deviceId || deviceId === 'unknown') {
        console.warn('⚠️ [BackgroundService] No BLE device ID available for SOS trigger');
      }

      // Call API
      const locationData = {
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
        deviceId,
        deviceInfo,
      };

      console.log('🚨 [BackgroundService] Calling triggerEmergency API:', locationData);
      const response = await ApiService.triggerEmergency(locationData);
      console.log('✅ [BackgroundService] SOS API call successful:', response);

      // Show success notification
      await this.showDebugNotification(
        '✅ SOS Sent',
        response?.message || 'Emergency alert sent successfully',
        { type: 'sos_sent' }
      );

      return response;
    } catch (error) {
      console.error('🔴 [BackgroundService] SOS trigger failed:', error);
      await this.showDebugNotification(
        '⚠️ SOS Failed',
        'Failed to send emergency alert. Please try again.',
        { type: 'sos_failed' }
      );
      throw error;
    }
  }

  /**
   * Setup BLE monitoring for background
   */
  async setupBackgroundMonitoring(deviceId) {
    try {
      console.log('🔔 [BackgroundService] Setting up background monitoring for device:', deviceId);
      
      if (this.isMonitoring && this.currentDeviceId === deviceId) {
        console.log('⚠️ [BackgroundService] Already monitoring this device');
        return;
      }

      // Stop existing monitoring
      if (this.notificationSubscriptionRef) {
        try {
          this.notificationSubscriptionRef.remove();
        } catch (e) {
          console.warn('⚠️ [BackgroundService] Error removing old subscription:', e);
        }
        this.notificationSubscriptionRef = null;
      }

      // Get device from connected devices
      const connectedDevices = await BluetoothService.getConnectedDevices([SERVICE_UUID]);
      const device = connectedDevices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error(`Device with ID ${deviceId} is not connected`);
      }

      // Discover services
      await device.discoverAllServicesAndCharacteristics();

      // Monitor characteristic
      const subscription = BluetoothService.monitorCharacteristic(
        device,
        SERVICE_UUID,
        CHAR_UUID,
        (hex, characteristic) => {
          console.log(`🔔 [BackgroundService] Background notification received: ${hex}`);
          
          // Update Redux state (on main thread)
          InteractionManager.runAfterInteractions(() => {
            store.dispatch(setLastHex(hex));
          });

          // Show debug notification
          this.showDebugNotification(
            '🔔 BLE Notification',
            `Hex value received: ${hex}`,
            { type: 'ble_notification', hex }
          );

          // Check for SOS trigger
          if (hex === '01' || hex === '0x01') {
            const currentAppState = AppState.currentState;
            const isBackground = currentAppState !== 'active';
            
            if (isBackground) {
              // App is in background - handle SOS here
              console.log('🚨 [BackgroundService] SOS hex detected in background - calling BackgroundService.triggerSOS()');
              this.triggerSOS();
            } else {
              // App is in foreground - call HomeScreen's handleSOS instead
              console.log('🚨 [BackgroundService] SOS hex detected in foreground - calling HomeScreen handleSOS');
              if (this.foregroundSOSHandler && typeof this.foregroundSOSHandler === 'function') {
                InteractionManager.runAfterInteractions(() => {
                  this.foregroundSOSHandler();
                });
              } else {
                console.warn('⚠️ [BackgroundService] No foreground SOS handler registered, falling back to background handler');
                this.triggerSOS();
              }
            }
          }
        }
      );

      this.notificationSubscriptionRef = subscription;
      this.currentDeviceId = deviceId;
      this.isMonitoring = true;

      // Update Redux state
      InteractionManager.runAfterInteractions(() => {
        store.dispatch(setNotificationsActive(true));
      });

      // Show notification with test button
      const notificationId = await this.showDebugNotification(
        '✅ Background Monitoring Active',
        `Monitoring device: ${deviceId.substring(0, 8)}...\n\nIMPORTANT: Swipe down on this notification to expand it and see the "Test API" button below.`,
        { type: 'monitoring_started' },
        true // Show test API button
      );
      
      console.log('📢 [BackgroundService] Monitoring notification ID:', notificationId);
      
      // Show a second simple test notification after 3 seconds to verify actions work
      setTimeout(async () => {
        console.log('🧪 [BackgroundService] Showing test notification with button...');
        await this.showDebugNotification(
          '🧪 TEST: Action Button',
          'This is a test notification. Please SWIPE DOWN to expand and look for the "Test API" button at the bottom.',
          { type: 'test_action_button' },
          true
        );
      }, 3000);

      console.log('✅ [BackgroundService] Background monitoring setup complete');
    } catch (error) {
      console.error('🔴 [BackgroundService] Failed to setup background monitoring:', error);
      this.isMonitoring = false;
      InteractionManager.runAfterInteractions(() => {
        store.dispatch(setNotificationsActive(false));
      });
      await this.showDebugNotification(
        '⚠️ Monitoring Failed',
        `Failed to setup background monitoring: ${error.message}`,
        { type: 'monitoring_failed' }
      );
      throw error;
    }
  }

  /**
   * Stop background monitoring
   */
  stopBackgroundMonitoring() {
    try {
      console.log('🛑 [BackgroundService] Stopping background monitoring');
      
      if (this.notificationSubscriptionRef) {
        this.notificationSubscriptionRef.remove();
        this.notificationSubscriptionRef = null;
      }

      this.isMonitoring = false;
      this.currentDeviceId = null;

      InteractionManager.runAfterInteractions(() => {
        store.dispatch(setNotificationsActive(false));
      });

      this.showDebugNotification(
        '🛑 Monitoring Stopped',
        'Background monitoring has been stopped',
        { type: 'monitoring_stopped' }
      );
    } catch (error) {
      console.error('🔴 [BackgroundService] Error stopping monitoring:', error);
    }
  }

  /**
   * Setup app state monitoring to handle background/foreground transitions
   */
  setupAppStateMonitoring() {
    if (this.appStateSubscription) {
      return; // Already set up
    }

    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log(`📱 [BackgroundService] App state changed: ${nextAppState}`);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 [BackgroundService] App went to background');
        this.showDebugNotification(
          '📱 App in Background',
          'Background monitoring is active',
          { type: 'app_background' }
        );
      } else if (nextAppState === 'active') {
        console.log('📱 [BackgroundService] App came to foreground');
        // Optionally refresh connection status
      }
    });
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopBackgroundMonitoring();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default new BackgroundService();
