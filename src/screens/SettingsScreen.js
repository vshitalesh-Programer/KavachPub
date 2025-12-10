import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/slices/authSlice';
import AppFonts from '../utils/AppFonts';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
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
        <View style={styles.header}>
          <Image source={require('../assets/images/kavach-shield.png')} style={styles.logo} />
        </View>

        {/* Main Settings Box */}
        <View style={styles.settingsBox}>
          <Text style={styles.title}>⚙️ Account details</Text>

          <View style={styles.autoTextBox}>
            <Text style={styles.autoTitle}>Email Profile</Text>
            <Text style={styles.autoDesc}>{user?.email || 'No email found'}</Text>
          </View>

          <View style={[styles.autoTextBox, { marginTop: 10 }]}>
            <Text style={styles.autoTitle}>User Name</Text>
            <Text style={styles.autoDesc}>{user?.name || 'Kavach User'}</Text>
          </View>
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
    backgroundColor: '#68778f',
    paddingTop: 60,
  },

  header: {
    marginBottom: AppFonts.nH(20),
    marginTop: AppFonts.nH(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: AppFonts.nW(20),
    // Removed row/alignItems/gap to stack vertically
  },

  logo: {
    width: AppFonts.n(30),
    height: AppFonts.n(30),
    borderRadius: 12,
    backgroundColor: '#68778f',
    padding: AppFonts.n(20),
    marginRight: AppFonts.nW(10),
    borderWidth: 1,
    borderColor: '#94a0b2',
  },

  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A1F2D',
    marginBottom: 20,
  },

  settingsBox: {
    backgroundColor: '#68778f',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#94a0b2',
    marginHorizontal: 20,
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
    backgroundColor: '#68778f',
    padding: 16,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#94a0b2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },

  autoTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  autoDesc: {
    color: '#ffffff',
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
