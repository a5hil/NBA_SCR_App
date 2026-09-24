import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { FloatingBottomNav } from '../components/FloatingBottomNav';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { NotificationItem } from '../types';

function NotificationCard({ notification, onPress, onDismiss }: { notification: NotificationItem; onPress: () => void; onDismiss: () => void }) {
  const getIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (notification.type) {
      case 'device-left-on': return 'alert-circle';
      case 'device-offline': return 'cloud-offline';
      case 'high-consumption': return 'flash';
      case 'classroom-vacant': return 'log-out';
      case 'controller-reconnected': return 'wifi';
      case 'maintenance-reminder': return 'construct';
      default: return 'notifications';
    }
  };

  const getIconColor = () => {
    switch (notification.type) {
      case 'device-left-on': return Colors.warning;
      case 'device-offline': return Colors.critical;
      case 'high-consumption': return Colors.primary;
      case 'classroom-vacant': return Colors.textMuted;
      case 'controller-reconnected': return Colors.success;
      case 'maintenance-reminder': return Colors.primary;
      default: return Colors.text;
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <TouchableOpacity 
      style={[styles.notifCard, !notification.isRead && styles.notifCardUnread]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.notifIcon, { backgroundColor: `${getIconColor()}20` }]}>
        <Ionicons name={getIcon()} size={20} color={getIconColor()} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text style={[styles.notifTitle, !notification.isRead && styles.notifTitleUnread]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.notifTime}>{formatTime(notification.time)}</Text>
        </View>
        <Text style={styles.notifMessage} numberOfLines={2}>{notification.message}</Text>
        {notification.classroomName && (
          <View style={styles.notifMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.notifMetaText}>{notification.classroomName}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteNotification } = useApp();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Notifications" 
        showBack
        rightElement={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllNotificationsRead}>
              <Text style={styles.markAllRead}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {notifications.length > 0 ? (
          notifications.map(notif => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onPress={() => markNotificationRead(notif.id)}
              onDismiss={() => deleteNotification(notif.id)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.surfaceTranslucent} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FloatingBottomNav />
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
  markAllRead: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  unreadBanner: {
    backgroundColor: 'rgba(253, 168, 58, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: Layout.spacing.md,
  },
  unreadText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  notifCardUnread: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 168, 58, 0.03)',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
    marginRight: 8,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifTime: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  notifMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  dismissBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
