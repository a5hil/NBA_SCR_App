import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Device } from '../types';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface DeviceCardProps {
  device: Device;
  classroomId?: string;
  onToggle: () => void;
}

export function DeviceCard({ device, classroomId, onToggle }: DeviceCardProps) {
  const router = useRouter();
  const isOn = device.status === 'on';
  const isOffline = device.status === 'offline';
  const isCurtain = device.category === 'curtain';

  const targetClassroomId = classroomId || (
    device.id.includes('a101') ? 'cls-a101' :
    device.id.includes('a102') ? 'cls-a102' :
    'cls-corridor'
  );

  const getIcon = () => {
    switch (device.category) {
      case 'light': return 'bulb';
      case 'fan': return 'hardware-chip';
      case 'curtain': return 'apps';
      default: return 'power';
    }
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (isCurtain) return isOn ? 'Open (90°)' : 'Closed';
    const rating = device.ratedPower || (device.category === 'fan' ? 75 : device.category === 'light' ? 60 : 40);
    return isOn ? `On • ${device.powerUsage || rating}W` : `Off • ${rating}W`;
  };

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        isOn && !isOffline && styles.cardActive,
        isOffline && styles.cardOffline
      ]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/device/[id]', params: { id: device.id, classroomId: targetClassroomId } })}
    >
      <View style={styles.header}>
        <View style={[
          styles.iconContainer,
          isOn && !isOffline && styles.iconContainerActive,
          isOffline && styles.iconContainerOffline
        ]}>
          <Ionicons 
            name={getIcon() as any} 
            size={20} 
            color={isOffline ? Colors.textMuted : isOn ? Colors.primary : Colors.text} 
          />
        </View>
        <Switch
          value={isOn}
          onValueChange={onToggle}
          disabled={isOffline}
          trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
          thumbColor={isOn ? '#FFF' : Colors.textMuted}
          style={{ transform: [{ scale: 0.8 }] }}
        />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isOffline && styles.textOffline]} numberOfLines={1}>
          {device.name}
        </Text>
        <Text style={styles.status}>
          {getStatusText()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%', // Allows 2 cards per row with gap
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 16,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 168, 58, 0.05)',
  },
  cardOffline: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(253, 168, 58, 0.15)',
  },
  iconContainerOffline: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  info: {
    gap: 4,
  },
  name: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  textOffline: {
    color: Colors.textMuted,
  },
  status: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
