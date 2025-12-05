import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const ContactsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contacts</Text>
      <Text style={styles.subtitle}>Your contacts list</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export default ContactsScreen;

