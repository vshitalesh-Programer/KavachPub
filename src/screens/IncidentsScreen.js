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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalIncidents, setTotalIncidents] = useState(0);
  const mapRef = useRef(null);
  const PAGE_SIZE = 5; // Use uppercase to indicate it's a constant

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

  // Fetch total incidents from stats API
  const fetchTotalIncidents = useCallback(async () => {
    try {
      const stats = await ApiService.getStats();
      if (stats && stats.totalIncidents !== undefined) {
        setTotalIncidents(stats.totalIncidents);
      }
    } catch (error) {
      console.error('[IncidentsScreen] Error fetching stats:', error);
    }
  }, []);

  const fetchIncidents = useCallback(async (cursor = null, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const history = await ApiService.getTriggerHistory(cursor, PAGE_SIZE);

      // Handle API response structure: { triggers: [], pagination: {} }
      const historyList = Array.isArray(history)
        ? history
        : history?.triggers || history?.data || history?.history || [];

      // Extract pagination info
      const pagination = history?.pagination || {};
      const hasMoreData = pagination.hasMore || false;
      const nextCursorValue = pagination.nextCursor || null;

      // Format and filter incidents with valid coordinates
      const formatted = Array.isArray(historyList)
        ? historyList
            .map(formatIncident)
            .filter((item) => item.lat && item.lng && !isNaN(item.lat) && !isNaN(item.lng))
        : [];

      if (append) {
        // Append to existing incidents
        setIncidents((prev) => [...prev, ...formatted]);
      } else {
        // Replace incidents
        setIncidents(formatted);
      }

      // Update pagination state
      setNextCursor(nextCursorValue);
      setHasMore(hasMoreData);

      console.log('[IncidentsScreen] Loaded', formatted.length, 'incidents', append ? '(appended)' : '(initial)');
      console.log('[IncidentsScreen] Pagination:', { hasMore: hasMoreData, nextCursor: nextCursorValue });
    } catch (error) {
      console.error('[IncidentsScreen] Error fetching incidents:', error);
      if (!append) {
        setIncidents([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [formatIncident]);

  // Load more incidents (pagination)
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      console.log('[IncidentsScreen] Loading more incidents with cursor:', nextCursor);
      fetchIncidents(nextCursor, true);
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchIncidents]);

  useEffect(() => {
    fetchTotalIncidents();
    fetchIncidents();
  }, [fetchTotalIncidents, fetchIncidents]);

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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Incidents</Text>
            <Text style={styles.subtitle}>History & Reports</Text>
          </View>
          {totalIncidents > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalText}>{totalIncidents} total</Text>
            </View>
          )}
        </View>
        {incidents.length > 0 && (
          <Text style={styles.countText}>
            Showing {incidents.length} of {totalIncidents || incidents.length} incidents
          </Text>
        )}
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>No incidents yet.</Text>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.loadingMoreText}>Loading more incidents...</Text>
              </View>
            ) : hasMore ? (
              <View style={styles.loadMoreHint}>
                <Text style={styles.loadMoreText}>Scroll down to load more</Text>
              </View>
            ) : incidents.length > 0 ? (
              <View style={styles.endOfList}>
                <Text style={styles.endOfListText}>No more incidents to load</Text>
              </View>
            ) : null
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  totalBadge: {
    backgroundColor: '#0f172a2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94a0b2',
  },
  totalText: {
    color: '#B0B5BA',
    fontSize: 12,
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
    color: '#B0B5BA',
    marginTop: 4,
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
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    color: '#B0B5BA',
    fontSize: 14,
  },
  loadMoreHint: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#94a0b2',
    fontSize: 12,
    fontStyle: 'italic',
  },
  endOfList: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  endOfListText: {
    color: '#94a0b2',
    fontSize: 12,
  },
});

export default IncidentsScreen;

