import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export function QuickControls() {
  const { quickControls, toggleQuickControl, emergencyOff } = useApp();

  const handleEmergencyOff = () => {
    RNAlert.alert(
      "Emergency Off",
      "Are you sure you want to turn off all devices across all classrooms?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Turn Off All", style: "destructive", onPress: emergencyOff }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Controls</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allLights && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allLights')}
        >
          <Ionicons 
            name={quickControls.allLights ? "bulb" : "bulb-outline"} 
            size={20} 
            color={quickControls.allLights ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allLights && styles.controlTextActive]}>
            All Lights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allFans && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allFans')}
        >
          <Ionicons 
            name="hardware-chip-outline" 
            size={20} 
            color={quickControls.allFans ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allFans && styles.controlTextActive]}>
            All Fans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, quickControls.allACs && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('allACs')}
        >
          <Ionicons 
            name="snow-outline" 
            size={20} 
            color={quickControls.allACs ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.allACs && styles.controlTextActive]}>
            All ACs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, quickControls.projectors && styles.controlButtonActive]}
          onPress={() => toggleQuickControl('projectors')}
        >
          <Ionicons 
            name="videocam-outline" 
            size={20} 
            color={quickControls.projectors ? '#000' : Colors.text} 
          />
          <Text style={[styles.controlText, quickControls.projectors && styles.controlTextActive]}>
            Projectors
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.emergencyButton]}
          onPress={handleEmergencyOff}
        >
          <Ionicons name="power" size={20} color={Colors.critical} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Layout.radius.round,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 8,
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});
