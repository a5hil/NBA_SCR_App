import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function DeviceDetailScreen() {
  const { id, classroomId } = useLocalSearchParams<{ id: string; classroomId: string }>();
  const { classrooms, toggleDevice, esp32Connected, esp32Ip, updateDeviceRatedPower } = useApp();
  const router = useRouter();

  const classroom = classroomId
    ? classrooms.find(c => c.id === classroomId)
    : classrooms.find(c => c.devices.some(d => d.id === id));
  const device = classroom?.devices.find(d => d.id === id);

  if (!classroom || !device) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Device Not Found" showBack />
        <View style={styles.emptyState}>
          <Ionicons name="hardware-chip-outline" size={64} color={Colors.surfaceTranslucent} />
          <Text style={styles.emptyTitle}>Device not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOn = device.status === 'on';
  const isOffline = device.status === 'offline';
  const isCurtain = device.category === 'curtain';
  const isFan = device.category === 'fan';

  const defaultRated = isFan ? 75 : device.category === 'light' ? 60 : 40;
  const currentRated = device.ratedPower || defaultRated;
  const [editingLoad, setEditingLoad] = useState(false);
  const [inputWatts, setInputWatts] = useState(String(currentRated));
  const [savingWatts, setSavingWatts] = useState(false);

  useEffect(() => {
    setInputWatts(String(currentRated));
  }, [currentRated]);

  const getPresets = () => {
    if (device.category === 'light') {
      return [
        { label: '15W LED', watts: 15 },
        { label: '28W Tube', watts: 28 },
        { label: '40W Panel', watts: 40 },
        { label: '60W Std', watts: 60 },
        { label: '100W High', watts: 100 },
      ];
    }
    if (device.category === 'fan') {
      return [
        { label: '28W BLDC', watts: 28 },
        { label: '45W Eco', watts: 45 },
        { label: '60W Med', watts: 60 },
        { label: '75W Std', watts: 75 },
      ];
    }
    if (device.category === 'curtain') {
      return [
        { label: '3W Idle', watts: 3 },
        { label: '5W Servo', watts: 5 },
        { label: '15W Motor', watts: 15 },
      ];
    }
    return [
      { label: '20W', watts: 20 },
      { label: '40W', watts: 40 },
      { label: '75W', watts: 75 },
      { label: '150W', watts: 150 },
    ];
  };

  const handleSaveWatts = async (val?: number) => {
    const targetWatts = val !== undefined ? val : parseInt(inputWatts, 10);
    if (isNaN(targetWatts) || targetWatts < 0 || targetWatts > 5000) return;
    setSavingWatts(true);
    await updateDeviceRatedPower(classroom.id, device.id, targetWatts);
    setSavingWatts(false);
    setInputWatts(String(targetWatts));
    setEditingLoad(false);
  };

  const getIcon = () => {
    switch (device.category) {
      case 'light': return 'bulb';
      case 'fan': return 'hardware-chip';
      case 'curtain': return 'apps';
      default: return 'power';
    }
  };

  const getHardwarePin = () => {
    if (classroom.id.includes('101') || classroom.id === 'cls-a101') {
      if (device.category === 'light') return 'GPIO 25 (Relay 1)';
      if (device.category === 'fan') return 'GPIO 27 (Relay 2)';
      if (device.category === 'curtain') return 'GPIO 18 (Servo 1)';
    }
    if (classroom.id.includes('102') || classroom.id === 'cls-a102') {
      if (device.category === 'light') return 'GPIO 26 (Relay 3)';
      if (device.category === 'fan') return 'GPIO 14 (Relay 4)';
      if (device.category === 'curtain') return 'GPIO 19 (Servo 2)';
    }
    if (classroom.id.includes('corr') || classroom.id === 'cls-corridor') {
      if (device.id.includes('2')) return 'GPIO 17 (Relay 6)';
      return 'GPIO 16 (Relay 5)';
    }
    return `Relay Channel #${device.relayChannel}`;
  };

  const getStatusLabel = () => {
    if (isOffline) return 'OFFLINE';
    if (isCurtain) return isOn ? 'OPEN (90°)' : 'CLOSED (0°)';
    if (isFan) return isOn ? 'RUNNING' : 'STOPPED';
    return isOn ? 'POWERED ON' : 'TURNED OFF';
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={device.name} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Power / Position Card */}
        <View style={[styles.powerCard, isOn && styles.powerCardActive]}>
          <View style={styles.powerCardHeader}>
            <View style={[styles.deviceIconLarge, isOn && styles.deviceIconLargeActive]}>
              <Ionicons name={getIcon() as any} size={32} color={isOn ? Colors.primary : Colors.text} />
            </View>
            <View style={styles.powerInfo}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceLocation}>{classroom.name} • {device.roomArea}</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.dot, { backgroundColor: isOffline ? Colors.critical : isOn ? Colors.success : Colors.textMuted }]} />
                <Text style={[styles.statusText, { color: isOffline ? Colors.critical : isOn ? Colors.success : Colors.textMuted }]}>
                  {getStatusLabel()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.powerToggleRow}>
            <Text style={styles.powerLabel}>
              {isCurtain ? (isOn ? 'OPEN' : 'CLOSED') : (isOn ? 'ACTIVE' : 'INACTIVE')}
            </Text>
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
            <Text style={styles.statLabel}>Current Draw</Text>
            <Text style={[styles.statValue, { color: isOn ? Colors.primary : Colors.text }]}>
              {device.powerUsage || 0}W
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rated Load</Text>
            <Text style={styles.statValue}>{currentRated}W</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>
              {device.energyToday < 1 ? device.energyToday.toFixed(3) : device.energyToday.toFixed(2)} kWh
            </Text>
          </View>
        </View>

        {/* User-Customizable Rated Power Specification */}
        <View style={styles.loadCard}>
          <View style={styles.loadHeader}>
            <View style={styles.loadTitleRow}>
              <View style={styles.loadIconBox}>
                <Ionicons name="flash-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.loadTextContainer}>
                <Text style={styles.loadCardTitle} numberOfLines={1}>Rated Power Specification</Text>
                <Text style={styles.loadCardSubtitle} numberOfLines={2}>
                  Custom appliance rating used for energy calculations
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.editLoadBtn}
              onPress={() => {
                setInputWatts(String(currentRated));
                setEditingLoad(!editingLoad);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={editingLoad ? "close-outline" : "create-outline"} size={16} color={Colors.primary} />
              <Text style={styles.editLoadBtnText}>{editingLoad ? "Cancel" : "Edit Rating"}</Text>
            </TouchableOpacity>
          </View>

          {/* Current rating display */}
          <View style={styles.loadValueRow}>
            <Text style={styles.loadValueLabel}>Nameplate Rating:</Text>
            <Text style={styles.loadValueText}>{currentRated} <Text style={{ fontSize: 13, color: Colors.textMuted }}>Watts</Text></Text>
          </View>

          {/* Interactive Edit / Preset Section */}
          {editingLoad && (
            <View style={styles.loadEditContainer}>
              <Text style={styles.loadEditLabel}>Quick Presets:</Text>
              <View style={styles.presetsRow}>
                {getPresets().map(p => (
                  <TouchableOpacity
                    key={p.watts}
                    style={[styles.presetChip, currentRated === p.watts && styles.presetChipActive]}
                    onPress={() => handleSaveWatts(p.watts)}
                    disabled={savingWatts}
                  >
                    <Text style={[styles.presetChipText, currentRated === p.watts && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.loadEditLabel, { marginTop: 14 }]}>Custom Wattage (Watts):</Text>
              <View style={styles.customInputRow}>
                <TouchableOpacity 
                  style={styles.stepBtn}
                  onPress={() => {
                    const current = parseInt(inputWatts, 10) || currentRated;
                    const next = Math.max(1, current - 5);
                    setInputWatts(String(next));
                  }}
                >
                  <Ionicons name="remove" size={18} color={Colors.text} />
                </TouchableOpacity>

                <TextInput
                  style={styles.loadInput}
                  value={inputWatts}
                  onChangeText={setInputWatts}
                  keyboardType="numeric"
                  placeholder="e.g. 45"
                  placeholderTextColor={Colors.textMuted}
                />

                <TouchableOpacity 
                  style={styles.stepBtn}
                  onPress={() => {
                    const current = parseInt(inputWatts, 10) || currentRated;
                    const next = current + 5;
                    setInputWatts(String(next));
                  }}
                >
                  <Ionicons name="add" size={18} color={Colors.text} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.saveWattsBtn}
                  onPress={() => handleSaveWatts()}
                  disabled={savingWatts}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveWattsBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Quick Action Control Buttons */}
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Physical Action</Text>
          <Text style={styles.actionSubtitle}>Sends immediate command to ESP32 controller</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, isOn && styles.actionButtonActive]}
              onPress={() => {
                if (!isOn) toggleDevice(classroom.id, device.id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name={isCurtain ? 'scan-outline' : 'power'} size={18} color={isOn ? '#000' : Colors.text} />
              <Text style={[styles.actionButtonText, isOn && styles.actionButtonTextActive]}>
                {isCurtain ? 'Open Curtain' : 'Turn On'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, !isOn && styles.actionButtonActive]}
              onPress={() => {
                if (isOn) toggleDevice(classroom.id, device.id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name={isCurtain ? 'close-circle-outline' : 'power-outline'} size={18} color={!isOn ? '#000' : Colors.text} />
              <Text style={[styles.actionButtonText, !isOn && styles.actionButtonTextActive]}>
                {isCurtain ? 'Close Curtain' : 'Turn Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hardware & Controller Specs */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ESP32 Hardware Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{isCurtain ? 'Motorized Curtain' : isFan ? 'Ceiling Fan' : 'Room Lighting'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned Pin</Text>
            <Text style={styles.infoValue}>{getHardwarePin()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Microcontroller</Text>
            <Text style={styles.infoValue}>ESP32-WROOM-32</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Controller IP</Text>
            <Text style={styles.infoValue}>{esp32Ip}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hardware Link</Text>
            <Text style={[styles.infoValue, { color: esp32Connected ? Colors.success : Colors.warning }]}>
              {esp32Connected ? 'Connected (Live)' : 'Standby / Simulated'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
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
    paddingTop: 100,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.primary,
  },
  backBtnText: {
    color: '#000',
    fontWeight: '700',
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
    fontSize: 13,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    fontSize: 11,
  },
  statValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actionCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 16,
  },
  actionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceTranslucent,
    gap: 8,
  },
  actionButtonActive: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  infoTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
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
    fontSize: 13,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  loadCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 168, 58, 0.25)',
    marginBottom: 20,
  },
  loadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
    gap: 10,
  },
  loadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  loadTextContainer: {
    flex: 1,
    paddingRight: 6,
  },
  loadIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 168, 58, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadCardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loadCardSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  editLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(253, 168, 58, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Layout.radius.sm,
    gap: 4,
    flexShrink: 0,
  },
  editLoadBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  loadValueLabel: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  loadValueText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  loadEditContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceTranslucent,
  },
  loadEditLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceTranslucent,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: 'rgba(253, 168, 58, 0.2)',
    borderColor: Colors.primary,
  },
  presetChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: Colors.primary,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  loadInput: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: Layout.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: Colors.text,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  saveWattsBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: Layout.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveWattsBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
});
