import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {normalize} from '../utils/AppFonts';

const CustomTabBar = ({state, descriptors, navigation}) => {
  const insets = useSafeAreaInsets();
  const tabs = [
    {name: 'Home', label: 'Home', icon: '🛡️'},
    {name: 'Contacts', label: 'Contacts', icon: '👥'},
    {name: 'Incidents', label: 'Incidents', icon: '📍'},
    {name: 'Settings', label: 'Settings', icon: '⚙️'},
  ];

  return (
    <View style={[styles.container, {paddingBottom: insets.bottom}]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const tab = tabs.find(t => t.name === route.name);

          return (
            <View key={route.key} style={styles.tabWrapper}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={isFocused ? {selected: true} : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={[
                  styles.tab,
                  isFocused && styles.tabActive,
                ]}>
                <Text
                  style={[
                    styles.icon,
                    isFocused && styles.iconActive,
                  ]}>
                  {tab && tab.icon ? tab.icon : '•'}
                </Text>
                <Text
                  style={[
                    styles.label,
                    isFocused && styles.labelActive,
                  ]}>
                  {tab && tab.label ? tab.label : route.name}
                </Text>
              </TouchableOpacity>
              
              {/* Lightning bolt button on Home tab */}
              {route.name === 'Home' && (
                <TouchableOpacity style={styles.lightningButton}>
                  <Text style={styles.lightningIcon}>⚡</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F1F1F',
    borderTopWidth: 1,
    borderTopColor: '#9CA3AF',
  },
  tabBar: {
    flexDirection: 'row',
    height: normalize(70),
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: normalize(8),
    paddingTop: normalize(8),
    paddingBottom: normalize(8),
  },
  tabWrapper: {
    flex: 1,
    // alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(12),
    minWidth: normalize(60),
  },
  tabActive: {
    backgroundColor: '#240E11',
    borderWidth: 1,
    borderColor: '#421013',
  },
  icon: {
    fontSize: normalize(16),
    marginBottom: normalize(4),
  },
  iconActive: {
    // Icon color handled by emoji, but we can add filter if needed
  },
  label: {
    fontSize: normalize(10),
    color: '#9CA3AF',
    fontWeight: '400',
  },
  labelActive: {
    color: '#D6282f',
    fontWeight: '400',
  },
  lightningButton: {
    position: 'absolute',
    bottom: normalize(45),
    left: '50%',
    marginLeft: normalize(-20),
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lightningIcon: {
    fontSize: normalize(20),
    color: '#FFFFFF',
  },
});

export default CustomTabBar;
