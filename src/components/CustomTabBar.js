import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';

const CustomTabBar = ({state, descriptors, navigation}) => {
  const tabs = [
    {name: 'Home', label: 'Home', icon: '🏠'},
    {name: 'Activity', label: 'Activity', icon: '📊'},
    {name: 'Profile', label: 'Profile', icon: '👤'},
    {name: 'Settings', label: 'Settings', icon: '⚙️'},
  ];

  return (
    <View style={styles.container}>
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
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? {selected: true} : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}>
              <Text style={[styles.icon, isFocused && styles.iconFocused]}>
                {tab && tab.icon ? tab.icon : '•'}
              </Text>
              <Text style={[styles.label, isFocused && styles.labelFocused]}>
                {tab && tab.label ? tab.label : route.name}
              </Text>
              {isFocused && <View style={styles.indicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  iconFocused: {
    transform: [{scale: 1.1}],
  },
  label: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  labelFocused: {
    color: '#007AFF',
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -15,
    width: 30,
    height: 3,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});

export default CustomTabBar;

