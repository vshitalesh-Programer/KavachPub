import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const HomeScreen = () => {
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
          <Text style={styles.statValue}>4</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Incidents</Text>
          <Text style={styles.statValue}>2</Text>
        </View>
      </View>

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
          <TouchableOpacity style={styles.sosButton}>
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

  bottomTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#121318',
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 20,
  },

  tabItem: { alignItems: 'center' },

  tabLabel: { color: '#7C8087', fontSize: 13 },
});

export default HomeScreen;
