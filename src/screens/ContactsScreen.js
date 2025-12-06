import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import ApiService from '../services/ApiService';

const MOCK_CONTACTS = [
  {
    title: 'Emergency',
    data: [
      { id: '1', name: 'Local Emergency', detail: 'Emergency • United States / Canada • 911', autoCall: true, autoText: false },
    ],
  },
  {
    title: 'Family',
    data: [
      { id: '2', name: 'Mom', detail: 'Family • +1 (408) 555-0110', autoCall: false, autoText: false },
      { id: '3', name: 'Dad', detail: 'Family • +1 (408) 555-0142', autoCall: false, autoText: false },
    ],
  },
  {
    title: 'Friend',
    data: [
      { id: '4', name: 'Priva (BFF)', detail: 'Friend • +1 (408) 555-0199', autoCall: false, autoText: false },
    ],
  },
];

const ContactsScreen = () => {
  const [contacts, setContacts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getContacts();
      const apiContacts = Array.isArray(data?.contacts)
        ? data.contacts
        : Array.isArray(data)
          ? data
          : [];
      const formattedContacts = formatContacts(apiContacts);
      setContacts(formattedContacts);
    } catch (error) {
      console.error('Failed to load contacts', error?.message || error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatContacts = (apiContacts) => {
    // Group by relation like MOCK_CONTACTS
    const groups = {
      Emergency: [],
      Family: [],
      Friend: []
    };

    apiContacts.forEach(contact => {
      if (groups[contact.relation]) {
        groups[contact.relation].push({
           id: contact.id,
           name: contact.name,
           detail: `${contact.relation} • ${contact.phone}`,
           autoCall: contact.autoCall,
           autoText: contact.autoText
        });
      }
    });

    return Object.keys(groups).map(key => ({
      title: key,
      data: groups[key]
    })).filter(section => section.data.length > 0);
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <TouchableOpacity style={styles.addButtonSmall}>
        <Text style={styles.addButtonLabel}>+ Add</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetail}>{item.detail}</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>✎ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>× Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsRow}>
        <Text style={styles.settingLabel}>Auto-call on trigger</Text>
        <View style={[styles.settingBadge, item.autoCall && styles.activeBadge]}>
          <Text style={[styles.settingText, item.autoCall && styles.activeText]}>
            {item.autoCall ? 'Auto-call ✓' : 'Set as Auto-call'}
          </Text>
        </View>
      </View>

      <View style={styles.settingsRow}>
        <Text style={styles.settingLabel}>Auto-text on trigger</Text>
        <View style={styles.settingBadge}>
          <Text style={styles.settingText}>
            {item.autoText ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>
          Choose <Text style={styles.boldWhite}>one</Text> Auto-call contact. The master switch can auto-text all contacts.
        </Text>
      </View>

      {loading ? (
        <React.Fragment>
             <ActivityIndicator size="large" color="#E5484D" style={{marginTop: 50}} />
             <Text style={{color: '#9CA3AF', textAlign: 'center', marginTop: 10}}>Loading Contacts...</Text>
        </React.Fragment>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0F14',
    paddingTop: 60,
    paddingHorizontal: 20,
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
    marginBottom: 16,
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingLabel: {
    color: '#B0B5BA',
    fontSize: 13,
    width: 140,
  },
  settingBadge: {
    backgroundColor: '#0E0F14',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3B40',
  },
  settingText: {
    color: '#B0B5BA',
    fontSize: 12,
    fontWeight: '500',
  },
  activeBadge: {
    backgroundColor: '#E5484D', // Reddish accent
    borderColor: '#E5484D',
  },
  activeText: {
    color: '#FFFFFF',
  },
});

export default ContactsScreen;
