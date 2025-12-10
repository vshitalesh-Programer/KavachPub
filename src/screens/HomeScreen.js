/* eslint-disable no-alert */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, NativeEventEmitter, NativeModules, Alert, ScrollView, PermissionsAndroid, Platform, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { normalize } from '../utils/AppFonts';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import BleManager from 'react-native-ble-manager';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import { addIncident } from '../redux/slices/incidentSlice';
import AppFonts from '../utils/AppFonts';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
const SERVICE_UUID = '12345678-1234-5678-1234-56789ABCDEF0';
const CHAR_UUID = '12345678-1234-5678-1234-56789ABCDEF1';

const HomeScreen = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [eventCount, setEventCount] = useState(0); // Track if events are received
  const [lastEvent, setLastEvent] = useState(null); // Store last event for debugging
  const [lastHex, setLastHex] = useState(null); // Store last notified hex value
  const scanTimeoutRef = useRef(null);
  const dispatch = useDispatch();
  const incidents = useSelector(state => state.incidents.incidents);
  const contacts = useSelector(state => state.contacts.contacts) || [];

  // Flatten contacts if they are sectioned
  const contactCount = contacts.reduce((acc, section) => acc + (section.data ? section.data.length : 0), 0);

  const lastLoggedIncident = incidents.length > 0 ? incidents[0] : null;

  useEffect(() => {
    BluetoothService.initialize();

    const handleDiscoverPeripheral = (peripheral) => {
      console.log('🔵 [BLE] Discovered peripheral:', JSON.stringify(peripheral, null, 2));
      if (!peripheral || !peripheral.id) {
        console.warn('⚠️ [BLE] Invalid peripheral data:', peripheral);
        return;
      }
      setPeripherals((map) => {
        // Ensure map is a Map instance
        const currentMap = map instanceof Map ? map : new Map();
        const newMap = new Map(currentMap);
        newMap.set(peripheral.id, {
          ...peripheral,
          type: peripheral.type || 'ble',
          isBonded: peripheral.isBonded || false,
        });
        console.log('✅ [BLE] Updated peripherals count:', newMap.size, 'Device:', peripheral.name || peripheral.id);
        return newMap;
      });
    };

    const handleStopScan = () => {
      setIsScanning(false);
      console.log('Scan stopped');
    };


    const discoverListener = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', (data) => {

      // Track events
      setEventCount(prev => prev + 1);
      setLastEvent(data);

      handleDiscoverPeripheral(data);
    });

    const stopScanListener = bleManagerEmitter.addListener('BleManagerStopScan', () => {
      console.log('🟡 [BLE] ===== BleManagerStopScan EVENT RECEIVED =====');
      handleStopScan();
    });

    const updateListener = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', ({ value, peripheral, characteristic, service }) => {
      const hex = value ? value.map(b => ('0' + b.toString(16)).slice(-2)).join('') : '';
      console.log(`🔔 [BLE] Notify ${peripheral} ${service} ${characteristic}:`, hex);
      setLastHex(hex);
      if (hex === '01' || hex === '0x01') {
        console.log('🚨 [BLE] SOS hex detected, triggering SOS');
        handleSOS();
      }
    });

    const listeners = [discoverListener, stopScanListener, updateListener];
    console.log('✅ [BLE] Event listeners registered:', listeners.length);
    console.log('✅ [BLE] Listening for: BleManagerDiscoverPeripheral, BleManagerStopScan, BleManagerDidUpdateValueForCharacteristic');

    return () => {
      listeners.forEach(l => l.remove());
    };
  }, []);

  const startScan = async () => {
    try {
      console.log('🟢 [BLE] Starting scan...');
      const hasPermissions = await BluetoothService.requestPermissions();
      console.log('🟢 [BLE] Permissions granted:', hasPermissions);
      if (hasPermissions) {
        // Ensure previous timeout/scan is cleared
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        try {
          await BleManager.stopScan();
          console.log('🟢 [BLE] Stopped any previous scan before restart');
        } catch (e) {
          // ignore
        }

        setPeripherals(new Map());
        setEventCount(0); // Reset event counter
        setLastEvent(null); // Reset last event
        setIsScanning(true);

        // Fetch bonded classic devices and discover nearby classic devices
        BluetoothService.scanClassicDevices().then(({ bonded, discovered }) => {
          console.log('🔵 [BT Classic] Bonded:', bonded.length, 'Discovered:', discovered.length);
          setPeripherals((prevMap) => {
            const newMap = new Map(prevMap);
            [...bonded, ...discovered].forEach(device => {
              if (device?.id) {
                newMap.set(device.id, {
                  ...device,
                  type: 'classic',
                  isBonded: !!device.isBonded,
                });
              }
            });
            return newMap;
          });
        });

        // Trigger Classic Discovery (unpaired) in background
        console.log('🟢 [Classic] Calling scanClassic...');
        BluetoothService.scanClassic().then(classicDevices => {
          console.log('🔵 [Classic] detailed results:', classicDevices.length);
          if (classicDevices.length > 0) {
            setPeripherals((prevMap) => {
              const newMap = new Map(prevMap);
              classicDevices.forEach(device => {
                // classic device often has 'address' instead of 'id', but verify lib output
                const id = device.address || device.id;
                if (id) {
                  // Prefer existing entry if it has more info (like from bonded list)
                  // But update it if we found it again.
                  // Actually, let's just add it.
                  newMap.set(id, {
                    id: id,
                    name: device.name || 'Unknown Classic Device',
                    address: device.address, // Keep address for Classic distinction
                    class: device.class,
                    rssi: device.rssi // Might be undefined
                  });
                }
              });
              return newMap;
            });
          }
        });

        // Start the scan
        console.log('🟢 [BLE] Calling scanForDevices...');
        await BluetoothService.scanForDevices(20); // 20 seconds
        console.log('🟢 [BLE] Scan initiated, waiting for devices...');
        console.log('🟢 [BLE] Event listeners should be active. Waiting for BleManagerDiscoverPeripheral events...');

        // Auto-stop scanning after duration
        scanTimeoutRef.current = setTimeout(async () => {
          console.log('🟡 [BLE] Auto-stopping scan after timeout');
          try {
            await BleManager.stopScan();
            console.log('🟡 [BLE] Scan stopped manually');
          } catch (e) {
            console.log('🟡 [BLE] Error stopping scan:', e);
          }
          setIsScanning(false);

          // Log final count
          setPeripherals((map) => {
            const currentMap = map instanceof Map ? map : new Map();
            console.log('🟡 [BLE] Final device count:', currentMap.size);
            return currentMap;
          });
          scanTimeoutRef.current = null;
        }, 20000); // 20 seconds
      } else {
        console.warn('🔴 [BLE] Bluetooth permissions denied');
        Alert.alert('Permission Required', 'Bluetooth permissions are required to scan for devices.');
      }
    } catch (error) {
      console.error('🔴 [BLE] Scan error:', error);
      setIsScanning(false);
      Alert.alert('Scan Failed', `Scan failed: ${error.message || error}`);
    }
  };

  const connectToDevice = async (device) => {
    try {
      setIsScanning(false); // Stop scanning before connecting

      // Check if it's a Classic device (we marked it with 'address' or 'deviceClass' usually, or just check ID format/missing RSSI?)
      // For now, if we have a way to distinguish, great. 
      // RNBluetoothClassic devices usually have `address` and `deviceClass`. BleManager devices use `id` (UUID on iOS, Mac on Android).
      // Let's assume if it came from our scanClassic merge, it might be distinguishable.
      // But actually, `connectToClassicDevice` handles the classic connection. 
      // We can try Classic connection if it looks like a classic device, or try BLE if it fails?

      // Simple heuristic: If it was found via Classic scan, we probably stored extra props? 
      // Or we can just try one then the other? Not ideal.
      // Let's rely on how we stored it. 

      if (device.address && !device.advertising) {
        // Likely a classic device from RNBluetoothClassic (which returns address, name, deviceClass)
        await BluetoothService.connectToClassicDevice(device.id); // device.id is address in our map
      } else {
        // Default to BLE
        await BluetoothService.connectToDevice(device.id);
        // Subscribe to notifications for known service/characteristic
        try {
          await BleManager.startNotification(device.id, SERVICE_UUID, CHAR_UUID);
          console.log('🔔 [BLE] Notification started for', SERVICE_UUID, CHAR_UUID);
          // Optionally read once immediately
          try {
            const data = await BleManager.read(device.id, SERVICE_UUID, CHAR_UUID);
            const hex = data ? data.map(b => ('0' + b.toString(16)).slice(-2)).join('') : '';
            console.log('📖 [BLE] Initial read:', hex);
            setLastHex(hex);
          } catch (readErr) {
            console.warn('⚠️ [BLE] Initial read failed', readErr);
          }
        } catch (notifyErr) {
          console.warn('⚠️ [BLE] Failed to start notification', notifyErr);
        }
      }

      alert(`Connected to ${device.name || device.id}`);
      setIsModalVisible(false);
    } catch (error) {
      console.log('Connection failed, trying alternative...', error);
      // Fallback: If one failed, maybe try the other? 
      // For now just alert error
      alert(`Connection failed: ${error.message || error}`);
    }
  };

  const handleReconnect = async () => {
    console.log('🟢 [BLE] Reconnect/Scan pressed: resetting state and restarting scan');
    try {
      await BleManager.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setPeripherals(new Map());
    setEventCount(0);
    setLastEvent(null);
    setIsScanning(false);
    startScan();
  };

  const handleCloseModal = async () => {
    console.log('🟢 [BLE] Close modal pressed: stopping scan and resetting state');
    try {
      await BleManager.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
    setPeripherals(new Map());
    setEventCount(0);
    setLastEvent(null);
    setIsModalVisible(false);
  };

  const openScanModal = async () => {
    // Do not start scanning here—just open the modal and reset state
    try {
      await BleManager.stopScan();
    } catch (e) {
      // ignore
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setPeripherals(new Map());
    setEventCount(0);
    setLastEvent(null);
    setIsScanning(false);
    setIsModalVisible(true);
  };

  const renderDeviceItem = ({ item }) => {
    const isClassic = item?.type === 'classic';
    const isBonded = item?.isBonded;
    return (
      <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
          <View style={styles.tagRow}>
            {isClassic && <Text style={[styles.tag, styles.classicTag]}>Classic</Text>}
            {isBonded && <Text style={[styles.tag, styles.bondedTag]}>Paired</Text>}
            {!isClassic && !isBonded && <Text style={[styles.tag, styles.bleTag]}>BLE</Text>}
          </View>
        </View>
        <Text style={styles.deviceId}>{item.id}</Text>
      </TouchableOpacity>
    );
  };

  const handleSOS = async () => {
    try {
      console.log('Triggering SOS...');

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

        console.log('Dispatching SOS incident:', incidentData);
        dispatch(addIncident(incidentData));

        // Send to API
        try {
          const locationData = {
            latitude: lat || 0,
            longitude: lng || 0,
            deviceId: DeviceInfo ? await DeviceInfo.getUniqueId() : 'unknown',
            deviceInfo: DeviceInfo ? await DeviceInfo.getDeviceName() : 'unknown',
          };
          const response = await ApiService.triggerEmergency(locationData);
          const message = response?.message || 'Emergency Alert Sent! Help is on the way.';
          Alert.alert('SOS Sent', message);
        } catch (err) {
          console.error('API Error:', err);
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
          // Fallback to 0,0
          dispatchIncident(0, 0);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    } catch (error) {
      Alert.alert('Error', `Failed to initiate SOS: ${error.message || error}`);
    }
  };

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
          <Image source={require('../assets/images/kavach-shield.png')} style={styles.logo} />
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
              <Text style={styles.statValue}>{contactCount > 0 ? contactCount : '-'}</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Incidents</Text>
              <Text style={styles.statValue}>{incidents.length > 0 ? incidents.length : '-'}</Text>
            </View>
          </View>

          {/* Scan Bluetooth Devices Card */}
          <TouchableOpacity style={styles.scanCard} onPress={openScanModal}>
            <View>
              <Text style={styles.scanTitle}>Scan Bluetooth Devices</Text>
              <Text style={styles.scanSubtitle}>Connect to safety wearables</Text>
            </View>
            <View style={styles.scanIconBox}>
              {/* Using text emoji for now, can be replaced with Icon if available */}
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
                  </LinearGradient>Ï
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Last Incident */}
          <View style={styles.lastIncidentCard}>
            <View>
              <Text style={styles.lastIncidentLabel}>Last Incident</Text>
              {lastLoggedIncident ? (
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
              <Text style={styles.modalTitle}>Available Devices</Text>
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

            {/* Debug Info */}
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>
                Scanning: {isScanning ? 'Yes' : 'No'} |
                Devices: {peripherals instanceof Map ? peripherals.size : 0} |
                Events: {eventCount}
              </Text>
              {lastEvent && (
                <Text style={styles.debugText} numberOfLines={2}>
                  Last: {lastEvent.name || lastEvent.id || 'Unknown'}
                </Text>
              )}
            </View>

            <FlatList
              data={
                peripherals instanceof Map
                  ? Array.from(peripherals.values()).sort((a, b) => {
                    const aBonded = !!a?.isBonded;
                    const bBonded = !!b?.isBonded;
                    if (aBonded === bBonded) return 0;
                    return aBonded ? 1 : -1; // bonded go to bottom
                  })
                  : []
              }
              renderItem={renderDeviceItem}
              keyExtractor={(item, index) => item?.id || `device-${index}`}
              contentContainerStyle={styles.listContent}
              extraData={peripherals instanceof Map ? peripherals.size : 0}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {isScanning
                      ? 'Scanning for BLE devices...'
                      : `No BLE devices found. (Found: ${peripherals instanceof Map ? peripherals.size : 0})`}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Note: Scanning for ALL nearby Bluetooth devices.{'\n'}
                    If your device is not showing up, ensure it is in pairing mode.
                  </Text>
                  {eventCount === 0 && isScanning && (
                    <Text style={styles.emptySubtext}>
                      ⚠️ No discovery events received yet. Check console logs.
                    </Text>
                  )}
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
              <Text style={styles.modalTitle}>Recent Incident</Text>
              <TouchableOpacity onPress={() => setIsLogModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={incidents.slice(0, 1)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyIncidents}>
                  No incidents recorded properly.
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.deviceItem}>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceName}>{item.time}</Text>
                    <Text style={[styles.tag, styles.bondedTag]}>{item.mode}</Text>
                  </View>
                  <Text style={styles.deviceId}>Lat: {item.lat}, Lng: {item.lng}</Text>
                  <Text style={styles.deviceId}>IP: {item.ip}</Text>
                </View>
              )}
            />
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
    // Removed row/alignItems/gap to stack vertically
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
    // height: AppFonts.nH(80),
    paddingHorizontal: AppFonts.nW(14),
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Stack label and value
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

  // Scan Card
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

  // Hero Card
  heroCard: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(24),
    padding: AppFonts.n(18),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2', // Subtle border
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
    borderRadius: 100, // Circle
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

  viewLogBtn: {
    backgroundColor: '#68778f',
    borderRadius: AppFonts.n(12),
    paddingVertical: AppFonts.nH(8),
    paddingHorizontal: AppFonts.nW(16),
    borderWidth: AppFonts.n(1),
    borderColor: '#94a0b2',
  },

  viewLogText: { color: '#ffffff', fontSize: AppFonts.n(11), fontWeight: '500' },

  // Modal Styles
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
  listContent: {
    paddingBottom: 20,
  },
  emptyIncidents: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
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
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  classicTag: {
    backgroundColor: '#312e81',
    color: '#e0e7ff',
  },
  bondedTag: {
    backgroundColor: '#064e3b',
    color: '#d1fae5',
  },
  bleTag: {
    backgroundColor: '#1f2937',
    color: '#e5e7eb',
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
  debugContainer: {
    backgroundColor: '#68778f',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#94a0b2',
  },
  debugText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  logoContainer: {
    marginBottom: 16,
    backgroundColor: '#68778f',
    borderRadius: 12,
    width: normalize(48),
    height: normalize(48),
    marginEnd: normalize(10),
    borderWidth: 1,
    borderColor: '#2C2F35',
  },
  logoIcon: {
    width: normalize(48),
    height: normalize(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;

