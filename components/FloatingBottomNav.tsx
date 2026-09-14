import React from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

type NavRoute = {
  key: string;
  name: string;
  params?: object;
};

type FloatingBottomNavProps = {
  state: {
    index: number;
    routes: NavRoute[];
  };
  descriptors: Record<string, { options: { tabBarAccessibilityLabel?: string } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
  classrooms: { active: 'business', inactive: 'business-outline' },
  energy: { active: 'flash', inactive: 'flash-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

export function FloatingBottomNav({ state, descriptors, navigation }: FloatingBottomNavProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const navWidth = Math.min(Layout.nav.width, width - 32);
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <View style={[styles.container, { bottom: bottomPadding, left: (width - navWidth) / 2 }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="dark"
        style={[styles.blurContainer, { width: navWidth }]}
        experimentalBlurMethod="dimezisBlurView"
      >
        <View style={styles.navContent}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const icons = iconMap[route.name] || iconMap.index;
            const iconName = isFocused ? icons.active : icons.inactive;

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel || route.name}
                onPress={onPress}
                style={[
                  styles.tabButton,
                  isFocused && styles.tabButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={iconName}
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  blurContainer: {
    height: Layout.nav.height,
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(30, 30, 30, 0.75)' : 'rgba(10, 10, 10, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
  tabButton: {
    width: Layout.nav.circleSize,
    height: Layout.nav.circleSize,
    borderRadius: Layout.nav.circleSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceTranslucent,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
});
