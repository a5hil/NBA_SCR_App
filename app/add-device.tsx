import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert as RNAlert } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { useApp } from '../context/AppContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Device, DeviceCategory, DeviceCapability } from '../types';

const DEVICE_CATEGORIES: { label: string; value: DeviceCategory; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'bulb' },
  { label: 'Fan', value: 'fan', icon: 'hardware-chip' },
  { label: 'AC', value: 'ac', icon: 'snow' },
  { label: 'Projector', value: 'projector', icon: 'videocam' },
  { label: 'Smart Board', value: 'smart-board', icon: 'tv' },
  { label: 'Television', value: 'television', icon: 'desktop' },
  { label: 'Speaker', value: 'speaker', icon: 'volume-high' },
  { label: 'CCTV', value: 'cctv', icon: 'videocam' },
  { label: 'Smart Lock', value: 'smart-lock', icon: 'lock-closed' },
  { label: 'Curtain', value: 'curtain', icon: 'apps' },
  { label: 'Charging Outlet', value: 'charging-outlet', icon: 'battery-charging' },
  { label: 'Exhaust Fan', value: 'exhaust-fan', icon: 'aperture' },
];

export default function AddDeviceScreen() {
  const { classrooms, addDevice } = useApp();
  const router = useRouter();

  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [category, setCategory] = useState<DeviceCategory | ''>('');
  const [relayChannel, setRelayChannel] = useState('');
  const [roomArea, setRoomArea] = useState('');

  const classroom = classrooms.find(c => c.id === selectedClassroom);

  const relayChannelNum = parseInt(relayChannel);
  const isRelayValid = !isNaN(relayChannelNum) && relayChannelNum >= 1 && relayChannelNum <= 8;
  const isRelayUsed = classroom?.controller.usedChannels.includes(relayChannelNum);

  const canSubmit = selectedClassroom && deviceName.trim() && category && isRelayValid && !isRelayUsed && roomArea.trim();

  const handleSubmit = () => {
    if (!classroom || !category) return;

    const caps: DeviceCapability = { power: true };
    if (category === 'light') { caps.brightness = true; }
    if (category === 'fan') { caps.speed = true; }
    if (category === 'ac') { caps.temperature = true; caps.mode = true; caps.speed = true; }
    if (category === 'speaker' || category === 'television') { caps.volume = true; }
    if (category === 'projector' || category === 'television') { caps.source = true; }

    const newDevice: Device = {
      id: `dev-new-${Date.now()}`,
      name: deviceName,
      category,
      status: 'off',
      controllerId: classroom.controller.id,
      relayChannel: parseInt(relayChannel),
      roomArea,
      capabilities: caps,
      powerUsage: 0,
      energyToday: 0,
      lastUpdated: new Date().toISOString(),
    };

    addDevice(classroom.id, newDevice);
    RNAlert.alert('Success', `${deviceName} has been added to ${classroom.name}!`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Add Device" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Select Classroom */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Classroom</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {classrooms.filter(c => c.status === 'online').map(cls => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chip, selectedClassroom === cls.id && styles.chipActive]}
                onPress={() => setSelectedClassroom(cls.id)}
              >
                <Text style={[styles.chipText, selectedClassroom === cls.id && styles.chipTextActive]}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Device Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Device Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ceiling Fan 3"
            placeholderTextColor={Colors.textMuted}
            value={deviceName}
            onChangeText={setDeviceName}
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Device Type</Text>
          <View style={styles.categoryGrid}>
            {DEVICE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryItem, category === cat.value && styles.categoryItemActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={24}
                  color={category === cat.value ? '#000' : Colors.text}
                />
                <Text style={[styles.categoryLabel, category === cat.value && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Relay Channel */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Relay Channel</Text>
          <TextInput
            style={[styles.input, (isRelayUsed || (relayChannel.length > 0 && !isRelayValid)) && { borderColor: Colors.critical }]}
            placeholder="e.g. 1-8"
            placeholderTextColor={Colors.textMuted}
            value={relayChannel}
            onChangeText={setRelayChannel}
            keyboardType="number-pad"
          />
          {classroom && (
            <Text style={styles.helperText}>
              Used channels: {classroom.controller.usedChannels.join(', ') || 'None'}
            </Text>
          )}
          {isRelayUsed && (
            <Text style={[styles.helperText, { color: Colors.critical }]}>
              This channel is already in use by another device.
            </Text>
          )}
          {relayChannel.length > 0 && !isRelayValid && !isRelayUsed && (
            <Text style={[styles.helperText, { color: Colors.critical }]}>
              Please enter a valid channel number (1-8).
            </Text>
          )}
        </View>

        {/* Room Area */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Room Area</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ceiling, Wall, Front"
            placeholderTextColor={Colors.textMuted}
            value={roomArea}
            onChangeText={setRoomArea}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          <Ionicons name="add-circle" size={20} color="#000" />
          <Text style={styles.submitButtonText}>Add Device</Text>
        </TouchableOpacity>
      </View>
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
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.md,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    paddingLeft: 4,
  },
  chipScroll: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.radius.round,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#000',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    width: '30%',
    aspectRatio: 1.2,
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 8,
  },
  categoryItemActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryLabel: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#000',
  },
  bottomBar: {
    padding: Layout.spacing.md,
    paddingBottom: 32,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.primary,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
