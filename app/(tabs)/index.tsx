import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { HomeHeader } from '../../components/HomeHeader';
import { EnergyOverviewCard } from '../../components/EnergyOverviewCard';
import { QuickControls } from '../../components/QuickControls';
import { ClassroomCard } from '../../components/ClassroomCard';
import { AlertCard } from '../../components/AlertCard';
import { FAB } from '../../components/FAB';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function HomeScreen() {
  const { classrooms, alerts } = useApp();
  const router = useRouter();
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Active alerts (unread)
  const activeAlerts = alerts.filter(a => !a.isRead).slice(0, 3);
  
  // Sort classrooms by highest current load
  const sortedClassrooms = [...classrooms].sort((a, b) => b.currentLoad - a.currentLoad).slice(0, 3);

  return (
    <View style={styles.container}>
      <HomeHeader />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <EnergyOverviewCard />
        
        <QuickControls />
        
        {activeAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Alerts</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeAlerts.length}</Text>
              </View>
            </View>
            {activeAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>High Usage Classrooms</Text>
            <TouchableOpacity onPress={() => router.push('/classrooms')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {sortedClassrooms.map(cls => (
            <ClassroomCard key={cls.id} classroom={cls} />
          ))}
        </View>

        {/* Bottom padding to prevent content from hiding behind the floating nav */}
        <View style={{ height: 120 }} />
      </ScrollView>

      <FAB onPress={() => setShowAddMenu(true)} />

      {/* Add Menu Modal / Bottom Sheet */}
      <Modal
        visible={showAddMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAddMenu(false)}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/add-classroom');
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(253, 168, 58, 0.15)' }]}>
                <Ionicons name="business" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Add Classroom</Text>
                <Text style={styles.menuSubtitle}>Register a new ESP32 controller</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/add-device');
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                <Ionicons name="hardware-chip" size={24} color={Colors.success} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Add Device</Text>
                <Text style={styles.menuSubtitle}>Connect appliance to existing classroom</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 16,
  },
  section: {
    paddingHorizontal: Layout.spacing.md,
    marginBottom: 24,
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
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.critical,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  seeAll: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  menuContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Layout.radius.xl,
    borderTopRightRadius: Layout.radius.xl,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceTranslucent,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceTranslucent,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
