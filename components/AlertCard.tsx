import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Alert } from '../types';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

interface AlertCardProps {
  alert: Alert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const { dismissAlert } = useApp();

  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'critical': return Colors.critical;
      case 'warning': return Colors.warning;
      case 'info': return Colors.primary;
      default: return Colors.textMuted;
    }
  };

  const getIcon = () => {
    switch (alert.severity) {
      case 'critical': return 'warning';
      case 'warning': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'notifications';
    }
  };

  const color = getSeverityColor();

  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={getIcon()} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          {alert.classroomName && (
            <>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.classroom}>{alert.classroomName}</Text>
            </>
          )}
        </View>
      </View>
      <TouchableOpacity 
        style={styles.dismissButton}
        onPress={() => dismissAlert(alert.id)}
      >
        <Ionicons name="close" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: Layout.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  message: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 12,
    marginHorizontal: 4,
  },
  classroom: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  dismissButton: {
    padding: 4,
  },
});
