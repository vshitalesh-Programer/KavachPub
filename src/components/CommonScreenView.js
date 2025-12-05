import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
const CommonScreenView = ({ children }) => {
  return (
    <LinearGradient
    colors={['#140e12', '#0a0b10']}
    style={styles.container}>
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CommonScreenView;