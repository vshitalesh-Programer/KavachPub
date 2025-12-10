import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import SimpleLineIcon from 'react-native-vector-icons/SimpleLineIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {normalize} from '../utils/AppFonts';

const CustomTabBar = ({state, descriptors, navigation}) => {
  const insets = useSafeAreaInsets();
  const tabs = [
    {name: 'Home', label: 'Home', icon: 'shield', activeIcon: 'shield', set: 'feather'},
    {name: 'Contacts', label: 'Contacts', icon: 'users', activeIcon: 'users', set: 'feather'},
    {name: 'Incidents', label: 'Incidents', icon: 'location-pin', activeIcon: 'location-pin', set: 'simple'},
    {name: 'Settings', label: 'Settings', icon: 'settings', activeIcon: 'settings', set: 'feather'},
  ];

  return (
    <View style={[styles.container, {paddingBottom: insets.bottom || normalize(6)}]}>
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
                {tab?.set === 'simple' ? (
                  <SimpleLineIcon
                    name={isFocused && tab?.activeIcon ? tab.activeIcon : tab?.icon || 'location-pin'}
                    size={normalize(18)}
                    color={isFocused ? '#DC2626' : '#ffffff'}
                    style={styles.icon}
                  />
                ) : (
                  <Icon
                    name={isFocused && tab?.activeIcon ? tab.activeIcon : tab?.icon || 'circle'}
                    size={normalize(18)}
                    color={isFocused ? '#DC2626' : '#ffffff'}
                    style={styles.icon}
                  />
                )}
                <Text
                  style={[
                    styles.label,
                    isFocused && styles.labelActive,
                  ]}>
                  {tab && tab.label ? tab.label : route.name}
                </Text>
              </TouchableOpacity>
              
              {/* Lightning bolt button on Home tab */}
              {/* {route.name === 'Home' && (
                <TouchableOpacity style={styles.lightningButton}>
                  <Icon name="zap" size={normalize(20)} color="#FFFFFF" />
                </TouchableOpacity>
              )} */}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#424b5b',
    borderTopWidth: 1,
    borderTopColor: '#94a0b2',
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
    backgroundColor: 'rgba(220,38,38,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.28)',
    shadowColor: 'rgba(220,38,38,0.12)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#ffffff',
    fontWeight: '500',
  },
  labelActive: {
    color: '#DC2626',
    fontWeight: '600',
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
