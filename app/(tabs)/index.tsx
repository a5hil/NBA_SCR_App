import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { HomeHeader } from '../../components/HomeHeader';
import { EnergyOverviewCard } from '../../components/EnergyOverviewCard';
import { QuickControls } from '../../components/QuickControls';
import { Esp32LiveBar } from '../../components/Esp32LiveBar';
import { ClassroomCard } from '../../components/ClassroomCard';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { classrooms } = useApp();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <HomeHeader />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <EnergyOverviewCard />
        
        <Esp32LiveBar />
        
        <QuickControls />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Classrooms & Zones</Text>
            <TouchableOpacity onPress={() => router.push('/classrooms')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {classrooms.map(cls => (
            <ClassroomCard key={cls.id} classroom={cls} />
          ))}
        </View>

        {/* Bottom padding for floating navigation */}
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
  seeAll: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
