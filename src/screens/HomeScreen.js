import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, NativeEventEmitter, NativeModules } from 'react-native';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const HomeScreen = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    BluetoothService.initialize();

    const handleDiscoverPeripheral = (peripheral) => {
      setPeripherals((map) => {
        return new Map(map.set(peripheral.id, peripheral));
      });
    };

    const handleStopScan = () => {
      setIsScanning(false);
      console.log('Scan stopped');
    };

    const listeners = [
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
    ];

    return () => {
      listeners.forEach(l => l.remove());
    };
  }, []);

  const startScan = async () => {
    const hasPermissions = await BluetoothService.requestPermissions();
    if (hasPermissions) {
      setPeripherals(new Map());
      setIsScanning(true);
      setIsModalVisible(true);
      BluetoothService.scanForDevices(5);
    } else {
      console.warn('Bluetooth permissions denied');
      alert('Bluetooth permissions are required to scan for devices.');
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
            
            <FlatList
              data={Array.from(peripherals.values())}
              renderItem={renderDeviceItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No devices found yet...</Text>
              }
            />

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setIsModalVisible(false)}
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
  emptyText: {
    color: '#7C8087',
    textAlign: 'center',
    marginTop: 30,
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
