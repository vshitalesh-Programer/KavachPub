import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, NativeEventEmitter, NativeModules, Alert, ScrollView, PermissionsAndroid,Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
// import Svg, {Defs, LinearGradient as SvgLinearGradient, Stop, Path} from 'react-native-svg';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import BleManager from 'react-native-ble-manager';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import { addIncident } from '../redux/slices/incidentSlice';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const HomeScreen = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [eventCount, setEventCount] = useState(0); // Track if events are received
  const [lastEvent, setLastEvent] = useState(null); // Store last event for debugging
  const scanTimeoutRef = useRef(null);
  const dispatch = useDispatch();
  const incidents = useSelector(state => state.incidents.incidents);
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
      console.log('Total devices found:', peripherals.size);
    };

    console.log('🔵 [BLE] Setting up BLE event listeners...');
    console.log('🔵 [BLE] BleManagerModule:', BleManagerModule ? 'Found' : 'NOT FOUND');
    console.log('🔵 [BLE] bleManagerEmitter:', bleManagerEmitter ? 'Created' : 'NOT CREATED');
    
    const discoverListener = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', (data) => {
      console.log('🔵 [BLE] ===== BleManagerDiscoverPeripheral EVENT RECEIVED =====');
      console.log('🔵 [BLE] Event data:', JSON.stringify(data, null, 2));
      console.log('🔵 [BLE] Event data type:', typeof data);
      console.log('🔵 [BLE] Event data keys:', data ? Object.keys(data) : 'null');
      
      // Track events
      setEventCount(prev => prev + 1);
      setLastEvent(data);
      
      handleDiscoverPeripheral(data);
    });
    
    const stopScanListener = bleManagerEmitter.addListener('BleManagerStopScan', () => {
      console.log('🟡 [BLE] ===== BleManagerStopScan EVENT RECEIVED =====');
      handleStopScan();
    });

    const listeners = [discoverListener, stopScanListener];
    console.log('✅ [BLE] Event listeners registered:', listeners.length);
    console.log('✅ [BLE] Listening for: BleManagerDiscoverPeripheral, BleManagerStopScan');

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
        } catch(e) { console.warn('Failed to get IP', e); }

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
                    deviceId: await DeviceInfo.getUniqueId(),
                    deviceInfo: await DeviceInfo.getDeviceName(),
                    ip: ipAddress
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
      colors={['#2b1216', '#0c0b11']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      angle={190}
      useAngle={true}
      style={styles.gradient}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>Kavach</Text>
          <Text style={styles.subtitle}>Safety Console</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Contacts</Text>
            <Text style={styles.statValue}>-</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Incidents</Text>
            <Text style={styles.statValue}>-</Text>
          </View>
        </View>

        {/* New Bluetooth Scan Section */}
        <TouchableOpacity style={styles.scanCard} onPress={openScanModal}>
          <View style={styles.scanContent}>
            <Text style={styles.scanTitle}>Scan Bluetooth Devices</Text>
            <Text style={styles.scanSubtitle}>Connect to safety wearables</Text>
          </View>
          <View style={styles.scanIconBox}>
            <Text style={styles.scanIcon}>📡</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.cardSubText}>
          Hold <Text style={styles.bold}>5s</Text> • Mode Loud
        </Text>

        {/* SOS Button */}
        <View style={styles.sosContainer}>
          <TouchableOpacity style={styles.sosButton} onLongPress={handleSOS} delayLongPress={1000}>
            <Text style={styles.sosIcon}>🚨</Text>
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosSubText}>Press & hold</Text>
          </TouchableOpacity>
        </View>
      {/* </View> */}

      <View style={styles.lastIncidentCard}>
        <Text style={styles.lastIncidentLabel}>Last Incident</Text>
        {lastLoggedIncident ? (
             <Text style={styles.lastIncidentValue}>{lastLoggedIncident.time} • {lastLoggedIncident.mode}</Text>
        ) : (
             <Text style={styles.lastIncidentValue}>No incidents recorded.</Text>
        )}

        <TouchableOpacity style={styles.viewLogBtn}>
          <Text style={styles.viewLogText}>View Log</Text>
        </TouchableOpacity>

        {/* Ready to Protect */}
        {/* <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Ready to Protect</Text>

            <TouchableOpacity style={styles.adjustBtn}>
              <Text style={styles.adjustText}>Adjust</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardSubText}>
            Hold <Text style={styles.bold}>5s</Text> • Mode Loud
          </Text>

          {/* SOS Button */}
          <View style={styles.sosContainer}>
            <TouchableOpacity style={styles.sosButton} onLongPress={handleSOS} delayLongPress={1000}>
              <Text style={styles.sosIcon}>🚨</Text>
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubText}>Press & hold</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Incident */}
        {/* <View style={styles.lastIncidentCard}>
          <Text style={styles.lastIncidentLabel}>Last Incident</Text>
          <Text style={styles.lastIncidentValue}>05/08/2025, 02:44:00 • Loud</Text>

          <TouchableOpacity style={styles.viewLogBtn}>
            <Text style={styles.viewLogText}>View Log</Text>
          </TouchableOpacity>
        </View> */}
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
            {isScanning && <ActivityIndicator color="#DC2626" style={styles.scanIndicator} />}
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

    </LinearGradient>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  header: {
    marginBottom: 20,
  },

  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },

  subtitle: {
    color: '#9A9FA5',
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  statBox: {
    width: '47%',
    backgroundColor: '#16171D',
    padding: 18,
    borderRadius: 14,
  },

  statLabel: { color: '#B0B5BA', fontSize: 14 },
  statValue: { color: 'white', fontSize: 26, fontWeight: '700', marginTop: 8 },

  // Scan Card Styles
  scanCard: {
    backgroundColor: '#25262C',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3A3B40',
  },
  scanContent: {
    flex: 1,
  },
  scanTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  scanSubtitle: {
    color: '#9A9FA5',
    fontSize: 12,
    marginTop: 4,
  },
  scanIconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#3A3B40',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    fontSize: 20,
  },

  card: {
    backgroundColor: '#16171D',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardTitle: { fontSize: 18, fontWeight: '700', color: 'white' },

  adjustBtn: {
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },

  adjustText: { color: '#B0B5BA', fontSize: 14 },

  cardSubText: { color: '#9A9FA5', marginTop: 8 },

  bold: { color: '#FFFFFF', fontWeight: '700' },

  sosContainer: {
    alignItems: 'center',
    marginTop: 20,
  },

  sosButton: {
    width: 170,
    height: 170,
    borderRadius: 170,
    backgroundColor: '#25262C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: '#53363D',
  },

  sosIcon: { fontSize: 32, color: 'white' },

  sosText: {
    fontSize: 26,
    fontWeight: '700',
    color: 'white',
    marginTop: 6,
  },

  sosSubText: { color: '#9A9FA5', marginTop: 4 },

  lastIncidentCard: {
    backgroundColor: '#16171D',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
  },

  lastIncidentLabel: { color: 'white', fontSize: 16, fontWeight: '600' },

  lastIncidentValue: { color: '#9A9FA5', marginTop: 6 },

  viewLogBtn: {
    alignSelf: 'flex-end',
    borderColor: '#3A3B40',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 12,
  },

  viewLogText: { color: '#B0B5BA', fontSize: 14 },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16171D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  scanIndicator: {
    marginRight: 0,
  },
  reconnectButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  deviceItem: {
    backgroundColor: '#25262C',
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
    color: '#9A9FA5',
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
    color: '#7C8087',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
  },
  emptySubtext: {
    color: '#5A5D63',
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
    backgroundColor: '#25262C',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  debugText: {
    color: '#9A9FA5',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default HomeScreen;
