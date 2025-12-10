import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setContacts as setContactsAction } from '../redux/slices/contactSlice';
import LinearGradient from 'react-native-linear-gradient';
import Contacts from 'react-native-contacts';
import ApiService from '../services/ApiService';
import Fonts from '../utils/AppFonts';

const { n, nH, nW } = Fonts;
const SECTION_KEYS = ['Emergency', 'Family', 'Friend'];

// Helpers (hoisted above component to avoid undefined)
function ensureSections(sections) {
  const map = new Map((sections || []).map(s => [s.title, s.data || []]));
  return SECTION_KEYS.map(title => ({
    title,
    data: map.get(title) || [],
  }));
}

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


const ContactsScreen = () => {
  const dispatch = useDispatch();
  const contactsFromStore = useSelector(state => state.contacts.contacts);
  const [contacts, setContacts] = React.useState(ensureSections(contactsFromStore || []));
  const [loading, setLoading] = React.useState(false);
  const [permissionStatus, setPermissionStatus] = React.useState('idle'); // idle | granted | denied | requesting
  const [deviceOptions, setDeviceOptions] = React.useState([]);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addCategory, setAddCategory] = React.useState('Emergency');
  const [selectedDeviceContact, setSelectedDeviceContact] = React.useState(null);
  const [nameInput, setNameInput] = React.useState('');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [editingContact, setEditingContact] = React.useState(null);
  const [modalAutoCall, setModalAutoCall] = React.useState(false);
  const [modalAutoText, setModalAutoText] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState({ visible: false, section: null, id: null });
  const [showDeviceDropdown, setShowDeviceDropdown] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    checkPermissionAndLoad();
    loadServerContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setLoading(true);
      // Fetch device contacts (no photos for performance)
      const deviceContacts = await Contacts.getAllWithoutPhotos();
      const deviceOpts = deviceContactsToOptions(deviceContacts);
      setDeviceOptions(deviceOpts);

      const formattedStore = ensureSections(contactsFromStore || []);
      setContacts(formattedStore);
      dispatch(setContactsAction(formattedStore));
    } catch (error) {
      console.error('Failed to load contacts', error?.message || error);
      setContacts([]);
      setDeviceOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadServerContacts = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getContacts();
      console.log('data', data);
      const items = Array.isArray(data) ? data : data?.contacts || [];
      const grouped = ensureSections([]);
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
      setContacts(grouped);
      dispatch(setContactsAction(grouped));
    } catch (error) {
      console.error('Failed to fetch contacts from API', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const requestContactsPermission = async () => {
    try {
      // If already granted, skip re-request
      if (permissionStatus === 'granted') {
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
        setContacts([]);
      }
    } catch (error) {
      console.error('Permission request failed', error);
      setPermissionStatus('denied');
      setContacts([]);
    }
  };

  const openAddModal = (category) => {
    setAddCategory(category);
    setSelectedDeviceContact(null);
    setNameInput('');
    setPhoneInput('');
    setModalAutoCall(false);
    setModalAutoText(false);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedDeviceContact(null);
    setNameInput('');
    setPhoneInput('');
  };

  const handleSelectDevice = (item) => {
    setSelectedDeviceContact(item);
    setNameInput(item.name);
    setPhoneInput(item.phone);
  };

  const handleEditContact = (sectionTitle, contact) => {
    setAddCategory(sectionTitle);
    setEditingContact(contact);
    setNameInput(contact.name || '');
    setPhoneInput(contact.phone || contact.detail || '');
    setSelectedDeviceContact(null);
    setModalAutoCall(!!contact.autoCall);
    setModalAutoText(!!contact.autoText);
    setShowAddModal(true);
  };

  const handleDeleteContact = (sectionTitle, contactId) => {
    setConfirmDelete({ visible: true, section: sectionTitle, id: contactId });
  };

  const confirmDeleteContact = async () => {
    const { section, id } = confirmDelete;
    if (!section || !id) {
      setConfirmDelete({ visible: false, section: null, id: null });
      return;
    }
    try {
      await ApiService.deleteContact(id);
      const updated = contacts.map(sec => {
        if (sec.title === section) {
          return { ...sec, data: sec.data.filter(c => c.id !== id) };
        }
        return sec;
      });
      setContacts(updated);
      dispatch(setContactsAction(updated));
    } catch (error) {
      console.error('Failed to delete contact', error?.message || error);
    } finally {
      setConfirmDelete({ visible: false, section: null, id: null });
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
      relation: addCategory,
      country: "US",
      autoCall: modalAutoCall,
      autoText: modalAutoText,
    };
    try {
      const saved = editingContact
        ? await ApiService.updateContact(editingContact.id, payload)
        : await ApiService.createContact(payload);

      // Refresh from server to keep in sync
      await loadServerContacts();

      // Fallback local update if server didn't return immediately
      if (!saved) {
        closeAddModal();
        return;
      }

    } catch (err) {
      console.error('Failed to save contact', err?.message || err);
    } finally {
      setSaving(false);
      closeAddModal();
    }
  };

  const toggleAutoFlag = async (sectionTitle, contact, field) => {
    const updatedValue = !contact[field];
    const payload = {
      name: contact.name,
      phone: contact.phone || contact.detail,
      relation: sectionTitle,
      country: 'US',
      autoCall: field === 'autoCall' ? updatedValue : contact.autoCall,
      autoText: field === 'autoText' ? updatedValue : contact.autoText,
    };
    try {
      await ApiService.updateContact(contact.id, payload);
      const updated = contacts.map(section => {
        if (section.title === sectionTitle) {
          return {
            ...section,
            data: section.data.map(it => it.id === contact.id ? { ...it, ...payload } : it),
          };
        }
        return section;
      });
      setContacts(updated);
      dispatch(setContactsAction(updated));
    } catch (error) {
      console.error('Failed to update auto flags', error?.message || error);
    }
  };

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={closeAddModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add Contact</Text>
          <Text style={styles.modalSubtitle}>Category: {addCategory}</Text>

          <Text style={styles.modalLabel}>Pick from phone</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setShowDeviceDropdown(!showDeviceDropdown)}
          >
            <Text style={styles.dropdownValue}>
              {selectedDeviceContact ? `${selectedDeviceContact.name} (${selectedDeviceContact.phone})` : 'Select from phone contacts'}
            </Text>
            <Text style={styles.dropdownChevron}>{showDeviceDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDeviceDropdown && (
            <View style={styles.dropdownListContainer}>
              <FlatList
                data={deviceOptions}
                keyExtractor={(item) => item.id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.deviceOption,
                      selectedDeviceContact?.id === item.id && styles.deviceOptionActive,
                    ]}
                    onPress={() => {
                      handleSelectDevice(item);
                      setShowDeviceDropdown(false);
                    }}
                  >
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.devicePhone}>{item.phone}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyOptions}>No device contacts loaded.</Text>
                }
              />
            </View>
          )}

          <Text style={styles.modalLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            placeholderTextColor="#cdd2db"
            value={nameInput}
            onChangeText={setNameInput}
          />

          <Text style={styles.modalLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor="#cdd2db"
            value={phoneInput}
            onChangeText={setPhoneInput}
            keyboardType="phone-pad"
          />

          <View>
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
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={closeAddModal}>
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
        </View>
      </View>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal
      visible={confirmDelete.visible}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmDelete({ visible: false, section: null, id: null })}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Delete contact?</Text>
          <Text style={styles.modalSubtitle}>This action cannot be undone.</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setConfirmDelete({ visible: false, section: null, id: null })}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={confirmDeleteContact}
            >
              <Text style={styles.modalButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          <Text style={styles.title}>Contacts</Text>
          <Text style={styles.subtitle}>
            Choose <Text style={styles.boldWhite}>one</Text> Auto-call contact. The master switch can auto-text all contacts.
          </Text>
        </View>

        {renderAddModal()}
        {renderDeleteModal()}

        {loading || permissionStatus === 'requesting' ? (
          <React.Fragment>
            <ActivityIndicator size="large" color="#E5484D" style={styles.statusSpinner} />
            <Text style={styles.statusText}>
              {permissionStatus === 'requesting' ? 'Requesting permission...' : 'Loading Contacts...'}
            </Text>
          </React.Fragment>
        ) : permissionStatus !== 'granted' ? (
          <Text style={styles.permissionText}>
            Allow contacts permission to view and manage your synced contacts.
          </Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Sync card */}
            <View style={styles.syncCard}>
              <View style={styles.syncContent}>
                <Text style={styles.syncTitle}>Sync phone contacts</Text>
                <Text style={styles.syncSubtitle}>
                  Grant contacts permission to import your phone contacts and pick Auto-call numbers.
                </Text>
                {permissionStatus === 'denied' && (
                  <Text style={styles.syncWarning}>Permission denied. Please allow access to sync contacts.</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={requestContactsPermission}>
                <Text style={styles.syncButtonText}>
                  {permissionStatus === 'granted' ? 'Resync' : 'Allow & Sync'}
                </Text>
              </TouchableOpacity>
            </View>
            {contacts.length === 0 && (
              <Text style={styles.emptyListText}>
                No contacts found. Add one!
              </Text>
            )}
            {contacts.map(section => (
              <View key={section.title} style={styles.sectionCard}>
                <View style={styles.sectionHeaderContainer}>
                  <Text style={styles.sectionHeader}>{section.title}</Text>
                  <TouchableOpacity style={styles.addButton} onPress={() => openAddModal(section.title)}>
                    <Text style={styles.addButtonText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
                {section.data.map(item => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.contactName}>{item.name}</Text>
                        <Text style={styles.contactDetail}>{item.detail || item.phone}</Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditContact(section.title, item)}>
                          <Text style={styles.actionBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDeleteContact(section.title, item.id)}>
                          <Text style={styles.actionBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.autoRow}>
                      <Text style={styles.autoLabel}>Auto-call on trigger</Text>
                      <TouchableOpacity
                        style={[styles.autoPill, item.autoCall && styles.autoPillActive]}
                        onPress={() => toggleAutoFlag(section.title, item, 'autoCall')}
                      >
                        <Text style={[styles.autoPillText, item.autoCall && styles.autoPillTextActive]}>
                          {item.autoCall ? 'Auto-call ✓' : 'Set as Auto-call'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.autoRow}>
                      <Text style={styles.autoLabel}>Auto-text on trigger</Text>
                      <TouchableOpacity
                        style={[
                          styles.autoPill,
                          item.autoText ? styles.autoPillActive : styles.autoPillNeutral,
                        ]}
                        onPress={() => toggleAutoFlag(section.title, item, 'autoText')}
                      >
                        <Text
                          style={[
                            styles.autoPillText,
                            item.autoText ? styles.autoPillTextActive : styles.autoPillTextNeutral,
                          ]}
                        >
                          {item.autoText ? 'Yes ✓' : 'No'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: nH(40),
  },
  gradient: {
    flex: 1,
  },
  header: {
    marginBottom: nH(20),
    marginHorizontal: nW(20),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: nH(100),
    paddingHorizontal: nW(20),
    gap: nH(16),
  },
  sectionCard: {
    backgroundColor: '#68778f',
    borderRadius: n(16),
    borderWidth: 1,
    borderColor: '#94a0b2',
    padding: n(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },
  emptyListText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 50,
  },
  syncCard: {
    backgroundColor: '#68778f',
    borderRadius: n(14),
    padding: n(16),
    borderWidth: n(1),
    borderColor: '#94a0b2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: nW(12),
    marginBottom: nH(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 10,
  },
  syncContent: {
    flex: 1,
  },
  syncTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  syncSubtitle: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  syncWarning: {
    color: '#E5484D',
    fontSize: 12,
    marginTop: 6,
  },
  statusSpinner: {
    marginTop: 50,
  },
  statusText: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 10,
  },
  permissionText: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 40,
  },
  syncButton: {
    backgroundColor: '#e98f7c',
    paddingVertical: nH(10),
    paddingHorizontal: nW(14),
    borderRadius: n(12),
    borderWidth: n(1),
    borderColor: '#e98f7c',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: nH(12),
    paddingHorizontal: nW(4),
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: '#68778f',
    paddingVertical: nH(4),
    paddingHorizontal: nW(12),
    borderRadius: n(12),
    overflow: 'hidden', // iOS
  },
  addButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: nW(10),
    paddingVertical: nH(6),
    borderRadius: n(10),
    borderWidth: n(1),
    borderColor: '#94a0b2',
    backgroundColor: '#68778f',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#68778f',
    borderRadius: n(12),
    padding: n(14),
    borderWidth: 1,
    borderColor: '#94a0b2',
    paddingBottom: nH(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 6,
    marginBottom: nH(12),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    // marginBottom: 12,
  },
  contactName: {
    fontSize: n(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: nH(4),
  },
  contactDetail: {
    fontSize: 12,
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: nW(8),
    alignItems: 'center',
  },
  actionBtn: {
    borderWidth: n(1),
    borderColor: '#94a0b2',
    borderRadius: n(8),
    paddingVertical: nH(4),
    paddingHorizontal: nW(10),
  },
  actionBtnDanger: {
    borderColor: '#e7000a',
    backgroundColor: '#e7000a',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
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
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: nW(10),
    marginTop: nH(10),
  },
  tagRow: {
    flexDirection: 'row',
    gap: nW(6),
  },
  tag: {
    paddingHorizontal: nW(8),
    paddingVertical: nH(3),
    borderRadius: n(10),
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  tagPrimary: {
    backgroundColor: '#E5484D',
    color: '#FFFFFF',
  },
  tagSecondary: {
    backgroundColor: '#1F2937',
    color: '#E5E7EB',
  },
  cardFooter: {
    flexDirection: 'row',
    // gap: 10,
  },
  footerPill: {
    backgroundColor: '#0E0F14',
    borderRadius: n(12),
    borderWidth: n(1),
    borderColor: '#25262C',
    padding: n(6),
    marginTop: -nH(6),
  },
  footerPillLabel: {
    color: '#ffffff',
    fontSize: n(8),
    marginBottom: 4,
  },
  footerPillValue: {
    color: '#FFFFFF',
    fontSize: n(10),
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: nW(16),
  },
  modalCard: {
    backgroundColor: '#242733',
    borderRadius: n(16),
    padding: n(16),
    borderWidth: n(1),
    borderColor: '#94a0b2',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: '#cdd2db',
    fontSize: 12,
    marginBottom: 12,
  },
  modalLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  modalList: {
    maxHeight: 180,
    marginBottom: 10,
  },
  deviceOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3B40',
    marginBottom: 8,
  },
  deviceOptionActive: {
    borderColor: '#e98f7c',
    backgroundColor: 'rgba(233,143,124,0.1)',
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
  dropdownListContainer: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#242733',
    marginBottom: 10,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  devicePhone: {
    color: '#cdd2db',
    fontSize: 12,
    marginTop: 2,
  },
  emptyOptions: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
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

export default ContactsScreen;
