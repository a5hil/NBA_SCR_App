import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { Esp32LiveBar } from '../../components/Esp32LiveBar';

export default function SettingsScreen() {
  const { user, campus, classrooms, resetData, esp32Ip, esp32Connected, esp32Telemetry } = useApp();

  const totalDevices = classrooms.reduce((sum, c) => sum + c.devices.length, 0);

  const handleReset = () => {
    RNAlert.alert(
      'Reset Data',
      'This will reset classroom devices and cache to default state. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetData },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings & Hardware" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileRole}>{user.role}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>
        </View>

        {/* ESP32 Live Controller Management */}
        <Esp32LiveBar />

        {/* Hardware & Network Specs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hardware Specification</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="hardware-chip" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>Microcontroller</Text>
              <Text style={styles.infoValue}>ESP32-WROOM-32</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="wifi" size={18} color={esp32Connected ? Colors.success : Colors.textMuted} />
              <Text style={styles.infoLabel}>Wi-Fi Network</Text>
              <Text style={styles.infoValue}>IDEA LAB</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>mDNS URL</Text>
              <Text style={styles.infoValue}>esp32-classroom.local</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="git-branch" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>Firmware</Text>
              <Text style={styles.infoValue}>v{esp32Telemetry?.firmware || '2.2.0'}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="layers" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>Controlled Zones</Text>
              <Text style={styles.infoValue}>2 Rooms + Corridors ({totalDevices} dev)</Text>
            </View>
          </View>
        </View>

        {/* Campus Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campus Info</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="school" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>Institution</Text>
              <Text style={styles.infoValue}>{campus.name}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="business" size={18} color={Colors.primary} />
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{campus.department}</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-circle-outline" size={20} color={Colors.critical} />
            <Text style={styles.resetButtonText}>Reset Demo Data</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 20,
    gap: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  profileRole: {
    color: Colors.primary,
    fontSize: 13,
    marginTop: 2,
  },
  profileEmail: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
    gap: 12,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: Layout.radius.md,
    padding: 14,
    gap: 8,
  },
  resetButtonText: {
    color: Colors.critical,
    fontSize: 14,
    fontWeight: '700',
  },
});
