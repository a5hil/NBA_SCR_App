import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { EnergyReading } from '../../types';

type Period = 'hourly' | 'daily' | 'weekly';
const screenWidth = Dimensions.get('window').width;

function BarChart({ data, period }: { data: EnergyReading[]; period: Period }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = period === 'hourly' ? 8 : period === 'daily' ? 28 : 40;
  const chartHeight = 160;

  return (
    <View style={chartStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chartStyles.scrollContent}>
        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * chartHeight;
          return (
            <View key={i} style={[chartStyles.barContainer, { width: barWidth + 8 }]}>
              <Text style={chartStyles.valueText}>
                {d.value < 10 ? d.value.toFixed(1) : Math.round(d.value)}
              </Text>
              <View style={[chartStyles.bar, { height: Math.max(barHeight, 4), width: barWidth }]} />
              <Text style={chartStyles.labelText} numberOfLines={1}>
                {d.time}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  scrollContent: {
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 24,
    minHeight: 220,
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  valueText: {
    color: Colors.textMuted,
    fontSize: 9,
    marginBottom: 4,
  },
  bar: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    minWidth: 4,
  },
  labelText: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    width: '100%',
    textAlign: 'center',
  },
});

export default function EnergyScreen() {
  const { energyData, classrooms } = useApp();
  const [period, setPeriod] = useState<Period>('daily');

  const data = energyData[period];
  const totalToday = classrooms.reduce((sum, c) => sum + c.energyToday, 0);
  const totalCost = classrooms.reduce((sum, c) => sum + c.estimatedCost, 0);
  const currentLoad = classrooms.reduce((sum, c) => sum + c.currentLoad, 0);

  // Rankings by energy consumption
  const rankedClassrooms = [...classrooms].sort((a, b) => b.energyToday - a.energyToday);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Energy" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Overview Cards */}
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, { backgroundColor: Colors.primary }]}>
            <Ionicons name="flash" size={24} color="#000" />
            <Text style={styles.overviewValue}>{totalToday.toFixed(1)}</Text>
            <Text style={styles.overviewLabel}>kWh Today</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="cash-outline" size={24} color={Colors.success} />
            <Text style={[styles.overviewValue, { color: Colors.text }]}>₹{totalCost.toFixed(0)}</Text>
            <Text style={[styles.overviewLabel, { color: Colors.textMuted }]}>Est. Cost</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="power" size={24} color={Colors.primary} />
            <Text style={[styles.overviewValue, { color: Colors.text }]}>{(currentLoad / 1000).toFixed(1)}</Text>
            <Text style={[styles.overviewLabel, { color: Colors.textMuted }]}>kW Now</Text>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Consumption</Text>
            <View style={styles.periodSelector}>
              {(['hourly', 'daily', 'weekly'] as Period[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodChip, period === p && styles.periodChipActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <BarChart data={data} period={period} />
        </View>

        {/* Rankings */}
        <View style={styles.rankingsSection}>
          <Text style={styles.sectionTitle}>Classroom Rankings</Text>
          <Text style={styles.sectionSubtitle}>Sorted by today's consumption</Text>
          
          {rankedClassrooms.map((cls, index) => (
            <View key={cls.id} style={styles.rankRow}>
              <View style={styles.rankLeft}>
                <View style={[
                  styles.rankBadge, 
                  index === 0 && { backgroundColor: 'rgba(253, 168, 58, 0.15)' },
                  index === 1 && { backgroundColor: 'rgba(192, 192, 192, 0.15)' },
                  index === 2 && { backgroundColor: 'rgba(205, 127, 50, 0.15)' },
                ]}>
                  <Text style={[
                    styles.rankNumber,
                    index === 0 && { color: Colors.primary },
                  ]}>#{index + 1}</Text>
                </View>
                <View>
                  <Text style={styles.rankName}>{cls.name}</Text>
                  <Text style={styles.rankSub}>{cls.devices.filter(d => d.status === 'on').length} devices active</Text>
                </View>
              </View>
              <View style={styles.rankRight}>
                <Text style={styles.rankEnergy}>{cls.energyToday.toFixed(1)} kWh</Text>
                <Text style={styles.rankCost}>₹{cls.estimatedCost.toFixed(0)}</Text>
              </View>
            </View>
          ))}
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
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  overviewValue: {
    color: '#000',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  overviewLabel: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.round,
  },
  periodChipActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#000',
  },
  rankingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: Layout.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rankName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  rankSub: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankEnergy: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  rankCost: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
