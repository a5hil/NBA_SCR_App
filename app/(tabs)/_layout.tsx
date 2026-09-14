import { Tabs } from 'expo-router';
import React from 'react';
import { FloatingBottomNav } from '../../components/FloatingBottomNav';
import { Colors } from '../../constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props: any) => <FloatingBottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="classrooms"
        options={{
          title: 'Classrooms',
          tabBarAccessibilityLabel: 'Classrooms',
        }}
      />
      <Tabs.Screen
        name="energy"
        options={{
          title: 'Energy',
          tabBarAccessibilityLabel: 'Energy',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
