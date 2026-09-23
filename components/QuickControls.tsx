import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export function QuickControls() {
  const { 
    quickControls, 
    toggleQuickControl, 
    emergencyOff, 
    systemMode, 
    toggleEsp32Mode 
  } = useApp();

  const handleEmergencyOff = () => {
    RNAlert.alert(
      "Emergency Off",
      "Are you sure you want to turn off all devices and close curtains across both classrooms?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Turn Off All", style: "destructive", onPress: emergencyOff }
      ]
    );
  };

  const isAuto = systemMode === 'auto';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Hardware Controls</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Auto / Manual Mode Toggle */}
        <TouchableOpacity 
          style={[styles.controlButton, isAuto ? styles.modeButtonAuto : styles.modeButtonManual]}
          onPress={toggleEsp32Mode}
        >
          <Ionicons 
            name={isAuto ? "sparkles" : "hand-left"} 
            size={18} 
            color={isAuto ? Colors.success : Colors.primary} 
          />
          <Text style={[styles.controlText, { color: isAuto ? Colors.success : Colors.primary }]}>
            {isAuto ? 'Auto Mode' : 'Manual Mode'}
          </Text>
        </TouchableOpacity>

        {/* All Lights */}
        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allLights && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allLights')}
        >
          <Ionicons 
            name={quickControls.allLights ? "bulb" : "bulb-outline"} 
            size={18} 
            color={quickControls.allLights ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allLights && styles.controlTextActive]}>
            All Lights
          </Text>
        </TouchableOpacity>

        {/* All Fans */}
        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allFans && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allFans')}
        >
          <Ionicons 
            name="hardware-chip-outline" 
            size={18} 
            color={quickControls.allFans ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allFans && styles.controlTextActive]}>
            All Fans
          </Text>
        </TouchableOpacity>

        {/* All Curtains */}
        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allCurtains && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allCurtains')}
        >
          <Ionicons 
            name="apps-outline" 
            size={18} 
            color={quickControls.allCurtains ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allCurtains && styles.controlTextActive]}>
            All Curtains
          </Text>
        </TouchableOpacity>

        {/* Emergency All Off */}
        <TouchableOpacity 
          style={[styles.controlButton, styles.emergencyButton]}
          onPress={handleEmergencyOff}
        >
          <Ionicons name="power" size={18} color={Colors.critical} />
          <Text style={[styles.controlText, { color: Colors.critical }]}>Emergency Off</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: Layout.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Layout.radius.round,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 8,
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeButtonAuto: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  modeButtonManual: {
    backgroundColor: 'rgba(253, 168, 58, 0.1)',
    borderColor: 'rgba(253, 168, 58, 0.3)',
  },
  controlText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  controlTextActive: {
    color: '#000',
  },
  emergencyButton: {
    borderColor: 'rgba(255, 98, 95, 0.3)',
    backgroundColor: 'rgba(255, 98, 95, 0.1)',
  },
});
