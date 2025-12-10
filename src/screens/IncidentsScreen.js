import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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

import { useSelector } from 'react-redux';

const IncidentsScreen = () => {
  const incidents = useSelector(state => state.incidents.incidents);
  const mapRef = React.useRef(null);

  // Automatically focus on the new incident when it arrives
  React.useEffect(() => {
    if (incidents.length > 0 && incidents[0].lat !== 0) {
      mapRef.current?.animateToRegion({
        latitude: incidents[0].lat,
        longitude: incidents[0].lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [incidents]);

  const handleIncidentPress = (incident) => {
    if (incident.lat !== 0) {
      mapRef.current?.animateToRegion({
        latitude: incident.lat,
        longitude: incident.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => handleIncidentPress(item)}>
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
          {item.ip && (
            <Text style={[styles.locationValue, { marginTop: 4, fontSize: 12, color: '#ffffff' }]}>
              IP: {item.ip}
            </Text>
          )}
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incidents</Text>
        <Text style={styles.subtitle}>History & Reports</Text>
      </View>

      {/* Map View */}
      {incidents.length > 0 && incidents[0].lat !== 0 ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
                latitude: incidents[0].lat,
                longitude: incidents[0].lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }}
          >
            {incidents.map((incident) => (
                incident.lat !== 0 && (
                    <Marker
                        key={incident.id}
                        coordinate={{ latitude: incident.lat, longitude: incident.lng }}
                        title={`SOS ${incident.time}`}
                        description={`IP: ${incident.ip || 'N/A'}`}
                    />
                )
            ))}
          </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>
                {incidents.length === 0 ? 'No incidents to map' : 'Location not available'}
            </Text>
        </View>
      )}

      <FlatList
        data={incidents}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
             <Text style={{color: '#777', textAlign: 'center', marginTop: 20}}>No incidents yet.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#68778f', // Matches HomeScreen
    paddingTop: 60,
  },
  header: {
    marginHorizontal: 20,
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
    color: '#ffffff',
  },
  map: {
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#68778f',
    borderRadius: 16,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#94a0b2',
    marginHorizontal: 20,
  },
  mapPlaceholderText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 100, // Space for tab bar
  },
  card: {
    backgroundColor: '#68778f',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    marginHorizontal: 20,
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
    backgroundColor: '#0f172a2e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94a0b2',
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
    color: '#ffffff',
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
    borderTopColor: '#94a0b2',
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

