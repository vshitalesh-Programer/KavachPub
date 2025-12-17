/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Contacts from 'react-native-contacts';
import Icon from 'react-native-vector-icons/Feather';
import ApiService from '../services/ApiService';
import { setContacts as setContactsAction } from '../redux/slices/contactSlice';
import Fonts from '../utils/AppFonts';

const { n, nH, nW } = Fonts;

function deviceContactsToOptions(deviceContacts) {
  return (deviceContacts || [])
    .map(c => {
      const name = c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' ').trim() || 'Unknown';
      const phone = Array.isArray(c.phoneNumbers) && c.phoneNumbers.length > 0
        ? c.phoneNumbers[0].number
        : '';
      if (!phone) return null;
      return {
        id: c.recordID || `${name}-${phone}`,
        name,
        phone,
      };
    })
    .filter(Boolean);
}

const AddEditContactScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const { category, contact: editingContact } = route.params || {};

  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [selectedDeviceContact, setSelectedDeviceContact] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [modalAutoCall, setModalAutoCall] = useState(false);
  const [modalAutoText, setModalAutoText] = useState(true);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissionAndLoad();
    if (editingContact) {
      setNameInput(editingContact.name || '');
      setPhoneInput(editingContact.phone || editingContact.detail || '');
      setModalAutoCall(!!editingContact.autoCall);
      setModalAutoText(!!editingContact.autoText);
      setSelectedCountry(editingContact.country || 'US');
    }
  }, [editingContact]);

  const checkPermissionAndLoad = async () => {
    try {
      setLoading(true);
      const status = await Contacts.checkPermission();
      if (status === 'authorized') {
        setPermissionStatus('granted');
        await loadContacts();
      } else if (status === 'denied') {
        setPermissionStatus('denied');
      } else {
        setPermissionStatus('idle');
      }
    } catch (error) {
      console.error('Permission check failed', error);
      setPermissionStatus('denied');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const deviceContacts = await Contacts.getAllWithoutPhotos();
      const deviceOpts = deviceContactsToOptions(deviceContacts);
      setDeviceOptions(deviceOpts);
    } catch (error) {
      console.error('Failed to load contacts', error?.message || error);
      setDeviceOptions([]);
    }
  };

  const requestContactsPermission = async () => {
    try {
      setLoading(true);
      const current = await Contacts.checkPermission();
      if (current === 'authorized') {
        setPermissionStatus('granted');
        await loadContacts();
        return;
      }

      setPermissionStatus('requesting');
      const status = await Contacts.requestPermission();

      if (status === 'authorized') {
        setPermissionStatus('granted');
        await loadContacts();
      } else {
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('Permission request failed', error);
      setPermissionStatus('denied');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDevice = (item) => {
    setSelectedDeviceContact(item);
    setNameInput(item.name);

    // Clean phone number: remove spaces, country codes, and get last 10 digits
    let cleanedPhone = item.phone ? item.phone.replace(/\s+/g, '').replace(/[-()]/g, '') : '';

    // Remove country prefixes (+91, +1, 91, 1, etc.)
    cleanedPhone = cleanedPhone.replace(/^\+91|^\+1|^91|^1/, '');

    // Get last 10 digits if longer
    if (cleanedPhone.length > 10) {
      cleanedPhone = cleanedPhone.slice(-10);
    }

    setPhoneInput(cleanedPhone);
    setShowDeviceDropdown(false);
  };

  const loadServerContacts = async () => {
    try {
      const data = await ApiService.getContacts();
      const items = Array.isArray(data) ? data : data?.contacts || [];
      const SECTION_KEYS = ['Emergency', 'Family', 'Friend'];
      const grouped = SECTION_KEYS.map(title => ({ title, data: [] }));

      items.forEach(c => {
        const relation = (c.relation || 'Friend').toLowerCase();
        const title = relation === 'emergency' ? 'Emergency' : relation === 'family' ? 'Family' : 'Friend';
        const contact = {
          id: c.id || c._id || `${c.name || 'unknown'}-${c.phone || ''}`,
          name: c.name || 'Unknown',
          detail: c.phone || c.detail || '',
          phone: c.phone || c.detail || '',
          autoCall: !!c.autoCall,
          autoText: !!c.autoText,
          relation: title,
        };
        const section = grouped.find(s => s.title === title);
        if (section) {
          section.data.push(contact);
        }
      });

      dispatch(setContactsAction(grouped));
    } catch (error) {
      console.error('Failed to fetch contacts from API', error?.message || error);
    }
  };

  const handleSaveContact = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      return;
    }
    setSaving(true);
    const payload = {
      name: nameInput.trim(),
      phone: phoneInput.trim(),
      relation: category || 'Emergency',
      country: selectedCountry,
      autoCall: modalAutoCall,
      autoText: modalAutoText,
    };
    try {
      if (editingContact) {
        await ApiService.updateContact(editingContact.id, payload);
      } else {
        await ApiService.createContact(payload);
      }

      await loadServerContacts();
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save contact', err?.message || err);
    } finally {
      setSaving(false);
    }
  };

  const filteredDeviceOptions = deviceOptions.filter(item => {
    if (!deviceSearchQuery.trim()) return true;
    const query = deviceSearchQuery.toLowerCase();
    return item.name.toLowerCase().includes(query) ||
      item.phone.includes(query);
  });

  return (
    <LinearGradient
      colors={['#68778f', '#68778f', '#68778f']}
      locations={[0, 0.2, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      angle={190}
      useAngle={true}
      style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#FFFFFF" style={styles.backIcon} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingContact ? 'Edit Contact' : 'Add Contact'}</Text>
          <Text style={styles.subtitle}>Category: {category || 'Emergency'}</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <Text style={styles.modalLabel}>Pick from phone</Text>
          <View style={styles.phoneContactsDropdownWrapper}>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                permissionStatus !== 'granted' && styles.dropdownDisabled,
              ]}
              onPress={() => {
                if (permissionStatus === 'granted') {
                  setShowDeviceDropdown(!showDeviceDropdown);
                } else if (permissionStatus !== 'granted') {
                  requestContactsPermission();
                }
              }}
              disabled={permissionStatus === 'requesting'}
            >
              <Text style={styles.dropdownValue}>
                {permissionStatus === 'denied' || permissionStatus === 'idle'
                  ? 'Tap to grant permission'
                  : permissionStatus === 'requesting'
                    ? 'Requesting permission...'
                    : selectedDeviceContact
                      ? `${selectedDeviceContact.name} (${selectedDeviceContact.phone})`
                      : 'Select from phone contacts'}
              </Text>
              <Text style={styles.dropdownChevron}>
                {permissionStatus !== 'granted' ? '!' : showDeviceDropdown ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {showDeviceDropdown && permissionStatus === 'granted' && (
              <View style={styles.floatingPhoneDropdownContainer}>
                <View style={styles.searchInputContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search contacts..."
                    placeholderTextColor="#9CA3AF"
                    value={deviceSearchQuery}
                    onChangeText={setDeviceSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <FlatList
                  data={filteredDeviceOptions}
                  keyExtractor={(item) => item.id}
                  style={styles.phoneDropdownList}
                  contentContainerStyle={styles.phoneDropdownListContent}
                  nestedScrollEnabled={true}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceOption,
                        selectedDeviceContact?.id === item.id && styles.deviceOptionActive,
                      ]}
                      onPress={() => handleSelectDevice(item)}
                    >
                      <View style={styles.deviceOptionContent}>
                        <Text style={styles.deviceName}>{item.name}</Text>
                        <Text style={styles.devicePhone}>{item.phone}</Text>
                      </View>
                      {selectedDeviceContact?.id === item.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyOptionsContainer}>
                      <Text style={styles.emptyOptions}>
                        {deviceSearchQuery.trim() ? 'No contacts found matching your search.' : 'No device contacts loaded.'}
                      </Text>
                    </View>
                  }
                />
              </View>
            )}
          </View>

          <Text style={styles.modalLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            placeholderTextColor="#cdd2db"
            value={nameInput}
            onChangeText={setNameInput}
          />

          <Text style={styles.modalLabel}>Country</Text>
          <View style={styles.countryDropdownWrapper}>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              <Text style={styles.dropdownValue}>
                {selectedCountry === 'IN' ? '🇮🇳 India (+91)' : '🇺🇸 United States (+1)'}
              </Text>
              <Text style={styles.dropdownChevron}>
                {showCountryDropdown ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {showCountryDropdown && (
              <View style={styles.floatingDropdownContainer}>
                <FlatList
                  data={[
                    { code: 'US', name: 'United States', prefix: '+1', flag: '🇺🇸' },
                    { code: 'IN', name: 'India', prefix: '+91', flag: '🇮🇳' },
                  ]}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceOption,
                        selectedCountry === item.code && styles.deviceOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedCountry(item.code);
                        setShowCountryDropdown(false);
                      }}
                    >
                      <Text style={styles.deviceName}>
                        {item.flag} {item.name} ({item.prefix})
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          <Text style={styles.modalLabel}>Phone</Text>
          <View style={styles.phoneInputContainer}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>
                {selectedCountry === 'IN' ? '+91' : '+1'}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="Enter phone number"
              placeholderTextColor="#cdd2db"
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.autoSection}>
            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>Auto-call on trigger</Text>
              <TouchableOpacity
                style={[styles.autoPill, modalAutoCall && styles.autoPillActive]}
                onPress={() => setModalAutoCall(!modalAutoCall)}
              >
                <Text style={[styles.autoPillText, modalAutoCall && styles.autoPillTextActive]}>
                  {modalAutoCall ? 'Auto-call ✓' : 'Set as Auto-call'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>Auto-text on trigger</Text>
              <TouchableOpacity
                style={[
                  styles.autoPill,
                  modalAutoText ? styles.autoPillActive : styles.autoPillNeutral,
                ]}
                onPress={() => setModalAutoText(!modalAutoText)}
              >
                <Text
                  style={[
                    styles.autoPillText,
                    modalAutoText ? styles.autoPillTextActive : styles.autoPillTextNeutral,
                  ]}
                >
                  {modalAutoText ? 'Yes ✓' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => navigation.goBack()}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButtonPrimary, saving && styles.buttonDisabled]}
              onPress={handleSaveContact}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: nH(60),
  },
  header: {
    marginBottom: nH(20),
    marginHorizontal: nW(20),
  },
  backButton: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backIcon: {
    marginRight: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: nH(100),
    paddingHorizontal: nW(20),
  },
  modalLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 6,
  },
  phoneContactsDropdownWrapper: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 8,
  },
  floatingPhoneDropdownContainer: {
    // position: 'absolute',
    // top: '100%',
    // left: 0,
    // right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 12,
    backgroundColor: '#242733',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    // zIndex: 1000,
    overflow: 'hidden',
    maxHeight: 280,
  },
  searchInputContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3B40',
    backgroundColor: '#2e323a',
  },
  searchInput: {
    backgroundColor: '#1a1d24',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3B40',
    fontSize: 14,
  },
  phoneDropdownList: {
    maxHeight: 220,
  },
  phoneDropdownListContent: {
    paddingBottom: 8,
  },
  deviceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2e323a',
  },
  deviceOptionActive: {
    backgroundColor: 'rgba(233,143,124,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#e98f7c',
  },
  deviceOptionContent: {
    flex: 1,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  devicePhone: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  checkmark: {
    color: '#e98f7c',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyOptionsContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyOptions: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 13,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#2e323a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dropdownValue: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownChevron: {
    color: '#cdd2db',
    fontSize: 14,
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  countryDropdownWrapper: {
    position: 'relative',
    zIndex: 1,
    marginBottom: 8,
  },
  floatingDropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 12,
    backgroundColor: '#242733',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: '#2e323a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3B40',
    fontSize: 14,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phonePrefix: {
    backgroundColor: '#2e323a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#3A3B40',
    justifyContent: 'center',
    minWidth: 60,
  },
  phonePrefixText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
  },
  autoSection: {
    marginTop: 20,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: nH(10),
  },
  autoLabel: {
    color: '#cdd2db',
    fontSize: 12,
  },
  autoPill: {
    paddingHorizontal: nW(12),
    paddingVertical: nH(6),
    borderRadius: n(12),
    borderWidth: 1,
    borderColor: '#94a0b2',
    backgroundColor: '#5d6b7f',
  },
  autoPillNeutral: {
    backgroundColor: '#5d6b7f',
    borderColor: '#94a0b2',
  },
  autoPillActive: {
    backgroundColor: '#e98f7c',
    borderColor: '#e98f7c',
  },
  autoPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  autoPillTextActive: {
    color: '#ffffff',
  },
  autoPillTextNeutral: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  modalButtonPrimary: {
    backgroundColor: '#e98f7c',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderColor: '#3A3B40',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AddEditContactScreen;
