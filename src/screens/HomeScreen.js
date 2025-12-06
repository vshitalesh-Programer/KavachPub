import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, NativeEventEmitter, NativeModules, Alert } from 'react-native';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const HomeScreen = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [eventCount, setEventCount] = useState(0); // Track if events are received
  const [lastEvent, setLastEvent] = useState(null); // Store last event for debugging

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
        newMap.set(peripheral.id, peripheral);
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
        setPeripherals(new Map());
        setEventCount(0); // Reset event counter
        setLastEvent(null); // Reset last event
        setIsScanning(true);
        setIsModalVisible(true);

        // Fetch bonded (paired) devices first (includes Classic devices)
        BluetoothService.getBondedDevices().then(bondedDevices => {
          console.log('🔵 [BLE] Found bonded devices:', bondedDevices.length);
          setPeripherals((prevMap) => {
            const newMap = new Map(prevMap);
            bondedDevices.forEach(device => {
               newMap.set(device.id, device);
            });
            return newMap;
          });
        });
        
        // Start the scan
        console.log('🟢 [BLE] Calling scanForDevices...');
        await BluetoothService.scanForDevices(10); // 10 seconds
        console.log('🟢 [BLE] Scan initiated, waiting for devices...');
        console.log('🟢 [BLE] Event listeners should be active. Waiting for BleManagerDiscoverPeripheral events...');
        
        // Auto-stop scanning after duration
        setTimeout(async () => {
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
        }, 10000);
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
      await BluetoothService.connectToDevice(device.id);
      alert(`Connected to ${device.name || device.id}`);
      setIsModalVisible(false);
    } catch (error) {
      alert(`Connection failed: ${error.message || error}`);
    }
  };

  const renderDeviceItem = ({ item }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </TouchableOpacity>
  );

  const handleSOS = async () => {
    try {
        console.log('Triggering SOS...');
        // In a real app, get GPS location here
        const locationData = {
            latitude: 0, 
            longitude: 0,
            deviceId: 'test-device-id', // Use proper device ID lib
            deviceInfo: 'Android Emulator'
        };
        const response = await ApiService.triggerEmergency(locationData);
        const message = response?.message || 'Emergency Alert Sent! Help is on the way.';
        alert(message);
    } catch (error) {
        alert(`Failed to send alert: ${error.message || error}`);
    }
  };

  return (
    <View style={styles.container}>

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
      <TouchableOpacity style={styles.scanCard} onPress={startScan}>
        <View style={styles.scanContent}>
          <Text style={styles.scanTitle}>Scan Bluetooth Devices</Text>
          <Text style={styles.scanSubtitle}>Connect to safety wearables</Text>
        </View>
        <View style={styles.scanIconBox}>
          <Text style={styles.scanIcon}>📡</Text>
        </View>
      </TouchableOpacity>

      {/* Ready to Protect */}
      <View style={styles.card}>
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
      <View style={styles.lastIncidentCard}>
        <Text style={styles.lastIncidentLabel}>Last Incident</Text>
        <Text style={styles.lastIncidentValue}>05/08/2025, 02:44:00 • Loud</Text>

        <TouchableOpacity style={styles.viewLogBtn}>
          <Text style={styles.viewLogText}>View Log</Text>
        </TouchableOpacity>
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
              {isScanning && <ActivityIndicator color="#007AFF" />}
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
              data={peripherals instanceof Map ? Array.from(peripherals.values()) : []}
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
              onPress={() => {
                console.log('Closing modal');
                setIsModalVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0F14',
    paddingHorizontal: 20,
    paddingTop: 60,
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
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
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
