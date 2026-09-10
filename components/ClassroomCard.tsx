import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Classroom } from '../types';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ClassroomCardProps {
  classroom: Classroom;
}

export function ClassroomCard({ classroom }: ClassroomCardProps) {
  const router = useRouter();
  
  const activeDevices = classroom.devices.filter(d => d.status === 'on').length;
  const isOffline = classroom.status === 'offline';
  const isOccupied = classroom.occupancy === 'occupied';

  return (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/classroom/${classroom.id}`)}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{classroom.name}</Text>
          <Text style={styles.subtitle}>{classroom.building} • {classroom.floor}</Text>
        </View>
        <View style={styles.statusBadges}>
          {isOffline ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <View style={[styles.dot, { backgroundColor: Colors.critical }]} />
              <Text style={[styles.badgeText, { color: Colors.critical }]}>Offline</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: isOccupied ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.1)' }]}>
              <View style={[styles.dot, { backgroundColor: isOccupied ? Colors.success : Colors.textMuted }]} />
              <Text style={[styles.badgeText, { color: isOccupied ? Colors.success : Colors.textMuted }]}>
                {isOccupied ? 'Occupied' : 'Vacant'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="radio-button-on" size={16} color={Colors.primary} />
          <Text style={styles.statText}>{activeDevices} Active Devices</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="thermometer-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.statText}>{classroom.temperature}°C</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="flash-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.statText}>{(classroom.currentLoad / 1000).toFixed(1)} kW</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  statusBadges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radius.round,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceTranslucent,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
});
