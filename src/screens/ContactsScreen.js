import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setContacts as setContactsAction } from '../redux/slices/contactSlice';
import LinearGradient from 'react-native-linear-gradient';
import Contacts from 'react-native-contacts';
import ApiService from '../services/ApiService';


const ContactsScreen = () => {
  const dispatch = useDispatch();
  const contactsFromStore = useSelector(state => state.contacts.contacts);
  const [contacts, setContacts] = React.useState(contactsFromStore || []);
  const [loading, setLoading] = React.useState(false);
  const [permissionStatus, setPermissionStatus] = React.useState('idle'); // idle | granted | denied | requesting

  const loadContacts = async () => {
    try {
      setLoading(true);
      // Fetch device contacts (no photos for performance)
      const deviceContacts = await Contacts.getAllWithoutPhotos();
      const formatted = formatDeviceContacts(deviceContacts);
      setContacts(formatted);
      dispatch(setContactsAction(formatted));
    } catch (error) {
      console.error('Failed to load contacts', error?.message || error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const requestContactsPermission = async () => {
    try {
      setPermissionStatus('requesting');
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'Kavach needs access to your contacts to sync and select emergency contacts.',
            buttonPositive: 'Allow',
          },
        );
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionStatus('granted');
          await loadContacts();
        } else {
          setPermissionStatus('denied');
          setContacts([]);
        }
      } else {
        // iOS: assume granted for now; integrate Contacts framework if needed
        setPermissionStatus('granted');
        await loadContacts();
      }
    } catch (error) {
      console.error('Permission request failed', error);
      setPermissionStatus('denied');
      setContacts([]);
    } finally {
      // loading is managed inside loadContacts; leave it false otherwise
    }
  };

  const formatDeviceContacts = (deviceContacts) => {
    // Put all synced contacts under one section "Synced"
    const mapped = (deviceContacts || [])
      .map(c => {
        const name = c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' ').trim() || 'Unknown';
        const phone = Array.isArray(c.phoneNumbers) && c.phoneNumbers.length > 0
          ? c.phoneNumbers[0].number
          : 'No phone';
        return {
          id: c.recordID || `${name}-${phone}`,
          name,
          detail: phone,
          autoCall: false,
          autoText: false,
        };
      })
      .filter(item => !!item.id && !!item.name && !!item.detail);

    return mapped.length > 0 ? [{ title: 'Synced', data: mapped }] : [];
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetail}>{item.detail}</Text>
        </View>
        <View style={styles.tagRow}>
          {item.autoCall && <Text style={[styles.tag, styles.tagPrimary]}>Auto-call</Text>}
          {item.autoText && <Text style={[styles.tag, styles.tagSecondary]}>Auto-text</Text>}
        </View>
      </View>

      <View style={styles.cardFooter}>
        {/* <View style={styles.footerPill}>
          <Text style={styles.footerPillLabel}>Auto-call</Text>
          <Text style={styles.footerPillValue}>{item.autoCall ? 'Enabled' : 'Not set'}</Text>
        </View> */}
        <View style={styles.footerPill}>
          <Text style={styles.footerPillLabel}>Auto-text</Text>
          <Text style={styles.footerPillValue}>{item.autoText ? 'Enabled' : 'Not set'}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#240E11', '#0c0b11']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
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
        <View style={{flex: 1}}>
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

      {loading || permissionStatus === 'requesting' ? (
        <React.Fragment>
          <ActivityIndicator size="large" color="#E5484D" style={{marginTop: 50}} />
          <Text style={{color: '#9CA3AF', textAlign: 'center', marginTop: 10}}>
            {permissionStatus === 'requesting' ? 'Requesting permission...' : 'Loading Contacts...'}
          </Text>
        </React.Fragment>
      ) : permissionStatus !== 'granted' ? (
        <Text style={{color: '#9CA3AF', textAlign: 'center', marginTop: 40}}>
          Allow contacts permission to view and manage your synced contacts.
        </Text>
      ) : (
        <SectionList
          sections={contacts}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false} 
          ListEmptyComponent={
            <Text style={{color: '#9CA3AF', textAlign: 'center', marginTop: 50}}>
              No contacts found. Add one!
            </Text>
          }
        />
      )}
    </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  gradient: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 100,
  },
  syncCard: {
    backgroundColor: '#16171D',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#25262C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  syncTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  syncSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  syncWarning: {
    color: '#E5484D',
    fontSize: 12,
    marginTop: 6,
  },
  syncButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
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
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeader: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: '#1E1F25',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
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
  card: {
    backgroundColor: '#16171D',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#25262C',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#3A3B40',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    color: '#B0B5BA',
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    gap: 10,
  },
  footerPill: {
    flex: 1,
    backgroundColor: '#0E0F14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25262C',
    padding: 10,
  },
  footerPillLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  footerPillValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ContactsScreen;
