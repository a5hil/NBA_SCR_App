import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DeviceCard } from '../../components/DeviceCard';
import { NoticeBoardCard } from '../../components/NoticeBoardCard';
import { FloatingBottomNav } from '../../components/FloatingBottomNav';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function ClassroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { classrooms, toggleDevice, esp32Connected, esp32Ip } = useApp();
  const router = useRouter();

  const classroom = classrooms.find(
    c => c.id === id || c.id === `cls-${id}` || c.number?.toLowerCase() === id?.toLowerCase()
  );

  if (!classroom) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Not Found" showBack />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Classroom not found</Text>
        </View>
      </View>
    );
  }

  const isClassroom = Boolean(
    !classroom.id.toLowerCase().includes('corridor') &&
    !classroom.name.toLowerCase().includes('corridor') &&
    !classroom.name.toLowerCase().includes('hallway') &&
    classroom.capacity > 0
  );

  const isOffline = classroom.status === 'offline';
  const isOccupied = classroom.occupancy === 'occupied';
  const activeCount = classroom.devices.filter(d => d.status === 'on').length;
  const isEsp32Controlled = classroom.controller?.id === 'ctrl-esp32' || 
    classroom.id.includes('101') || 
    classroom.id.includes('102') || 
    classroom.id.includes('corr');

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title={classroom.name} 
        showBack 
        rightElement={
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCardsRow}>
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: isOccupied ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.1)' }]}>
              <Ionicons name="people" size={20} color={isOccupied ? Colors.success : Colors.textMuted} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Occupancy</Text>
              <Text style={styles.infoValue}>{isOccupied ? 'Occupied' : 'Vacant'}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(253, 168, 58, 0.15)' }]}>
              <Ionicons name="flash" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Current Load</Text>
              <Text style={styles.infoValue}>
                {classroom.currentLoad < 1000 ? `${classroom.currentLoad.toFixed(1)} W` : `${(classroom.currentLoad / 1000).toFixed(2)} kW`}
              </Text>
            </View>
          </View>
        </View>

        {/* ESP32 Hardware Status Banner */}
        {isEsp32Controlled && (
          <View style={styles.hardwareBanner}>
            <View style={styles.hardwareLeft}>
              <View style={[styles.hardwareDot, { backgroundColor: esp32Connected ? Colors.success : Colors.warning }]} />
              <View>
                <Text style={styles.hardwareTitle}>ESP32 Controller ({esp32Connected ? 'Live' : 'Standby'})</Text>
                <Text style={styles.hardwareSubtitle}>Controlled via App • {esp32Ip || 'Auto-Detected'}</Text>
              </View>
            </View>
            <Ionicons name="hardware-chip-outline" size={20} color={Colors.primary} />
          </View>
        )}

        {isOffline && !isEsp32Controlled && (
          <View style={styles.offlineBanner}>
            <Ionicons name="warning" size={24} color={Colors.critical} />
            <View style={styles.offlineTextContainer}>
              <Text style={styles.offlineTitle}>Controller Offline</Text>
              <Text style={styles.offlineDesc}>Last seen: {new Date(classroom.controller.lastSeen).toLocaleTimeString()}</Text>
            </View>
          </View>
        )}

        {/* Real-time ACS712 & ZMPT101B Energy Meter (Exclusive to Classroom A101) */}
        {classroom.hasPowerMeter && (
          <View style={styles.meterCard}>
            <View style={styles.meterHeader}>
              <View style={styles.meterTitleRow}>
                <View style={styles.meterIconBox}>
                  <Ionicons name="speedometer-outline" size={20} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.meterTitle}>Real-Time Energy Meter</Text>
                  <Text style={styles.meterSubtitle}>Mains Line & Classroom Load</Text>
                </View>
              </View>
              <View style={styles.meterLiveTag}>
                <View style={[styles.hardwareDot, { backgroundColor: esp32Connected ? Colors.success : Colors.textMuted }]} />
                <Text style={[styles.meterLiveText, { color: esp32Connected ? Colors.success : Colors.textMuted }]}>
                  {esp32Connected ? 'LIVE MONITOR' : 'STANDBY'}
                </Text>
              </View>
            </View>

            <View style={styles.meterStatsGrid}>
              <View style={styles.meterStatBox}>
                <Text style={styles.meterStatLabel}>AC Voltage</Text>
                <Text style={styles.meterStatValue}>
                  {classroom.voltage !== undefined ? classroom.voltage.toFixed(1) : '0.0'}
                  <Text style={styles.meterStatUnit}> V</Text>
                </Text>
                <Text style={styles.meterStatSub}>Mains RMS</Text>
              </View>

              <View style={styles.meterStatBox}>
                <Text style={styles.meterStatLabel}>AC Current</Text>
                <Text style={styles.meterStatValue}>
                  {classroom.current !== undefined ? classroom.current.toFixed(2) : '0.00'}
                  <Text style={styles.meterStatUnit}> A</Text>
                </Text>
                <Text style={styles.meterStatSub}>Load RMS</Text>
              </View>

              <View style={styles.meterStatBox}>
                <Text style={styles.meterStatLabel}>Active Load</Text>
                <Text style={[styles.meterStatValue, { color: Colors.primary }]}>
                  {classroom.currentLoad.toFixed(1)}
                  <Text style={styles.meterStatUnit}> W</Text>
                </Text>
                <Text style={styles.meterStatSub}>Real Power</Text>
              </View>
            </View>
          </View>
        )}

        {/* Classroom Digital Notice Board (Exclusively enabled for actual classrooms) */}
        {isClassroom && (
          <NoticeBoardCard
            filterClassroomId={classroom.id}
            classroomName={classroom.name}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices ({activeCount}/{classroom.devices.length} On)</Text>
        </View>

        <View style={styles.deviceGrid}>
          {classroom.devices.map(device => (
            <DeviceCard 
              key={device.id} 
              device={device}
              classroomId={classroom.id}
              onToggle={() => toggleDevice(classroom.id, device.id)} 
            />
          ))}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <FloatingBottomNav activeTab="classrooms" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.background, 
  },
  iconButton: {
    padding: 8,
  },
  scrollContent: {
    padding: Layout.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
  },
  infoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 98, 95, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 98, 95, 0.3)',
    padding: 16,
    borderRadius: Layout.radius.md,
    marginBottom: 24,
    gap: 12,
  },
  hardwareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(253, 168, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(253, 168, 58, 0.3)',
    padding: 14,
    borderRadius: Layout.radius.md,
    marginBottom: 24,
  },
  hardwareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  hardwareDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hardwareTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  hardwareSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  offlineTextContainer: {
    flex: 1,
  },
  offlineTitle: {
    color: Colors.critical,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  offlineDesc: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  deviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  meterCard: {
    backgroundColor: '#1E1D1B',
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(253, 168, 58, 0.25)',
    padding: 16,
    marginBottom: 24,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  meterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meterIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 168, 58, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meterTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meterSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  meterLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  meterLiveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meterStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  meterStatBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: Layout.radius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  meterStatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  meterStatValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meterStatUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  meterStatSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    opacity: 0.7,
  },
});
