import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DeviceCard } from '../../components/DeviceCard';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function ClassroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { classrooms, toggleDevice, openEsp32WebConsole, esp32Connected, esp32Ip } = useApp();
  const router = useRouter();

  const classroom = classrooms.find(c => c.id === id);

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

  const isOffline = classroom.status === 'offline';
  const isOccupied = classroom.occupancy === 'occupied';
  const activeCount = classroom.devices.filter(d => d.status === 'on').length;
  const isEsp32Controlled = classroom.id.includes('101') || classroom.id.includes('102');

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
              <Text style={styles.infoValue}>{(classroom.currentLoad / 1000).toFixed(2)} kW</Text>
            </View>
          </View>
        </View>

        {/* ESP32 Hardware Console Quick Launcher */}
        {isEsp32Controlled && (
          <TouchableOpacity 
            style={styles.hardwareBanner}
            onPress={openEsp32WebConsole}
            activeOpacity={0.8}
          >
            <View style={styles.hardwareLeft}>
              <View style={[styles.hardwareDot, { backgroundColor: esp32Connected ? Colors.success : Colors.warning }]} />
              <View>
                <Text style={styles.hardwareTitle}>ESP32 Controller ({esp32Connected ? 'Live' : 'Standby'})</Text>
                <Text style={styles.hardwareSubtitle}>Tap to launch ESP32 Web App • {esp32Ip}</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
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
});
