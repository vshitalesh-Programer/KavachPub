import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const ActivityScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>Your activity history</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default ActivityScreen;

