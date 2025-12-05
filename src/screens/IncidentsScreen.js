import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const MOCK_INCIDENTS = [
  {
    id: '1',
    time: '05/08/2025, 02:44:00',
    lat: 37.7749,
    lng: -122.4194,
    mode: 'Loud',
  },
  {
    id: '2',
    time: '12/10/2025, 11:18:00',
    lat: 37.3382,
    lng: -121.8863,
    mode: 'Silent',
  },
];

const IncidentsScreen = () => {
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.timeText}>{item.time}</Text>
        <View style={styles.modeBadge}>
          <Text style={styles.modeText}>{item.mode}</Text>
        </View>
      </View>
      
      <View style={styles.locationContainer}>
        <Text style={styles.locationLabel}>Location</Text>
        <Text style={styles.locationValue}>
          {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]}>
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incidents</Text>
        <Text style={styles.subtitle}>History & Reports</Text>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>Map View Placeholder</Text>
      </View>

      <FlatList
        data={MOCK_INCIDENTS}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0F14', // Matches HomeScreen
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9A9FA5',
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: '#16171D',
    borderRadius: 16,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#25262C',
  },
  mapPlaceholderText: {
    color: '#585C63',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 100, // Space for tab bar
  },
  card: {
    backgroundColor: '#16171D',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modeBadge: {
    backgroundColor: '#25262C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3B40',
  },
  modeText: {
    color: '#B0B5BA',
    fontSize: 12,
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationLabel: {
    color: '#7C8087',
    fontSize: 12,
    marginBottom: 2,
  },
  locationValue: {
    color: '#D1D5DB',
    fontSize: 14,
    fontFamily: 'monospace', // To align coordinates nicely if supported
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12, // React Native 0.71+
    borderTopWidth: 1,
    borderTopColor: '#25262C',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25262C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#240E11', // Slight red tint for delete
  },
  actionIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default IncidentsScreen;

