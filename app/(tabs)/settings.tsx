import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert as RNAlert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { Config } from '../../constants/config';

export default function SettingsScreen() {
  const { user, campus, classrooms, resetData } = useApp();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deviceAlerts, setDeviceAlerts] = useState(true);
  const [energyAlerts, setEnergyAlerts] = useState(true);
  const [autoOff, setAutoOff] = useState(false);

  const totalDevices = classrooms.reduce((sum, c) => sum + c.devices.length, 0);
  const onlineControllers = classrooms.filter(c => c.status === 'online').length;

  const handleReset = () => {
    RNAlert.alert(
      'Reset Data',
      'This will reset all data to the original mock state. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetData },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
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

        {/* Campus Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campus</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="business" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Campus</Text>
              <Text style={styles.infoValue}>{campus.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="school" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{campus.department}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="grid" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Classrooms</Text>
              <Text style={styles.infoValue}>{classrooms.length}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="hardware-chip" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Total Devices</Text>
              <Text style={styles.infoValue}>{totalDevices}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="wifi" size={20} color={Colors.success} />
              <Text style={styles.infoLabel}>Controllers Online</Text>
              <Text style={styles.infoValue}>{onlineControllers}/{classrooms.length}</Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.infoCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="notifications" size={20} color={Colors.primary} />
                <Text style={styles.switchLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="alert-circle" size={20} color={Colors.warning} />
                <Text style={styles.switchLabel}>Device Alerts</Text>
              </View>
              <Switch
                value={deviceAlerts}
                onValueChange={setDeviceAlerts}
                trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="flash" size={20} color={Colors.critical} />
                <Text style={styles.switchLabel}>Energy Alerts</Text>
              </View>
              <Switch
                value={energyAlerts}
                onValueChange={setEnergyAlerts}
                trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
                thumbColor="#FFF"
              />
            </View>
            <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
              <View style={styles.switchLeft}>
                <Ionicons name="timer" size={20} color={Colors.textMuted} />
                <Text style={styles.switchLabel}>Auto-Off Vacant Rooms</Text>
              </View>
              <Switch
                value={autoOff}
                onValueChange={setAutoOff}
                trackColor={{ false: Colors.surfaceTranslucent, true: Colors.primary }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>

        {/* WhatsApp */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => {
              import('react-native').then(({ Linking }) => {
                Linking.openURL(`https://wa.me/${Config.supportWhatsAppNumber.replace(/[^0-9]/g, '')}?text=I%20need%20support%20with%20the%20Smart%20Classroom%20app.`);
              });
            }}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Report Issue via WhatsApp</Text>
              <Text style={styles.actionSubtitle}>{Config.supportWhatsAppNumber}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <TouchableOpacity style={styles.actionRow} onPress={handleReset}>
            <Ionicons name="refresh" size={24} color={Colors.critical} />
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: Colors.critical }]}>Reset Mock Data</Text>
              <Text style={styles.actionSubtitle}>Restore all data to defaults</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Smart Classroom v1.0.0</Text>
          <Text style={styles.versionText}>Expo SDK 57.0.9 • React Native 0.86</Text>
        </View>

        <View style={{ height: 120 }} />
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
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    paddingLeft: 4,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
    gap: 12,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  switchLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
