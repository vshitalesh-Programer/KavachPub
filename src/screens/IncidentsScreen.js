import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import ApiService from '../services/ApiService';

const IncidentsScreen = () => {
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef(null);

  const formatIncident = useCallback((item) => {
    // Handle latitude/longitude - API returns as strings
    const lat = parseFloat(item.latitude || item.lat || item.location?.lat || 0);
    const lng = parseFloat(item.longitude || item.lng || item.location?.lng || 0);
    
    // Use triggeredAt as primary timestamp, fallback to createdAt
    const timestamp = item.triggeredAt || item.createdAt || item.timestamp || item.date || item.time;
    
    // Derive mode from status or use default
    const mode = item.status === 'completed' ? 'SOS' : (item.mode || item.status || 'SOS');
    
    // Get device info
    const deviceInfo = item.deviceInfo || item.deviceId || 'Unknown Device';

    return {
      id: item.id || `${lat}-${lng}-${timestamp}`,
      time: timestamp ? new Date(timestamp).toLocaleString() : 'Unknown time',
      lat,
      lng,
      mode,
      deviceId: item.deviceId,
      deviceInfo,
      status: item.status,
      callsMade: item.callsMade,
      textsSent: item.textsSent,
      notes: item.notes,
      notificationLogs: item.notificationLogs || [],
      raw: item,
    };
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      const history = await ApiService.getTriggerHistory();

      // Handle API response structure: { triggers: [], pagination: {} }
      const historyList = Array.isArray(history)
        ? history
        : history?.triggers || history?.data || history?.history || [];

      // Sort by triggeredAt (most recent first)
      const sorted = Array.isArray(historyList)
        ? [...historyList].sort((a, b) => {
            const dateA = new Date(a.triggeredAt || a.createdAt || a.timestamp || a.date || 0);
            const dateB = new Date(b.triggeredAt || b.createdAt || b.timestamp || b.date || 0);
            return dateB - dateA;
          })
        : [];

      // Format and filter incidents with valid coordinates
      const formatted = sorted
        .map(formatIncident)
        .filter((item) => item.lat && item.lng && !isNaN(item.lat) && !isNaN(item.lng));
      
      setIncidents(formatted);
      console.log('[IncidentsScreen] Loaded', formatted.length, 'incidents');
    } catch (error) {
      console.error('[IncidentsScreen] Error fetching incidents:', error);
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  }, [formatIncident]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Focus map on latest incident when data changes
  useEffect(() => {
    if (incidents.length > 0 && incidents[0].lat && incidents[0].lng) {
      mapRef.current?.animateToRegion(
        {
          latitude: incidents[0].lat,
          longitude: incidents[0].lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
    }
  }, [incidents]);

  const handleIncidentPress = (incident) => {
    if (incident.lat && incident.lng) {
      mapRef.current?.animateToRegion(
        {
          latitude: incident.lat,
          longitude: incident.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  };

  const handleShare = async (incident) => {
    if (!incident.lat || !incident.lng) {
      return;
    }
    const mapsLink = `https://www.google.com/maps?q=${incident.lat},${incident.lng}`;
    const message = `Emergency location:\n${mapsLink}\n\nTime: ${incident.time}\nMode: ${incident.mode}`;
    try {
      await Share.share({
        message,
        url: mapsLink,
        title: 'Share Incident Location',
      });
    } catch (error) {
      console.error('[IncidentsScreen] Share error:', error);
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
          {item.deviceInfo && (
            <Text style={[styles.locationValue, styles.ipText]}>
              Device: {item.deviceInfo}
            </Text>
          )}
          {item.status && (
            <Text style={[styles.locationValue, styles.ipText]}>
              Status: {item.status}
            </Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const hasMapData = incidents.length > 0 && incidents[0].lat && incidents[0].lng;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incidents</Text>
        <Text style={styles.subtitle}>History & Reports</Text>
      </View>

      {/* Map View */}
      {hasMapData ? (
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
                incident.lat && incident.lng ? (
                    <Marker
                        key={incident.id}
                        coordinate={{ latitude: incident.lat, longitude: incident.lng }}
                        title={`SOS ${incident.time}`}
                        description={incident.deviceInfo ? `Device: ${incident.deviceInfo}` : `Status: ${incident.status || 'N/A'}`}
                    />
                ) : null
            ))}
          </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>
                {isLoading ? 'Loading incidents...' : 'No incidents to map'}
            </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
               <Text style={styles.emptyListText}>No incidents yet.</Text>
          }
        />
      )}
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
  ipText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ffffff',
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
  loadingState: {
    paddingVertical: 20,
  },
  emptyListText: {
    color: '#777',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default IncidentsScreen;

