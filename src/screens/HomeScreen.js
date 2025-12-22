/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-alert */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert, ScrollView, PermissionsAndroid, Platform, Image, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import BackgroundService from '../services/BackgroundService';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import { addIncident } from '../redux/slices/incidentSlice';
import { setLastHex, setNotificationsActive } from '../redux/slices/deviceSlice';
import AppFonts from '../utils/AppFonts';
import { SERVICE_UUID, CHAR_UUID, DEVICE_NAME } from '../constants/BluetoothConstants';

const HomeScreen = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState(null);
  const [triggerHistory, setTriggerHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [userDevices, setUserDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [hasBackgroundLocationPermission, setHasBackgroundLocationPermission] = useState(false);
  const scanTimeoutRef = useRef(null);
  const scanSubscriptionRef = useRef(null);
  const notificationSubscriptionRef = useRef(null);
  const dispatch = useDispatch();
  const [incidents, setIncidents] = useState(0);
  const [contacts, setContacts] = useState(0);
  const connectedDeviceFromRedux = useSelector(state => state.device.connectedDevice);
  const lastHex = useSelector(state => state.device.lastHex);
  const notificationsActive = useSelector(state => state.device.notificationsActive);

  const lastLoggedIncident = incidents.length > 0 ? incidents[0] : null;
  
  // Get last trigger from API history (prefer API data over local incidents)
  const lastTrigger = triggerHistory.length > 0 ? triggerHistory[0] : null;

  const fetchTriggerHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const history = await ApiService.getTriggerHistory();
      
      // Handle different response formats
      const historyList = Array.isArray(history) 
        ? history 
        : (history?.triggers || history?.data || history?.history || []);
      
      // Sort by date (most recent first) if the API doesn't return sorted data
      const sortedHistory = Array.isArray(historyList) 
        ? [...historyList].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.timestamp || a.date || 0);
            const dateB = new Date(b.createdAt || b.timestamp || b.date || 0);
            return dateB - dateA;
          })
        : [];
      
      setTriggerHistory(sortedHistory);
    } catch (error) {
      console.error('[HomeScreen] Error fetching trigger history:', error);
      // Don't show error to user, just use local incidents as fallback
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const stats = await ApiService.getStats();
      console.log("🚀 ~ fetchStats ~ stats:", stats);
      if (stats) {
        setIncidents(stats.totalIncidents || 0);
        setContacts(stats.totalContacts || 0);
      }
    } catch (error) {
      console.error('[HomeScreen] Error fetching stats:', error);
    }
  };

  // Fetch trigger history and devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoadingDevices(true);
        const devicesData = await ApiService.getDevices();
        console.log("🚀 ~ fetchDevices ~ devicesData:", devicesData);
        
        // Handle different response formats
        const devicesList = Array.isArray(devicesData) 
          ? devicesData 
          : (devicesData?.devices || devicesData?.data || []);
        
        setUserDevices(devicesList || []);
        console.log('[HomeScreen] Devices loaded:', devicesList.length);
      } catch (error) {
        console.error('[HomeScreen] Error fetching devices:', error);
        setUserDevices([]);
      } finally {
        setIsLoadingDevices(false);
      }
    };

    fetchTriggerHistory();
    fetchDevices();
    fetchStats();
  }, []);

  // Initialize BLE and Background Service on mount
  useEffect(() => {
    const initServices = async () => {
      try {
        // Initialize BLE
        const hasPermissions = await BluetoothService.requestPermissions();
        if (hasPermissions) {
          await BluetoothService.initialize();
          console.log('✅ [BLE-PLX] Initialized successfully');
        } else {
          console.warn('⚠️ [BLE-PLX] Permissions not granted');
        }

        // Notification permissions are requested in ConnectDeviceScreen
        // Setup notification event handlers here
        BackgroundService.setupNotificationHandlers();

        // Request location permissions (including background for Android 10+)
        if (Platform.OS === 'android') {
          try {
            // Request fine location first
            const fineLocationGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              {
                title: 'Location Permission',
                message: 'Kavach needs location access to send your location during emergencies.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );

            if (fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log('✅ [HomeScreen] Fine location permission granted');
              
              // Request background location for Android 10+ (API 29+)
              try {
                const backgroundLocationGranted = await PermissionsAndroid.request(
                  PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                  {
                    title: 'Background Location Permission',
                    message: 'Kavach needs background location access to send your location even when the app is in the background.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                  }
                );
                if (backgroundLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
                  console.log('✅ [HomeScreen] Background location permission granted');
                } else {
                  console.warn('⚠️ [HomeScreen] Background location permission denied');
                }
              } catch (bgError) {
                // Background location permission might not be available on older Android versions
                console.log('ℹ️ [HomeScreen] Background location permission not available:', bgError);
              }
            } else {
              console.warn('⚠️ [HomeScreen] Location permission denied');
            }
          } catch (locationError) {
            console.error('🔴 [HomeScreen] Location permission request failed:', locationError);
          }
        }

        // Setup app state monitoring for background handling
        BackgroundService.setupAppStateMonitoring();
        
        // Setup notification event handlers (for action buttons)
        BackgroundService.setupNotificationHandlers();

        // Check background location permission status
        checkBackgroundLocationPermission();
      } catch (error) {
        console.error('🔴 [HomeScreen] Initialization failed:', error);
      }
    };
    initServices();

    return () => {
      // Cleanup on unmount
      if (scanSubscriptionRef.current) {
        BluetoothService.stopScan();
      }
    };
  }, []);

  // Setup notifications for connected device (foreground)
  const setupNotifications = useCallback(async (deviceId) => {
    try {
      console.log('🔔 [HomeScreen] Setting up notifications for device:', deviceId);
      
      // Get device from connected devices
      const connectedDevices = await BluetoothService.getConnectedDevices([SERVICE_UUID]);
      const device = connectedDevices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error(`Device with ID ${deviceId} is not connected`);
      }

      // Clean up existing subscription if any
      if (notificationSubscriptionRef.current) {
        try {
          notificationSubscriptionRef.current.remove();
        } catch (e) {
          console.warn('⚠️ [HomeScreen] Error removing old subscription:', e);
        }
        notificationSubscriptionRef.current = null;
      }

      // Discover services if not already done
      await device.discoverAllServicesAndCharacteristics();

      // Monitor characteristic for notifications (foreground)
      const subscription = BluetoothService.monitorCharacteristic(
        device,
        SERVICE_UUID,
        CHAR_UUID,
        (hex, characteristic) => {
          console.log(`🔔 [HomeScreen] Notification received: ${hex}`);
          
          // Update Redux state
          dispatch(setLastHex(hex));
          
          // Check for SOS trigger (foreground handling)
          if (hex === '01' || hex === '0x01') {
            console.log('🚨 [HomeScreen] SOS hex detected, triggering SOS');
            // Trigger SOS handler directly
            handleSOS();
          }
        }
      );

      notificationSubscriptionRef.current = subscription;
      dispatch(setNotificationsActive(true));
      console.log('✅ [HomeScreen] Notifications setup complete');

      // Read initial value
      try {
        const hex = await BluetoothService.readCharacteristic(device, SERVICE_UUID, CHAR_UUID);
        console.log('📖 [HomeScreen] Initial read:', hex);
        dispatch(setLastHex(hex));
        if (hex === '01' || hex === '0x01') {
          console.log('🚨 [HomeScreen] SOS hex detected on initial read');
          handleSOS();
        }
      } catch (readErr) {
        console.warn('⚠️ [HomeScreen] Initial read failed:', readErr);
      }

      // Setup background monitoring separately (only triggers when app is in background)
      try {
        console.log('🔔 [HomeScreen] Setting up background monitoring for device:', deviceId);
        await BackgroundService.setupBackgroundMonitoring(deviceId);
        console.log('✅ [HomeScreen] Background monitoring setup complete');
      } catch (bgError) {
        console.warn('⚠️ [HomeScreen] Failed to setup background monitoring:', bgError);
        // Don't throw - foreground monitoring is still active
      }
    } catch (error) {
      console.error('🔴 [HomeScreen] Failed to setup notifications:', error);
      dispatch(setNotificationsActive(false));
      throw error;
    }
  }, [dispatch, handleSOS]);

  // Cleanup notifications on unmount
  useEffect(() => {
    return () => {
      if (notificationSubscriptionRef.current) {
        try {
          notificationSubscriptionRef.current.remove();
        } catch (e) {
          console.warn('⚠️ [HomeScreen] Error removing notification subscription:', e);
        }
        notificationSubscriptionRef.current = null;
      }
    };
  }, []);

  // Check for already-connected devices on app start and when screen is focused
  const checkConnectedDevices = useCallback(async () => {
    try {
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        console.warn('⚠️ [BLE-PLX] Permissions not granted');
        return;
      }

      // Check Redux state first
      if (connectedDeviceFromRedux?.deviceId || connectedDeviceFromRedux?.id) {
        const deviceId = connectedDeviceFromRedux.deviceId || connectedDeviceFromRedux.id;
        console.log('[HomeScreen] Found device in Redux:', deviceId);
        
        // Verify it's actually connected via Bluetooth
        try {
          const connectedDevices = await BluetoothService.getConnectedDevices([SERVICE_UUID]);
          const isActuallyConnected = connectedDevices.some(
            d => (d.id === deviceId || d.id === connectedDeviceFromRedux.id) &&
                 d.name && d.name.toLowerCase().includes(DEVICE_NAME.toLowerCase())
          );
          
          if (isActuallyConnected) {
            setConnectedDeviceId(deviceId);
            console.log('[HomeScreen] Device confirmed connected via Bluetooth');
            
            // Setup notifications if not already active
            if (!notificationsActive) {
              try {
                await setupNotifications(deviceId);
              } catch (notifyErr) {
                console.warn('⚠️ [HomeScreen] Failed to setup notifications:', notifyErr);
              }
            }
            return;
          } else {
            // Device in Redux but not actually connected - clear it
            console.log('[HomeScreen] Device in Redux but not actually connected');
            setConnectedDeviceId(null);
            // Stop notifications if device is not connected
            if (notificationSubscriptionRef.current) {
              try {
                notificationSubscriptionRef.current.remove();
                notificationSubscriptionRef.current = null;
                dispatch(setNotificationsActive(false));
              } catch (e) {
                console.warn('⚠️ [HomeScreen] Error stopping notifications:', e);
              }
            }
            // Stop background monitoring
            BackgroundService.stopBackgroundMonitoring();
          }
        } catch (error) {
          console.warn('[HomeScreen] Error verifying connection:', error);
        }
      }

      // Check for connected devices with our service UUID
      const connectedDevices = await BluetoothService.getConnectedDevices([SERVICE_UUID]);
      
      for (const device of connectedDevices) {
        // Filter by name "Kavach"
        const nameMatch = device.name && device.name.toLowerCase().includes(DEVICE_NAME.toLowerCase());
        
        if (nameMatch) {
          console.log('🎯 [BLE-PLX] Found already-connected Kavach device:', device.id);
          setConnectedDeviceId(device.id);
          
          // Setup notifications if not already active
          if (!notificationsActive) {
            try {
              await setupNotifications(device.id);
            } catch (notifyErr) {
              console.warn('⚠️ [BLE-PLX] Failed to setup notifications:', notifyErr);
            }
          }
          break;
        }
      }
      
      // If no devices found, clear the connection state and stop notifications
      if (connectedDevices.length === 0) {
        setConnectedDeviceId(null);
        // Stop notifications
        if (notificationSubscriptionRef.current) {
          try {
            notificationSubscriptionRef.current.remove();
            notificationSubscriptionRef.current = null;
            dispatch(setNotificationsActive(false));
          } catch (e) {
            console.warn('⚠️ [HomeScreen] Error stopping notifications:', e);
          }
        }
        // Stop background monitoring
        BackgroundService.stopBackgroundMonitoring();
      }
    } catch (error) {
      console.warn('⚠️ [BLE-PLX] Error checking connected devices:', error);
    }
  }, [connectedDeviceFromRedux, notificationsActive, setupNotifications]);

  // Check on mount
  useEffect(() => {
    // Delay to allow BLE to initialize
    const timer = setTimeout(() => {
      checkConnectedDevices();
      checkBackgroundLocationPermission();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check background location permission status
  const checkBackgroundLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        // Check if background location permission is granted
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
        setHasBackgroundLocationPermission(hasPermission);
        console.log(`📍 [HomeScreen] Background location permission: ${hasPermission ? 'Granted' : 'Not granted'}`);
      } catch (error) {
        console.error('🔴 [HomeScreen] Error checking background location permission:', error);
        setHasBackgroundLocationPermission(false);
      }
    } else {
      // iOS - assume granted if fine location is granted
      setHasBackgroundLocationPermission(true);
    }
  }, []);

  // Request background location permission directly
  const requestBackgroundLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        // First check if fine location is granted (required before background location)
        const hasFineLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (!hasFineLocation) {
          // Request fine location first
          const fineLocationGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'Kavach needs location access to send your location during emergencies.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          if (fineLocationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Permission Required',
              'Fine location permission is required before background location can be enabled.',
              [{ text: 'OK' }]
            );
            return;
          }
        }

        // Now request background location permission
        console.log('📍 [HomeScreen] Requesting background location permission...');
        const backgroundLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Permission',
            message: 'Kavach needs "Allow all the time" location access to send your location during emergencies even when the app is in the background. Please select "Allow all the time" in the next screen.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (backgroundLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ [HomeScreen] Background location permission granted');
          setHasBackgroundLocationPermission(true);
          Alert.alert(
            '✅ Permission Granted',
            'Background location access has been enabled. Kavach can now send your location during emergencies even when the app is in the background.',
            [{ text: 'OK' }]
          );
        } else if (backgroundLocationGranted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.warn('⚠️ [HomeScreen] Background location permission denied permanently');
          Alert.alert(
            'Permission Denied',
            'Background location permission was denied. To enable it, please go to:\n\nSettings > Apps > Kavach > Permissions > Location\n\nThen select "Allow all the time"',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => Linking.openSettings()
              },
            ]
          );
        } else {
          console.warn('⚠️ [HomeScreen] Background location permission denied');
          setHasBackgroundLocationPermission(false);
        }

        // Re-check permission status
        await checkBackgroundLocationPermission();
      } catch (error) {
        console.error('🔴 [HomeScreen] Error requesting background location permission:', error);
        Alert.alert(
          'Error',
          'Failed to request background location permission. Please enable it manually in Settings > Apps > Kavach > Permissions > Location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings()
            },
          ]
        );
      }
    } else {
      // iOS - open settings
      Linking.openURL('app-settings:').catch((err) => {
        console.error('🔴 [HomeScreen] Error opening settings:', err);
      });
    }
  }, [checkBackgroundLocationPermission]);

  // Check when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Check connection status when screen is focused
      const timer = setTimeout(() => {
        checkConnectedDevices();
        checkBackgroundLocationPermission();
      }, 500);
      return () => clearTimeout(timer);
    }, [checkConnectedDevices, checkBackgroundLocationPermission])
  );

  // Format trigger date for display
  const formatTriggerDate = (trigger) => {
    if (!trigger) return 'N/A';
    
    // Try different date fields
    const dateStr = trigger.createdAt || trigger.timestamp || trigger.date || trigger.time;
    if (!dateStr) return 'Unknown date';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // If it's already a formatted string, return it
        return dateStr;
      }
      
      // Format as: "MMM DD, YYYY HH:MM"
      const options = { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return dateStr;
    }
  };


  const startScan = async () => {
    try {
      console.log('🟢 [BLE-PLX] Starting scan...');
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to scan for devices.');
        return;
      }

      // Clear previous scan
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (scanSubscriptionRef.current) {
        BluetoothService.stopScan();
      }

      setPeripherals(new Map());
      setIsScanning(true);

      // Start scanning with service UUID and name filter
      const deviceMap = new Map();
      const subscription = await BluetoothService.scanForDevices(
        SERVICE_UUID, 
        DEVICE_NAME,
        (error, device) => {
          if (error) {
            console.error('🔴 [BLE-PLX] Scan error:', error);
            return;
          }

          if (device) {
            console.log('✅ [BLE-PLX] Found Kavach device:', device.name || device.id, device.id);
            deviceMap.set(device.id, {
              id: device.id,
              name: device.name || 'Kavach Device',
              rssi: device.rssi,
              type: 'ble',
            });
            setPeripherals(new Map(deviceMap));
          }
        }
      );
      scanSubscriptionRef.current = subscription;

      // Auto-stop after 20 seconds
      scanTimeoutRef.current = setTimeout(() => {
        console.log('🟡 [BLE-PLX] Auto-stopping scan after timeout');
        BluetoothService.stopScan();
        setIsScanning(false);
        scanTimeoutRef.current = null;
      }, 20000);
    } catch (error) {
      console.error('🔴 [BLE-PLX] Scan error:', error);
      setIsScanning(false);
      Alert.alert('Scan Failed', `Scan failed: ${error.message || error}`);
    }
  };

  const connectToDevice = async (device) => {
    try {
      setIsScanning(false);
      BluetoothService.stopScan();

      console.log('🔵 [BLE-PLX] Attempting to connect to device:', device.id, device.name);

      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to connect to devices.');
        return;
      }

      // Connect to device
      const connectedDeviceObj = await BluetoothService.connectToDevice(device.id);
      console.log('✅ [BLE-PLX] Connected successfully');
      
      setConnectedDeviceId(device.id);

      Alert.alert(
        '✅ Device Connected',
        `Successfully connected to "${device.name || device.id}".\nSetting up notifications...`,
        [{ text: 'OK' }]
      );

      // Setup notifications
      try {
        await setupNotifications(connectedDeviceObj.id);
      } catch (notifyErr) {
        console.warn('⚠️ [BLE-PLX] Failed to setup notifications:', notifyErr);
        Alert.alert(
          'Connection Successful',
          'Device connected but notifications could not be set up. You can try reconnecting.',
          [{ text: 'OK' }]
        );
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error('🔴 [BLE-PLX] Connection failed:', error);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      Alert.alert(
        'Connection Failed',
        `Failed to connect to device:\n${errorMsg}\n\nDevice: ${device.name || device.id}\n\nPlease ensure:\n- Device is powered on\n- Device is in range\n- Device is not already connected to another app`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleReconnect = async () => {
    console.log('🟢 [BLE-PLX] Reconnect/Scan pressed');
    try {
      BluetoothService.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setPeripherals(new Map());
    setIsScanning(false);
    startScan();
  };

  const handleCloseModal = async () => {
    console.log('🟢 [BLE-PLX] Close modal pressed');
    try {
      BluetoothService.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
    setPeripherals(new Map());
    setIsModalVisible(false);
  };

  const openScanModal = async () => {
    try {
      BluetoothService.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setPeripherals(new Map());
    setIsScanning(false);
    setIsModalVisible(true);
    // Start scanning when modal opens
    startScan();
  };

  const renderDeviceItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceName}>{item.name || 'Kavach Device'}</Text>
          <Text style={[styles.tag, styles.bleTag]}>BLE</Text>
        </View>
        <Text style={styles.deviceId}>{item.id}</Text>
        {item.rssi && <Text style={styles.deviceRssi}>RSSI: {item.rssi}</Text>}
      </TouchableOpacity>
    );
  };

  const handleSOS = useCallback(async () => {
    try {
      console.log('🚨 [HomeScreen] Triggering SOS...');

      let ipAddress = '0.0.0.0';
      try {
        ipAddress = await DeviceInfo.getIpAddress();
      } catch (e) { console.warn('Failed to get IP', e); }

      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
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

        console.log('🚨 [HomeScreen] Dispatching SOS incident:', incidentData);
        dispatch(addIncident(incidentData));

        // Send to API
        try {
          const locationData = {
            latitude: lat || 0,
            longitude: lng || 0,
            deviceId: DeviceInfo ? await DeviceInfo.getUniqueId() : 'unknown',
            deviceInfo: DeviceInfo ? await DeviceInfo.getDeviceName() : 'unknown',
          };
          console.log('🚨 [HomeScreen] Calling API triggerEmergency with:', locationData);
          const response = await ApiService.triggerEmergency(locationData);
          console.log('✅ [HomeScreen] API call successful:', response);
          const message = response?.message || 'Emergency Alert Sent! Help is on the way.';
          Alert.alert('SOS Sent', message);
          // Refresh trigger history after API call
          console.log('🔄 [HomeScreen] Refreshing trigger history...');
          fetchTriggerHistory();
        } catch (err) {
          console.error('🚨 [HomeScreen] API Error:', err);
          Alert.alert('SOS Saved', 'Logged locally. Failed to send to server.');
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
      Alert.alert('Error', `Failed to initiate SOS: ${error.message || error}`);
    }
  }, [dispatch, fetchTriggerHistory]);

  return (
    <LinearGradient
      colors={['#66697d', '#68778f', '#68778f']}
      locations={[0, 0.2, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      angle={160}
      useAngle={true}
      style={styles.gradient}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../assets/images/kavach-shield-old.png')} style={styles.logo} />
          <View>
            <Text style={styles.appName}>Kavach</Text>
            <Text style={styles.subtitle}>Safety Console</Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Contacts')}>
              <Text style={styles.statLabel}>Contacts</Text>
              <Text style={styles.statValue}>{contacts > 0 ? contacts : '-'}</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Incidents</Text>
              <Text style={styles.statValue}>{incidents}</Text>
            </View>
          </View>

          {/* Connection Status Card */}
          <View style={styles.connectionCard}>
            <Text style={styles.connectionLabel}>BLE Device Status</Text>
            <Text style={styles.connectionValue}>
              {connectedDeviceId ? `✅ Connected (${connectedDeviceId.substring(0, 8)}...)` : '❌ Not Connected'}
            </Text>
            {lastHex && (
              <Text style={styles.connectionHex}>Last Hex: {lastHex}</Text>
            )}
            {userDevices.length > 0 && (
              <TouchableOpacity
                style={styles.viewDevicesButton}
                onPress={() => navigation.navigate('Settings')}>
                <Text style={styles.viewDevicesText}>
                  View {userDevices.length} Registered Device{userDevices.length > 1 ? 's' : ''} →
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Background Location Permission Card */}
          <TouchableOpacity 
            style={styles.locationPermissionCard}
            onPress={requestBackgroundLocationPermission}
            activeOpacity={0.7}
          >
            <View style={styles.locationPermissionContent}>
              <View style={styles.locationPermissionLeft}>
                <Text style={styles.locationPermissionIcon}>
                  {hasBackgroundLocationPermission ? '✅' : '⚠️'}
                </Text>
                <View>
                  <Text style={styles.locationPermissionTitle}>
                    Background Location
                  </Text>
                  <Text style={styles.locationPermissionSubtitle}>
                    {hasBackgroundLocationPermission 
                      ? 'All-time location access enabled' 
                      : 'Tap to enable all-time location access'}
                  </Text>
                </View>
              </View>
              {!hasBackgroundLocationPermission && (
                <Text style={styles.locationPermissionArrow}>→</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Scan Bluetooth Devices Card */}
          <TouchableOpacity style={styles.scanCard} onPress={openScanModal}>
            <View>
              <Text style={styles.scanTitle}>Scan Bluetooth Devices</Text>
              <Text style={styles.scanSubtitle}>Connect to Kavach safety wearables</Text>
            </View>
            <View style={styles.scanIconBox}>
              <Text style={styles.scanIconEmoji}>📡</Text>
            </View>
          </TouchableOpacity>

          {/* Hero Card - Ready to Protect */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroTitle}>Ready to Protect</Text>
                <Text style={styles.heroSubtitle}>Hold <Text style={styles.boldWhite}>5s</Text> • Mode Loud</Text>
              </View>
              <TouchableOpacity style={styles.adjustBtn} onPress={openScanModal}>
                <Text style={styles.adjustText}>Adjust</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sosContainer}>
              <TouchableOpacity
                style={styles.sosButton}
                onLongPress={handleSOS}
                delayLongPress={5000}
                activeOpacity={0.8}
                accessibilityLabel="Press and hold to trigger SOS"
              >
                <LinearGradient
                  colors={['#906f72', '#906f72', '#000000']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  angle={140}
                  useAngle
                  style={styles.sosButtonGradient}
                >
                  <LinearGradient
                    colors={['#2f3338', '#5a6068', '#9aa3ad', '#5b616a', '#2e3237']}
                    start={{ x: 0.3, y: 0.3 }}
                    end={{ x: 0.8, y: 0.8 }}
                    style={styles.sosOuter}
                  >
                    <View style={styles.sosInsetHighlight} />
                    <LinearGradient
                      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={styles.sosSheen}
                    />
                    <View style={styles.sosGlow} />
                    <LinearGradient
                      colors={['#4b4f55', '#6b7078', '#3c4046']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sosInner}
                    >
                      <Text style={styles.sosIcon}>🚨</Text>
                      <Text style={styles.sosText}>SOS</Text>
                      <Text style={styles.sosSubText}>Press & hold</Text>
                    </LinearGradient>
                  </LinearGradient>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Last Incident */}
          <View style={styles.lastIncidentCard}>
            <View>
              <Text style={styles.lastIncidentLabel}>Last Incident</Text>
              {isLoadingHistory ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.loadingIndicator} />
              ) : lastTrigger ? (
                <Text style={styles.lastIncidentValue}>
                  {formatTriggerDate(lastTrigger)} • {lastTrigger.mode || 'SOS'}
                </Text>
              ) : lastLoggedIncident ? (
                <Text style={styles.lastIncidentValue}>{lastLoggedIncident.time} • {lastLoggedIncident.mode}</Text>
              ) : (
                <Text style={styles.lastIncidentValue}>No incidents recorded.</Text>
              )}
            </View>
            <TouchableOpacity style={styles.viewLogBtn} onPress={() => setIsLogModalVisible(true)}>
              <Text style={styles.viewLogText}>View Log</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>

      {/* Scan Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kavach Devices</Text>
              <View style={styles.modalHeaderRight}>
                {isScanning && <ActivityIndicator color="#e98f7c" style={styles.scanIndicator} />}
                {!isScanning && (
                  <TouchableOpacity
                    style={styles.reconnectButton}
                    onPress={handleReconnect}
                  >
                    <Text style={styles.reconnectButtonText}>Reconnect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={styles.filterInfo}>
              Scanning for devices with service UUID: {SERVICE_UUID.substring(0, 20)}...
            </Text>
            <Text style={styles.filterInfo}>
              Device name filter: "{DEVICE_NAME}"
            </Text>

            <FlatList
              data={peripherals instanceof Map ? Array.from(peripherals.values()) : []}
              renderItem={renderDeviceItem}
              keyExtractor={(item, index) => item?.id || `device-${index}`}
              contentContainerStyle={styles.listContent}
              extraData={peripherals instanceof Map ? peripherals.size : 0}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {isScanning
                      ? 'Scanning for Kavach devices...'
                      : `No Kavach devices found. (Found: ${peripherals instanceof Map ? peripherals.size : 0})`}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Only devices with service UUID {SERVICE_UUID.substring(0, 20)}...{'\n'}
                    and name containing "{DEVICE_NAME}" will be shown.
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseModal}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Log Modal */}
      <Modal
        visible={isLogModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLogModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trigger History</Text>
              <TouchableOpacity onPress={() => setIsLogModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {isLoadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e98f7c" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : (
              <FlatList
                data={triggerHistory.length > 0 ? triggerHistory : []}
                keyExtractor={(item, index) => item?.id || item?._id || `trigger-${index}`}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <Text style={styles.emptyIncidents}>
                    No trigger history found.
                  </Text>
                }
                renderItem={({ item }) => {
                  // Handle both API trigger format and local incident format
                  const triggerDate = formatTriggerDate(item);
                  const mode = item.mode || 'SOS';
                  const lat = item.latitude || item.lat || item.location?.latitude || 'N/A';
                  const lng = item.longitude || item.lng || item.location?.longitude || 'N/A';
                  const ip = item.ip || item.deviceInfo?.ip || 'N/A';
                  
                  return (
                    <View style={styles.deviceItem}>
                      <View style={styles.deviceHeader}>
                        <Text style={styles.deviceName}>{triggerDate}</Text>
                        <Text style={[styles.tag, styles.bondedTag]}>{mode}</Text>
                      </View>
                      <Text style={styles.deviceId}>Lat: {lat}, Lng: {lng}</Text>
                      {ip !== 'N/A' && <Text style={styles.deviceId}>IP: {ip}</Text>}
                      {item.deviceId && <Text style={styles.deviceId}>Device: {item.deviceId}</Text>}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
};


const styles = StyleSheet.create({
  logo: {
    width: AppFonts.n(30),
    height: AppFonts.n(30),
    borderRadius: 12,
    backgroundColor: '#68778f',
    padding: AppFonts.n(20),
    marginRight: AppFonts.nW(10),
    borderWidth: 1,
    borderColor: '#94a0b2',
  },
  container: {
    flex: 1,
    paddingTop: AppFonts.nH(40),
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: AppFonts.nH(40),
  },

  header: {
    marginBottom: AppFonts.nH(20),
    marginTop: AppFonts.nH(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: AppFonts.nW(20),
  },

  appName: {
    fontSize: AppFonts.n(20),
    fontWeight: '700',
    color: 'white',
    marginBottom: AppFonts.nH(4),
  },

  subtitle: {
    color: '#ffffff',
    fontSize: AppFonts.n(11),
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: AppFonts.nW(14),
    marginBottom: AppFonts.nH(18),
    marginHorizontal: AppFonts.nW(20),
  },

  statCard: {
    flex: 1,
    backgroundColor: '#68778f',
    padding: AppFonts.n(10),
    borderRadius: AppFonts.n(16),
    paddingHorizontal: AppFonts.nW(14),
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },

  statLabel: { color: '#ffffff', fontSize: AppFonts.n(10), fontWeight: '500' },
  statValue: { color: 'white', fontSize: AppFonts.n(20), fontWeight: '700' },

  connectionCard: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(16),
    padding: AppFonts.n(12),
    marginBottom: AppFonts.nH(18),
    marginHorizontal: AppFonts.nW(20),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },
  connectionLabel: {
    color: '#ffffff',
    fontSize: AppFonts.n(10),
    fontWeight: '500',
    marginBottom: AppFonts.nH(4),
  },
  connectionValue: {
    color: 'white',
    fontSize: AppFonts.n(14),
    fontWeight: '600',
  },
  connectionHex: {
    color: '#cdd2db',
    fontSize: AppFonts.n(11),
    marginTop: AppFonts.nH(4),
  },
  viewDevicesButton: {
    marginTop: AppFonts.nH(12),
    paddingVertical: AppFonts.nH(8),
    paddingHorizontal: AppFonts.nW(12),
    backgroundColor: '#e98f7c',
    borderRadius: AppFonts.n(8),
    alignItems: 'center',
  },
  viewDevicesText: {
    color: '#FFFFFF',
    fontSize: AppFonts.n(12),
    fontWeight: '600',
  },

  locationPermissionCard: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(16),
    padding: AppFonts.n(12),
    marginBottom: AppFonts.nH(18),
    marginHorizontal: AppFonts.nW(20),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },
  locationPermissionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationPermissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationPermissionIcon: {
    fontSize: AppFonts.n(24),
    marginRight: AppFonts.nW(12),
  },
  locationPermissionTitle: {
    color: 'white',
    fontSize: AppFonts.n(14),
    fontWeight: '600',
    marginBottom: AppFonts.nH(2),
  },
  locationPermissionSubtitle: {
    color: '#cdd2db',
    fontSize: AppFonts.n(11),
  },
  locationPermissionArrow: {
    color: '#e98f7c',
    fontSize: AppFonts.n(20),
    fontWeight: '700',
    marginLeft: AppFonts.nW(8),
  },

  scanCard: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(16),
    padding: AppFonts.n(12),
    marginBottom: AppFonts.nH(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    marginHorizontal: AppFonts.nW(20),
  },
  scanTitle: { color: 'white', fontSize: AppFonts.n(14), fontWeight: '700' },
  scanSubtitle: { color: '#ffffff', fontSize: AppFonts.n(11), marginTop: AppFonts.nH(2) },
  scanIconBox: {
    width: AppFonts.nW(44),
    height: AppFonts.nH(44),
    backgroundColor: '#25262C',
    borderRadius: AppFonts.n(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIconEmoji: {
    fontSize: 22,
  },

  heroCard: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(24),
    padding: AppFonts.n(18),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    marginBottom: AppFonts.nH(20),
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    marginHorizontal: AppFonts.nW(20),
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    color: 'white',
    fontSize: AppFonts.n(16),
    fontWeight: '700',
  },

  heroSubtitle: {
    color: '#ffffff',
    fontSize: AppFonts.n(11),
    marginTop: AppFonts.nH(4),
  },
  boldWhite: {
    color: 'white',
    fontWeight: '700',
  },
  adjustBtn: {
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    borderRadius: AppFonts.n(20),
    paddingVertical: AppFonts.nH(6),
    paddingHorizontal: AppFonts.nW(16),
  },
  adjustText: {
    color: '#ffffff',
    fontSize: AppFonts.n(11),
    fontWeight: '500',
  },

  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: 20,
    marginBottom: 10,
  },

  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.45)',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 30,
    borderWidth: 1,
    borderColor: '#94a0b2',
  },

  sosButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    padding: 10,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sosOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sosInsetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    opacity: 0.6,
  },

  sosSheen: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 120,
    opacity: 0.45,
  },

  sosGlow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.35)',
    shadowColor: 'rgba(220,38,38,0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },

  sosInner: {
    width: '100%',
    height: '100%',
    borderRadius: 90,
    margin: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.45)',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
  },

  sosIcon: { fontSize: AppFonts.n(32), color: 'white', marginBottom: AppFonts.nH(4) },

  sosText: {
    fontSize: AppFonts.n(26),
    fontWeight: '700',
    color: 'white',
  },

  sosSubText: { color: '#ffffff', marginTop: AppFonts.nH(4), fontSize: AppFonts.n(10) },

  lastIncidentCard: {
    backgroundColor: '#68778f',
    padding: AppFonts.n(16),
    borderRadius: AppFonts.n(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
    marginBottom: AppFonts.nH(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    marginHorizontal: AppFonts.nW(20),
  },

  lastIncidentLabel: { color: 'white', fontSize: AppFonts.n(12), fontWeight: '600', marginBottom: AppFonts.nH(4) },

  lastIncidentValue: { color: '#ffffff', fontSize: AppFonts.n(11) },

  loadingIndicator: { marginTop: 4 },

  viewLogBtn: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(12),
    paddingVertical: AppFonts.nH(8),
    paddingHorizontal: AppFonts.nW(16),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
  },

  viewLogText: { color: '#ffffff', fontSize: AppFonts.n(11), fontWeight: '500' },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#68778f',
    borderTopLeftRadius: AppFonts.n(20),
    borderTopRightRadius: AppFonts.n(20),
    padding: AppFonts.n(20),
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppFonts.nH(15),
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    color: 'white',
    fontSize: AppFonts.n(16),
    fontWeight: '700',
  },
  modalClose: {
    color: '#ffffff',
    fontSize: 16,
  },
  scanIndicator: {
    marginRight: 0,
  },
  reconnectButton: {
    backgroundColor: '#e98f7c',
    paddingHorizontal: AppFonts.nW(12),
    paddingVertical: AppFonts.nH(6),
    borderRadius: AppFonts.n(8),
    borderWidth: AppFonts.n(1),
    borderColor: '#e98f7c',
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontSize: AppFonts.n(10),
    fontWeight: '600',
  },
  filterInfo: {
    color: '#cdd2db',
    fontSize: AppFonts.n(10),
    marginBottom: AppFonts.nH(8),
    fontStyle: 'italic',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyIncidents: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: AppFonts.n(14),
  },
  deviceItem: {
    backgroundColor: '#68778f',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deviceName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 2,
  },
  deviceRssi: {
    color: '#cdd2db',
    fontSize: 11,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  bleTag: {
    backgroundColor: '#1f2937',
    color: '#e5e7eb',
  },
  bondedTag: {
    backgroundColor: '#064e3b',
    color: '#d1fae5',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
  },
  emptySubtext: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: '#3A3B40',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default HomeScreen;

