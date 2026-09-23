import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export function Esp32LiveBar() {
  const { 
    esp32Ip, 
    setEsp32Ip, 
    esp32Connected, 
    esp32Telemetry, 
    systemMode,
    toggleEsp32Mode,
    syncWithEsp32, 
    openEsp32WebConsole,
    showToast,
    classrooms,
  } = useApp();

  const [modalVisible, setModalVisible] = useState(false);
  const [inputIp, setInputIp] = useState(esp32Ip);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    const ok = await syncWithEsp32();
    setSyncing(false);
    if (ok) {
      showToast('Synced with ESP32 successfully', 'success');
    } else {
      showToast(`ESP32 at ${esp32Ip} not responding`, 'error');
    }
  };

  const handleSaveIp = async () => {
    if (!inputIp || inputIp.trim() === '') return;
    setTesting(true);
    await setEsp32Ip(inputIp.trim());
    const ok = await syncWithEsp32();
    setTesting(false);
    setModalVisible(false);
    if (ok) {
      showToast('Connected to ESP32!', 'success');
    } else {
      showToast('Saved IP, but controller is not responding', 'info');
    }
  };

  const cloudLoadWatts = classrooms.reduce((acc, c) => acc + (c.currentLoad || 0), 0);
  const cloudTemp = classrooms[0]?.temperature ?? 24.0;
  const cloudActiveDevices = classrooms.reduce((acc, c) => acc + c.devices.filter(d => d.status === 'on').length, 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, esp32Connected ? styles.iconConnected : styles.iconOffline]}>
            <Ionicons name="hardware-chip" size={18} color={esp32Connected ? Colors.success : Colors.textMuted} />
          </View>
          <View>
            <Text style={styles.title}>ESP32 Dual-Classroom Controller</Text>
            <Text style={styles.subtitle}>
              IP: {esp32Ip || 'Auto-Detected'} • Cloud Synced
            </Text>
          </View>
        </View>

        <View style={[styles.badge, esp32Connected ? styles.badgeConnected : styles.badgeOffline]}>
          <View style={[styles.dot, { backgroundColor: esp32Connected ? Colors.success : Colors.critical }]} />
          <Text style={[styles.badgeText, { color: esp32Connected ? Colors.success : Colors.textMuted }]}>
            {esp32Connected ? (esp32Telemetry ? 'LAN LIVE' : 'CLOUD LIVE') : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Live Telemetry preview when connected (LAN or Cloud) */}
      {esp32Connected && (
        <View style={styles.metricsRow}>
          <TouchableOpacity 
            style={styles.metricItem} 
            onPress={toggleEsp32Mode}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.metricLabel}>Mode</Text>
              <Ionicons 
                name={systemMode === 'auto' ? "sparkles" : "hand-left"} 
                size={11} 
                color={systemMode === 'auto' ? Colors.success : Colors.primary} 
              />
            </View>
            <Text style={[styles.metricValue, { color: systemMode === 'auto' ? Colors.success : Colors.primary }]}>
              {systemMode.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Temp</Text>
            <Text style={styles.metricValue}>{(esp32Telemetry ? esp32Telemetry.temperature : cloudTemp).toFixed(1)}°C</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{esp32Telemetry ? 'Humidity' : 'Active Devs'}</Text>
            <Text style={styles.metricValue}>{esp32Telemetry ? `${Math.round(esp32Telemetry.humidity)}%` : `${cloudActiveDevices} ON`}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Active Load</Text>
            <Text style={styles.metricValue}>{Math.round(esp32Telemetry ? esp32Telemetry.totalLoadWatts : cloudLoadWatts)} W</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionBtnPrimary}
          onPress={openEsp32WebConsole}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={16} color="#000" />
          <Text style={styles.actionBtnPrimaryText}>Launch Web App</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionBtnSecondary}
          onPress={handleManualSync}
          disabled={syncing}
          activeOpacity={0.8}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="refresh" size={16} color={Colors.primary} />
          )}
          <Text style={styles.actionBtnSecondaryText}>Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionBtnIcon}
          onPress={() => {
            setInputIp(esp32Ip);
            setModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* IP Configuration Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ESP32 Controller IP</Text>
            <Text style={styles.modalSubtitle}>
              Enter the IP address of your ESP32 board (displayed on the OLED screen or router DHCP):
            </Text>

            <TextInput
              style={styles.input}
              value={inputIp}
              onChangeText={setInputIp}
              placeholder="e.g. 192.168.1.101"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalSaveBtn}
                onPress={handleSaveIp}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSaveText}>Connect & Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  iconOffline: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  badgeConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: Layout.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.md,
    gap: 6,
  },
  actionBtnPrimaryText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 168, 58, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253, 168, 58, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Layout.radius.md,
    gap: 6,
  },
  actionBtnSecondaryText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.surfaceTranslucent,
    borderRadius: Layout.radius.md,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
