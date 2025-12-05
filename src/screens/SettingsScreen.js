import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';

const SettingsScreen = () => {
  const [alarmMode, setAlarmMode] = useState('Loud');
  const [holdTime, setHoldTime] = useState(5);
  const [autoText, setAutoText] = useState(false);

  return (
    <View style={styles.container}>

      {/* Header Icon */}
      <View style={styles.headerIcon} />

      {/* Main Settings Box */}
      <View style={styles.settingsBox}>
        <Text style={styles.title}>⚙️ Device Settings</Text>

        {/* Alarm Mode */}
        <Text style={styles.sectionLabel}>Alarm Mode</Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              alarmMode === 'Loud' && styles.modeActive,
            ]}
            onPress={() => setAlarmMode('Loud')}
          >
            <Text
              style={[
                styles.modeText,
                alarmMode === 'Loud' && styles.modeTextActive,
              ]}
            >
              Loud
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              alarmMode === 'Silent' && styles.modeActive,
            ]}
            onPress={() => setAlarmMode('Silent')}
          >
            <Text
              style={[
                styles.modeText,
                alarmMode === 'Silent' && styles.modeTextActive,
              ]}
            >
              Silent
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.helperText}>
          Loud: audible siren • Silent: background alert to contacts.
        </Text>

        {/* Hold Duration */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
          Hold Duration (seconds)
        </Text>

        <View style={styles.row}>
          {renderHoldButton(1, holdTime, setHoldTime)}
          {renderHoldButton(3, holdTime, setHoldTime)}
          {renderHoldButton(5, holdTime, setHoldTime, 'Default')}
          {renderHoldButton(10, holdTime, setHoldTime)}
        </View>

        <Text style={styles.helperText}>Required hold time for SOS.</Text>

        {/* Auto-text */}
        <View style={styles.autoTextBox}>
          <Text style={styles.autoTitle}>Auto-text all contacts</Text>
          <Text style={styles.autoDesc}>
            When enabled, every contact’s Auto-text is set to Yes and per-contact
            toggles are disabled. Turning this off sets all to No and re-enables
            individual control.
          </Text>

          <View style={styles.toggleWrapper}>
            <Text style={styles.toggleLabel}>{autoText ? 'On' : 'Off'}</Text>
            <Switch
              value={autoText}
              onValueChange={setAutoText}
              thumbColor={autoText ? '#ff4a4a' : '#444'}
              trackColor={{ false: '#2f2f34', true: '#662222' }}
            />
          </View>
        </View>
      </View>

    </View>
  );
};

/* ---------- Hold Duration Button Renderer ---------- */
const renderHoldButton = (value, selected, setSelected, note) => (
  <TouchableOpacity
    key={value}
    style={[
      styles.holdBtn,
      selected === value && styles.holdActive,
    ]}
    onPress={() => setSelected(value)}
  >
    <Text
      style={[
        styles.holdText,
        selected === value && styles.holdTextActive,
      ]}
    >
      {value}s {note ? `• ${note}` : ''}
    </Text>
  </TouchableOpacity>
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0F14',
    padding: 20,
    paddingTop: 60,
  },

  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A1F2D',
    marginBottom: 20,
  },

  settingsBox: {
    backgroundColor: '#11141C',
    borderRadius: 20,
    padding: 20,
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
    backgroundColor: '#101218',
    padding: 16,
    borderRadius: 14,
    marginTop: 14,
  },

  autoTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  autoDesc: {
    color: '#8C8F94',
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

  /* Bottom Tabs */
  bottomTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 25,
    backgroundColor: '#121318',
    borderRadius: 20,
    marginTop: 25,
  },

  tabItem: { alignItems: 'center' },

  tabLabel: {
    color: '#7C8087',
    fontSize: 13,
  },
});

export default SettingsScreen;
