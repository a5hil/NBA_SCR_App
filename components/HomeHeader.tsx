import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { useApp } from '../context/AppContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HomeHeader() {
  const { user, campus, notifications } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.left}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{user.initials}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>Hello, {user.name.split(' ')[0]}</Text>
          <View style={styles.campusRow}>
            <Ionicons name="location" size={14} color={Colors.textMuted} />
            <Text style={styles.campusName}>{campus.name} • {campus.department}</Text>
          </View>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.bellButton}
        onPress={() => router.push('/notifications')}
      >
        <Ionicons name="notifications-outline" size={24} color={Colors.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  textContainer: {
    justifyContent: 'center',
  },
  greeting: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  campusName: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.critical,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
