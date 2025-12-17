import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
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



const ContactsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const contactsFromStore = useSelector(state => state.contacts.contacts);
  const [contacts, setContacts] = React.useState(ensureSections(contactsFromStore || []));
  const [permissionStatus, setPermissionStatus] = React.useState('idle'); // idle | granted | denied | requesting
  const [confirmDelete, setConfirmDelete] = React.useState({ visible: false, section: null, id: null });

  React.useEffect(() => {
    checkPermissionAndLoad();
    loadServerContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermissionAndLoad = async () => {
    try {
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
    }
  };

  const loadContacts = async () => {
    try {
      // Device contacts are only needed in AddEditContactScreen now
      const formattedStore = ensureSections(contactsFromStore || []);
      setContacts(formattedStore);
      dispatch(setContactsAction(formattedStore));
    } catch (error) {
      console.error('Failed to load contacts', error?.message || error);
      setContacts([]);
    }
  };

  const loadServerContacts = React.useCallback(async () => {
    try {
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
          country: c.country || 'US',
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
    }
  }, [dispatch]);

  const requestContactsPermission = async () => {
    try {
      // If already granted, don't prompt again
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
    }
  };

  const openAddModal = (category) => {
    navigation.navigate('AddEditContact', { category });
  };

  const handleEditContact = (sectionTitle, contact) => {
    navigation.navigate('AddEditContact', { 
      category: sectionTitle, 
      contact 
    });
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


  const toggleAutoFlag = async (sectionTitle, contact, field) => {
    const updatedValue = !contact[field];
    const payload = {
      name: contact.name,
      phone: contact.phone || contact.detail,
      relation: sectionTitle,
      country: contact.country || 'US',
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

  // Refresh contacts when screen is focused (after returning from AddEditContact)
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadServerContacts();
    });
    return unsubscribe;
  }, [navigation, loadServerContacts]);

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

        {renderDeleteModal()}

        {/* {loading || permissionStatus === 'requesting' ? (
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
        ) : ( */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
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
        {/* )} */}
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
    marginHorizontal: nW(20),
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
  dropdownListContainer: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#242733',
    marginBottom: 10,
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
  phoneContactsDropdownWrapper: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 8,
  },
  floatingPhoneDropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
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
    zIndex: 1000,
    overflow: 'hidden',
  },
  phoneDropdownListContainer: {
    maxHeight: 220,
    flex: 1,
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
  deviceOptionContent: {
    flex: 1,
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
