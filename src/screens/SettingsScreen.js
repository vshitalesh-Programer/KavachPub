import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/slices/authSlice';
import { clearContacts } from '../redux/slices/contactSlice';
import { clearIncidents } from '../redux/slices/incidentSlice';
import { clearConnectedDevice, setConnectedDevice } from '../redux/slices/deviceSlice';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';
import BluetoothService from '../services/BluetoothService';
// import NotificationManager from '../services/NotificationManager';
import { persistor } from '../redux/store';
import AppFonts from '../utils/AppFonts';
import { SERVICE_UUID, DEVICE_NAME } from '../constants/BluetoothConstants';

const DEVICE_STORAGE_KEY = '@kavach:connected_device_id';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const connectedDevice = useSelector(state => state.device.connectedDevice);
  
  const [devices, setDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnectModalVisible, setIsConnectModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState(null);
  const scanSubscriptionRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanSubscriptionRef.current) {
        BluetoothService.stopScan();
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const fetchDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const devicesData = await ApiService.getDevices();
      
      // Handle different response formats
      const devicesList = Array.isArray(devicesData) 
        ? devicesData 
        : (devicesData?.devices || devicesData?.data || []);
      
      setDevices(devicesList || []);
      console.log('[Settings] Devices loaded:', devicesList.length);
    } catch (error) {
      console.error('[Settings] Error fetching devices:', error);
      setDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const startScan = async () => {
    if (isScanning) return;

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
        return;
      }

      setIsScanning(true);
      setPeripherals([]);

      const onDeviceFound = (error, device) => {
        if (error) {
          console.error('[Settings] Device scan error:', error);
          setIsScanning(false);
          Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
          return;
        }

        if (device) {
          console.log('[Settings] Device found:', device.name, device.id);
          
          if (device.name && device.name.toLowerCase().includes(DEVICE_NAME.toLowerCase())) {
            setPeripherals((prev) => {
              const exists = prev.find((p) => p.id === device.id);
              if (exists) return prev;
              return [...prev, device];
            });
          }
        }
      };

      const subscription = BluetoothService.scanForDevices(
        SERVICE_UUID,
        DEVICE_NAME,
        onDeviceFound
      );
      scanSubscriptionRef.current = subscription;

      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
      }, 10000);
    } catch (error) {
      console.error('[Settings] Scan error:', error);
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

      console.log('[Settings] Connecting to device:', device.id, device.name);

      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to connect to devices.');
        setIsConnecting(false);
        return;
      }

      const { isEnabled, state } = await BluetoothService.checkBluetoothState();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Not Enabled',
          `Bluetooth is not enabled. Current state: ${state}.\n\nPlease enable Bluetooth in your device settings.`
        );
        setIsConnecting(false);
        return;
      }

      // Connect to device
      const connectedDeviceObj = await BluetoothService.connectToDevice(device.id);
      console.log('[Settings] Connected successfully');

      // Setup notifications
      // try {
      //   await NotificationManager.setupNotifications(connectedDeviceObj.id);
      //   console.log('[Settings] Notifications setup complete');
      // } catch (notifyErr) {
      //   console.warn('[Settings] Failed to setup notifications:', notifyErr);
      //   // Continue even if notifications fail
      // }

      // Register device in backend
      try {
        await ApiService.createDevice({
          deviceId: device.id,
          id: device.id,
        });
        console.log('[Settings] Device registered in backend');

        // Store device ID in AsyncStorage
        try {
          await AsyncStorage.setItem(DEVICE_STORAGE_KEY, device.id);
        } catch (storageError) {
          console.error('[Settings] Error storing device ID:', storageError);
        }

        // Store in Redux
        dispatch(setConnectedDevice({
          id: device.id,
          name: device.name || 'Kavach Device',
          deviceId: device.id,
        }));

        // Refresh devices list
        await fetchDevices();

        Alert.alert(
          '✅ Device Connected',
          `Successfully connected and registered "${device.name || device.id}".`,
          [
            {
              text: 'OK',
              onPress: () => setIsConnectModalVisible(false),
            },
          ]
        );
      } catch (apiError) {
        console.error('[Settings] Error registering device:', apiError);
        
        // Still store locally
        try {
          await AsyncStorage.setItem(DEVICE_STORAGE_KEY, device.id);
          dispatch(setConnectedDevice({
            id: device.id,
            name: device.name || 'Kavach Device',
            deviceId: device.id,
          }));
        } catch (storageError) {
          console.error('[Settings] Error storing device locally:', storageError);
        }

        Alert.alert(
          'Connection Successful',
          'Device connected but could not be registered. You can try again later.',
          [
            {
              text: 'OK',
              onPress: () => setIsConnectModalVisible(false),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[Settings] Connection failed:', error);
      setIsConnecting(false);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      Alert.alert('Connection Failed', `Failed to connect to device:\n${errorMsg}`);
    }
  };

  const handleDeleteDevice = (device) => {
    const deviceIdsArray = Array.isArray(device.deviceId) ? device.deviceId : [device.deviceId].filter(Boolean);
    const deviceName = device.name || deviceIdsArray[0] || device.id || 'Unknown Device';
    
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete "${deviceName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingDeviceId(device.id);
              await ApiService.deleteDevice(device.id);
              console.log('[Settings] Device deleted successfully');
              
              // If the deleted device was connected, clear it
              const deletedDeviceIds = Array.isArray(device.deviceId) ? device.deviceId : [device.deviceId].filter(Boolean);
              const isCurrentlyConnected = deletedDeviceIds.some(
                (deviceId) => 
                  connectedDevice?.deviceId === deviceId || 
                  connectedDevice?.id === deviceId
              ) || connectedDevice?.id === device.id;
              
              if (isCurrentlyConnected) {
                dispatch(clearConnectedDevice());
                try {
                  await AsyncStorage.removeItem(DEVICE_STORAGE_KEY);
                } catch (storageError) {
                  console.error('[Settings] Error clearing device from storage:', storageError);
                }
              }
              
              // Refresh devices list
              await fetchDevices();
              
              Alert.alert('Success', 'Device deleted successfully');
            } catch (error) {
              console.error('[Settings] Error deleting device:', error);
              const errorMsg = error.message || 'Failed to delete device';
              Alert.alert('Delete Failed', `Could not delete device:\n${errorMsg}`);
            } finally {
              setDeletingDeviceId(null);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? All your local data will be cleared.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear API service token
              ApiService.setToken(null);

              // Sign out from Google Sign-In
              try {
                const isSignedIn = await GoogleSignin.isSignedIn();
                if (isSignedIn) {
                  await GoogleSignin.signOut();
                  console.log('[Logout] Google Sign-In signed out');
                }
              } catch (googleError) {
                console.warn('[Logout] Error signing out from Google:', googleError);
                // Continue with logout even if Google sign-out fails
              }

              // Clear AsyncStorage
              try {
                await AsyncStorage.removeItem(DEVICE_STORAGE_KEY);
                console.log('[Logout] AsyncStorage cleared');
              } catch (storageError) {
                console.warn('[Logout] Error clearing AsyncStorage:', storageError);
              }

              // Clear all Redux state
              dispatch(clearContacts());
              dispatch(clearIncidents());
              dispatch(clearConnectedDevice());
              dispatch(logout());

              // Clear redux-persist storage
              try {
                await persistor.purge();
                console.log('[Logout] Redux-persist storage purged');
              } catch (persistError) {
                console.warn('[Logout] Error purging redux-persist:', persistError);
              }

              console.log('[Logout] Logout completed successfully');
            } catch (error) {
              console.error('[Logout] Error during logout:', error);
              // Still dispatch logout even if cleanup fails
              dispatch(logout());
            }
          },
        },
      ]
    );
  };

  return (

    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header Icon */}
        <View style={styles.header}>
          <Image source={require('../assets/images/kavach-shield-old.png')} style={styles.logo} />
        </View>

        {/* Main Settings Box */}
        <View style={styles.settingsBox}>
          <Text style={styles.title}>⚙️ Account details</Text>

          <View style={styles.autoTextBox}>
            <Text style={styles.autoTitle}>Email Profile</Text>
            <Text style={styles.autoDesc}>{user?.email || 'No email found'}</Text>
          </View>

          <View style={[styles.autoTextBox, styles.autoTextBoxMargin]}>
            <Text style={styles.autoTitle}>User Name</Text>
            <Text style={styles.autoDesc}>{user?.name || 'Kavach User'}</Text>
          </View>
        </View>

        {/* Devices Section */}
        <View style={styles.settingsBox}>
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>Registered Devices</Text>
            <TouchableOpacity
              style={styles.addDeviceButton}
              onPress={() => setIsConnectModalVisible(true)}>
              <Text style={styles.addDeviceButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {isLoadingDevices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
          ) : devices.length > 0 ? (
            <FlatList
              data={devices}
              keyExtractor={(item, index) => item?.id || `device-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => {
                // Handle deviceId as array (from API response)
                const deviceIds = Array.isArray(item.deviceId) ? item.deviceId : [item.deviceId].filter(Boolean);
                const primaryDeviceId = deviceIds[0] || item.id || 'N/A';
                
                // Check if connected device matches any deviceId in the array
                const isConnected = deviceIds.some(
                  (deviceId) => 
                    connectedDevice?.deviceId === deviceId || 
                    connectedDevice?.id === deviceId
                ) || connectedDevice?.id === item.id;
                
                const isDeleting = deletingDeviceId === item.id;
                
                return (
                  <View style={styles.deviceItem}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>
                        {item.name || `Device ${item.id?.substring(0, 8) || 'Unknown'}`}
                      </Text>
                      <Text style={styles.deviceId}>
                        {deviceIds.length > 0 
                          ? (deviceIds.length === 1 ? primaryDeviceId : `${deviceIds.length} devices: ${deviceIds.join(', ')}`)
                          : item.id || 'N/A'
                        }
                      </Text>
                      {item.createdAt && (
                        <Text style={styles.deviceDate}>
                          Added: {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.deviceActions}>
                      {isConnected && (
                        <View style={styles.connectedBadge}>
                          <Text style={styles.connectedBadgeText}>Connected</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                        onPress={() => handleDeleteDevice(item)}
                        disabled={isDeleting}>
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No devices registered</Text>
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No devices registered</Text>
              <Text style={styles.emptySubtext}>Tap "Add Device" to connect a new device</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Logout Button - Fixed at bottom */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Connect Device Modal */}
      <Modal
        visible={isConnectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          stopScan();
          setIsConnectModalVisible(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connect Device</Text>
              <TouchableOpacity
                onPress={() => {
                  stopScan();
                  setIsConnectModalVisible(false);
                }}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {!isScanning && peripherals.length === 0 && !isConnecting && (
              <View style={styles.modalInitialState}>
                <Text style={styles.modalInstructionText}>
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
              <View style={styles.modalScanningState}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.modalScanningText}>Scanning for devices...</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopScan}>
                  <Text style={styles.stopButtonText}>Stop Scanning</Text>
                </TouchableOpacity>
              </View>
            )}

            {isConnecting && (
              <View style={styles.modalConnectingState}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.modalConnectingText}>Connecting to device...</Text>
              </View>
            )}

            {!isScanning && !isConnecting && peripherals.length > 0 && (
              <FlatList
                data={peripherals}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalDeviceItem}
                    onPress={() => connectToDevice(item)}
                    disabled={isConnecting}>
                    <View style={styles.modalDeviceInfo}>
                      <Text style={styles.modalDeviceName}>{item.name || 'Unknown Device'}</Text>
                      <Text style={styles.modalDeviceId}>{item.id}</Text>
                    </View>
                    <Text style={styles.modalConnectText}>Connect</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#68778f',
    paddingTop: 60,
  },

  header: {
    marginBottom: AppFonts.nH(20),
    marginTop: AppFonts.nH(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: AppFonts.nW(20),
    // Removed row/alignItems/gap to stack vertically
  },

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

  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A1F2D',
    marginBottom: 20,
  },

  settingsBox: {
    backgroundColor: '#68778f',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#94a0b2',
    marginHorizontal: 20,
    marginTop: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 18,
  },

  sectionLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },

  modeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: '#1C1E25',
  },

  modeActive: {
    backgroundColor: '#FF4A4A',
  },

  modeText: {
    color: '#B5B8BD',
    fontSize: 16,
  },

  modeTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  helperText: {
    color: '#7D8187',
    fontSize: 12,
    marginBottom: 10,
  },

  /* Hold Duration */
  holdBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#1C1E25',
  },

  holdActive: {
    backgroundColor: '#FF4A4A',
  },

  holdText: {
    color: '#B5B8BD',
    fontSize: 15,
  },

  holdTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  /* Auto Text Box */
  autoTextBox: {
    backgroundColor: '#68778f',
    padding: 16,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },
  autoTextBoxMargin: {
    marginTop: 10,
  },

  autoTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  autoDesc: {
    color: '#ffffff',
    fontSize: 13,
    marginTop: 6,
  },

  toggleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },

  toggleLabel: {
    color: '#B5B8BD',
    fontSize: 15,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 100, // Extra padding to account for fixed logout button
  },

  logoutBtn: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1C1E25',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2D35',
  },

  logoutText: {
    color: '#FF4A4A',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  addDeviceButton: {
    backgroundColor: '#e98f7c',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addDeviceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  deviceItem: {
    backgroundColor: '#68778f',
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#94a0b2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  deviceId: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
  },
  deviceDate: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  connectedBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connectedBadgeText: {
    color: '#d1fae5',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#68778f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalInitialState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalInstructionText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '600',
  },
  modalScanningState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalScanningText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
  modalConnectingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalConnectingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  modalDeviceItem: {
    backgroundColor: '#94a0b2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalDeviceInfo: {
    flex: 1,
  },
  modalDeviceName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalDeviceId: {
    color: '#E5E7EB',
    fontSize: 12,
  },
  modalConnectText: {
    color: '#e98f7c',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SettingsScreen;
