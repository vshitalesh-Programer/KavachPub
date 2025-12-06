import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { logout } from '../redux/slices/authSlice';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const [alarmMode, setAlarmMode] = useState('Loud');
  const [holdTime, setHoldTime] = useState(5);
  const [autoText, setAutoText] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header Icon */}
        <View style={styles.headerIcon} />

        {/* Main Settings Box */}
        <View style={styles.settingsBox}>
          <Text style={styles.title}>⚙️ Account details</Text>

          {/* Alarm Mode */}
        
        </View>
      </ScrollView>
      
      {/* Logout Button - Fixed at bottom */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => dispatch(logout())}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 100, // Extra padding to account for fixed logout button
  },

  logoutBtn: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1C1E25',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2D35',
  },

  logoutText: {
    color: '#FF4A4A',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
