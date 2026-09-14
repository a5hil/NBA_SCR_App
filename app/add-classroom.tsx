import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert as RNAlert } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { useApp } from '../context/AppContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Classroom } from '../types';

const STEPS = ['Basics', 'Location', 'Controller', 'Capacity', 'Review'] as const;

function getMockControllerIp(classrooms: Classroom[]) {
  const usedIps = new Set(classrooms.map(classroom => classroom.controller.ipAddress));

  for (let host = 100; host <= 254; host += 1) {
    const ip = `192.168.1.${host}`;
    if (!usedIps.has(ip)) return ip;
  }

  return '192.168.1.250';
}

export default function AddClassroomScreen() {
  const { addClassroom, classrooms } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [department, setDepartment] = useState('IMCA');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [controllerIp, setControllerIp] = useState(() => getMockControllerIp(classrooms));
  const [capacity, setCapacity] = useState('');

  const isValidIp = (ip: string) => {
    const ipRegex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    return ipRegex.test(ip);
  };

  const canAdvance = () => {
    switch (step) {
      case 0: return name.trim().length > 0 && number.trim().length > 0;
      case 1: return building.trim().length > 0 && floor.trim().length > 0;
      case 2: return controllerIp.trim().length > 0 && isValidIp(controllerIp);
      case 3: return capacity.trim().length > 0 && parseInt(capacity) > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = () => {
    const newClassroom: Classroom = {
      id: `cls-new-${Date.now()}`,
      name,
      number,
      department,
      building,
      floor,
      capacity: parseInt(capacity),
      occupancy: 'vacant',
      status: 'online',
      temperature: 26,
      currentLoad: 0,
      energyToday: 0,
      estimatedCost: 0,
      controller: {
        id: `ctrl-new-${Date.now()}`,
        name: `ESP32-${number}`,
        type: 'ESP32',
        status: 'online',
        signalStrength: 'strong',
        relayChannels: 8,
        usedChannels: [],
        ipAddress: controllerIp,
        firmwareVersion: '2.1.4',
        lastSeen: new Date().toISOString(),
      },
      devices: [],
      alerts: [],
      recentActivity: [],
    };

    addClassroom(newClassroom);
    RNAlert.alert('Success', `${name} has been added!`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Classroom Details</Text>
            <Text style={styles.stepSubtitle}>Enter the basic information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Classroom Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lecture Hall 3"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. A301"
                placeholderTextColor={Colors.textMuted}
                value={number}
                onChangeText={setNumber}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. IMCA"
                placeholderTextColor={Colors.textMuted}
                value={department}
                onChangeText={setDepartment}
              />
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Location</Text>
            <Text style={styles.stepSubtitle}>Where is this classroom?</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Building</Text>
              <View style={styles.chipRow}>
                {['Block A', 'Block B', 'Main Building'].map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.chip, building === b && styles.chipActive]}
                    onPress={() => setBuilding(b)}
                  >
                    <Text style={[styles.chipText, building === b && styles.chipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Floor</Text>
              <View style={styles.chipRow}>
                {['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, floor === f && styles.chipActive]}
                    onPress={() => setFloor(f)}
                  >
                    <Text style={[styles.chipText, floor === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Controller Setup</Text>
            <Text style={styles.stepSubtitle}>ESP32 controller configuration</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mock ESP32 IP Address</Text>
              <TextInput
                style={[styles.input, controllerIp.length > 0 && !isValidIp(controllerIp) && { borderColor: Colors.critical }]}
                placeholder="e.g. 192.168.1.100"
                placeholderTextColor={Colors.textMuted}
                value={controllerIp}
                onChangeText={setControllerIp}
                keyboardType="numeric"
              />
              {controllerIp.length > 0 && !isValidIp(controllerIp) && (
                <Text style={[styles.hintText, { color: Colors.critical, marginTop: 8 }]}>
                  Please enter a valid IPv4 address.
                </Text>
              )}
            </View>
            <View style={styles.hintCard}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.hintText}>
                Make sure the ESP32 controller is powered on and connected to the same network.
              </Text>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Capacity</Text>
            <Text style={styles.stepSubtitle}>Seating capacity of the room</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Maximum Occupancy</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 60"
                placeholderTextColor={Colors.textMuted}
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="number-pad"
              />
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review</Text>
            <Text style={styles.stepSubtitle}>Confirm classroom details</Text>
            <View style={styles.reviewCard}>
              <ReviewRow label="Name" value={name} />
              <ReviewRow label="Number" value={number} />
              <ReviewRow label="Department" value={department} />
              <ReviewRow label="Building" value={building} />
              <ReviewRow label="Floor" value={floor} />
              <ReviewRow label="Controller IP" value={controllerIp} />
              <ReviewRow label="Capacity" value={capacity} isLast />
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Add Classroom" showBack />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              i <= step && styles.progressDotActive,
              i < step && styles.progressDotDone,
            ]}>
              {i < step ? (
                <Ionicons name="checkmark" size={12} color="#000" />
              ) : (
                <Text style={[styles.progressNum, i <= step && styles.progressNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.progressLabel, i <= step && styles.progressLabelActive]}>{s}</Text>
            {i < STEPS.length - 1 && <View style={[styles.progressLine, i < step && styles.progressLineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.buttonRow}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !canAdvance() && styles.nextButtonDisabled]}
          disabled={!canAdvance()}
          onPress={() => {
            if (step < STEPS.length - 1) setStep(step + 1);
            else handleSubmit();
          }}
        >
          <Text style={styles.nextButtonText}>{step === STEPS.length - 1 ? 'Create Classroom' : 'Next'}</Text>
          {step < STEPS.length - 1 && <Ionicons name="chevron-forward" size={20} color="#000" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReviewRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[reviewStyles.row, !isLast && reviewStyles.rowBorder]}>
      <Text style={reviewStyles.label}>{label}</Text>
      <Text style={reviewStyles.value}>{value}</Text>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  value: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Layout.spacing.md,
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  progressDotDone: {
    backgroundColor: Colors.primary,
  },
  progressNum: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  progressNumActive: {
    color: '#000',
  },
  progressLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
    marginRight: 4,
  },
  progressLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  progressLine: {
    width: 12,
    height: 2,
    backgroundColor: Colors.surfaceTranslucent,
    marginHorizontal: 2,
  },
  progressLineActive: {
    backgroundColor: Colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  hintCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253, 168, 58, 0.08)',
    borderRadius: Layout.radius.md,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: Layout.spacing.md,
    paddingBottom: 32,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    gap: 4,
  },
  backButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.primary,
    gap: 4,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
