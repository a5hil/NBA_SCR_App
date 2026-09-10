import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

export default function DeviceDetailScreen() {
  const { id, classroomId } = useLocalSearchParams<{ id: string; classroomId: string }>();
  const { classrooms, toggleDevice, updateDeviceValue } = useApp();

  const classroom = classrooms.find(c => c.id === classroomId);
  const device = classroom?.devices.find(d => d.id === id);

  if (!classroom || !device) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Device Not Found" showBack />
        <View style={styles.emptyState}>
          <Ionicons name="hardware-chip-outline" size={64} color={Colors.surfaceTranslucent} />
          <Text style={styles.emptyTitle}>Device not found</Text>
        </View>
      </View>
    );
  }

  const isOn = device.status === 'on';
  const isOffline = device.status === 'offline';

  const getIcon = () => {
    switch (device.category) {
      case 'light': return 'bulb';
      case 'fan': return 'hardware-chip';
      case 'exhaust-fan': return 'aperture';
      case 'ac': return 'snow';
      case 'projector': return 'videocam';
      case 'smart-board': return 'tv';
      case 'television': return 'desktop';
      case 'speaker': return 'volume-high';
      case 'cctv': return 'videocam';
      case 'smart-lock': return 'lock-closed';
      case 'curtain': return 'apps';
      case 'charging-outlet': return 'battery-charging';
      default: return 'power';
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={device.name} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Power Card */}
        <View style={[styles.powerCard, isOn && styles.powerCardActive]}>
          <View style={styles.powerCardHeader}>
            <View style={[styles.deviceIconLarge, isOn && styles.deviceIconLargeActive]}>
              <Ionicons name={getIcon() as any} size={32} color={isOn ? Colors.primary : Colors.text} />
            </View>
            <View style={styles.powerInfo}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceLocation}>{classroom.name} • {device.roomArea}</Text>
              {isOffline && (
                <View style={styles.offlineBadge}>
                  <View style={[styles.dot, { backgroundColor: Colors.critical }]} />
                  <Text style={styles.offlineBadgeText}>Offline</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.powerToggleRow}>
            <Text style={styles.powerLabel}>{isOn ? 'ON' : isOffline ? 'OFFLINE' : 'OFF'}</Text>
            <Switch
              value={isOn}
              onValueChange={() => toggleDevice(classroom.id, device.id)}
              disabled={isOffline}
              trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Power Usage</Text>
            <Text style={styles.statValue}>{device.powerUsage || 0}W</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>{device.energyToday.toFixed(2)} kWh</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Relay Ch.</Text>
            <Text style={styles.statValue}>#{device.relayChannel}</Text>
          </View>
        </View>

        {/* Controls */}
        {device.capabilities.brightness && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="sunny" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Brightness</Text>
              <Text style={styles.controlValue}>{device.brightness ?? 100}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={device.brightness ?? 100}
              onValueChange={(val: number) => updateDeviceValue(classroom.id, device.id, { brightness: val })}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.surfaceTranslucent}
              thumbTintColor={Colors.primary}
            />
          </View>
        )}

        {device.capabilities.speed && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="speedometer" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Speed</Text>
              <Text style={styles.controlValue}>{device.speed ?? 3}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={5}
              step={1}
              value={device.speed ?? 3}
              onValueChange={(val: number) => updateDeviceValue(classroom.id, device.id, { speed: val })}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.surfaceTranslucent}
              thumbTintColor={Colors.primary}
            />
          </View>
        )}

        {device.capabilities.temperature && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="thermometer" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Temperature</Text>
              <Text style={styles.controlValue}>{device.temperature ?? 24}°C</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={16}
              maximumValue={30}
              step={1}
              value={device.temperature ?? 24}
              onValueChange={(val: number) => updateDeviceValue(classroom.id, device.id, { temperature: val })}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.surfaceTranslucent}
              thumbTintColor={Colors.primary}
            />
          </View>
        )}

        {device.capabilities.volume && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="volume-high" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Volume</Text>
              <Text style={styles.controlValue}>{device.volume ?? 50}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={device.volume ?? 50}
              onValueChange={(val: number) => updateDeviceValue(classroom.id, device.id, { volume: val })}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.surfaceTranslucent}
              thumbTintColor={Colors.primary}
            />
          </View>
        )}

        {device.capabilities.mode && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="options" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Mode</Text>
            </View>
            <View style={styles.modeRow}>
              {['cool', 'heat', 'fan', 'auto'].map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeChip, device.mode === mode && styles.modeChipActive]}
                  onPress={() => updateDeviceValue(classroom.id, device.id, { mode: mode as any })}
                >
                  <Text style={[styles.modeChipText, device.mode === mode && styles.modeChipTextActive]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {device.capabilities.source && isOn && (
          <View style={styles.controlCard}>
            <View style={styles.controlHeader}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
              <Text style={styles.controlTitle}>Source</Text>
            </View>
            <View style={styles.modeRow}>
              {['HDMI 1', 'HDMI 2', 'VGA', 'USB'].map(src => (
                <TouchableOpacity
                  key={src}
                  style={[styles.modeChip, device.source === src && styles.modeChipActive]}
                  onPress={() => updateDeviceValue(classroom.id, device.id, { source: src })}
                >
                  <Text style={[styles.modeChipText, device.source === src && styles.modeChipTextActive]}>
                    {src}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Device Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Device Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{device.category}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Controller</Text>
            <Text style={styles.infoValue}>{classroom.controller.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>IP Address</Text>
            <Text style={styles.infoValue}>{classroom.controller.ipAddress}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Firmware</Text>
            <Text style={styles.infoValue}>{classroom.controller.firmwareVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{new Date(device.lastUpdated).toLocaleTimeString()}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Layout.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
  },
  powerCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 16,
  },
  powerCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 168, 58, 0.05)',
  },
  powerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  deviceIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deviceIconLargeActive: {
    backgroundColor: 'rgba(253, 168, 58, 0.15)',
  },
  powerInfo: {
    flex: 1,
  },
  deviceName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  deviceLocation: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offlineBadgeText: {
    color: Colors.critical,
    fontSize: 13,
    fontWeight: '600',
  },
  powerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceTranslucent,
  },
  powerLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  controlCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 12,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  controlTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  controlValue: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.radius.round,
    backgroundColor: Colors.surfaceTranslucent,
  },
  modeChipActive: {
    backgroundColor: Colors.primary,
  },
  modeChipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: '#000',
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginTop: 12,
  },
  infoTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
