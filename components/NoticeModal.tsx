import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';
import { NoticeDuration } from '../types';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

interface NoticeModalProps {
  visible: boolean;
  onClose: () => void;
  defaultClassroomId?: string; // 'all' or 'cls-a101', etc.
  defaultClassroomName?: string;
}

export function NoticeModal({
  visible,
  onClose,
  defaultClassroomId = 'all',
  defaultClassroomName,
}: NoticeModalProps) {
  const { addNotice, classrooms } = useApp();

  const [targetId, setTargetId] = useState<string>(defaultClassroomId);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<NoticeDuration>('24h');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      // Disallow preselecting a corridor or hallway
      const isCorridorTarget = Boolean(
        defaultClassroomId &&
        (defaultClassroomId.toLowerCase().includes('corridor') ||
         defaultClassroomId.toLowerCase().includes('hallway'))
      );
      setTargetId(isCorridorTarget ? 'all' : defaultClassroomId);
      setTitle('');
      setMessage('');
      setDuration('24h');
      setSubmitting(false);
    }
  }, [visible, defaultClassroomId]);

  // Real classrooms only - explicitly exclude corridors, hallways, and non-classroom areas
  const targetOptions = [
    { id: 'all', label: 'All Classrooms (Broadcast)' },
    ...classrooms
      .filter((c) => {
        const id = c.id.toLowerCase();
        const name = c.name.toLowerCase();
        return !id.includes('corridor') && !id.includes('hallway') &&
               !name.includes('corridor') && !name.includes('hallway') &&
               c.capacity > 0;
      })
      .map((c) => ({ id: c.id, label: c.name })),
  ];

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) return;

    setSubmitting(true);
    const selectedTarget = targetOptions.find((t) => t.id === targetId);
    const targetName = selectedTarget
      ? selectedTarget.label
      : defaultClassroomName || (targetId === 'all' ? 'All Classrooms (Broadcast)' : targetId);

    await addNotice({
      classroomId: targetId,
      classroomName: targetName,
      title: title.trim(),
      message: message.trim(),
      duration,
    });

    setSubmitting(false);
    onClose();
  };

  const isFormValid = title.trim().length > 0 && message.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <Ionicons
                  name={targetId === 'all' ? 'megaphone-outline' : 'easel-outline'}
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {targetId === 'all' ? 'Broadcast Notice' : 'Classroom Notice'}
                </Text>
                <Text style={styles.modalSubtitle}>Classroom Digital Board</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Target Classroom Selection */}
            <Text style={styles.inputLabel}>Target Classroom / Scope</Text>
            <View style={styles.targetPillGroup}>
              {targetOptions.map((opt) => {
                const isSelected = targetId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.targetPill, isSelected && styles.targetPillActive]}
                    onPress={() => setTargetId(opt.id)}
                  >
                    <Ionicons
                      name={opt.id === 'all' ? 'megaphone' : 'business'}
                      size={14}
                      color={isSelected ? '#000000' : Colors.textSecondary}
                    />
                    <Text style={[styles.targetPillText, isSelected && styles.targetPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notice Title Input */}
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Notice Title</Text>
              <Text style={styles.charCount}>{title.length}/30</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Staff Meeting, Quiz Postponed..."
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, 30))}
              maxLength={30}
            />

            {/* Notice Message Input */}
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Announcement Message</Text>
              <Text style={styles.charCount}>{message.length}/140</Text>
            </View>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Type message to display on the classroom notice board..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={(m) => setMessage(m.slice(0, 140))}
              maxLength={140}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Expiration Duration Selector */}
            <Text style={styles.inputLabel}>Display Duration</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={[styles.durationPill, duration === '1h' && styles.durationPillActive]}
                onPress={() => setDuration('1h')}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={duration === '1h' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.durationPillTitle, duration === '1h' && styles.durationPillTitleActive]}>
                  1 Hour
                </Text>
                <Text style={styles.durationPillSub}>Auto-expires</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.durationPill, duration === '24h' && styles.durationPillActive]}
                onPress={() => setDuration('24h')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={duration === '24h' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.durationPillTitle, duration === '24h' && styles.durationPillTitleActive]}>
                  1 Day (24h)
                </Text>
                <Text style={styles.durationPillSub}>Daily notice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.durationPill, duration === 'never' && styles.durationPillActive]}
                onPress={() => setDuration('never')}
              >
                <Ionicons
                  name="pin-outline"
                  size={16}
                  color={duration === 'never' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.durationPillTitle, duration === 'never' && styles.durationPillTitleActive]}>
                  Until Deleted
                </Text>
                <Text style={styles.durationPillSub}>Persistent</Text>
              </TouchableOpacity>
            </View>

            {/* Classroom Screen Live Preview */}
            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Classroom Screen Live Preview</Text>
            <View style={styles.oledPreviewBox}>
              <View style={styles.oledBezel}>
                <View style={styles.oledHeaderRow}>
                  <Text style={styles.oledHeaderText}>[1/1] NOTICE</Text>
                </View>
                <View style={styles.oledDivider} />
                <Text style={styles.oledTitle} numberOfLines={1}>
                  &gt; {title || 'Notice Title Preview'}
                </Text>
                <Text style={styles.oledBody} numberOfLines={4}>
                  {message || 'Your announcement message will render word-wrapped with smooth vertical scrolling.'}
                </Text>
              </View>
              <Text style={styles.oledFootnote}>
                20-second rotation cycle • Auto-scrolls and repeats for longer messages
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishButton, (!isFormValid || submitting) && styles.publishButtonDisabled]}
              onPress={handlePublish}
              disabled={!isFormValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.publishButtonText}>Publish Announcement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(253, 168, 58, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  targetPillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  targetPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  targetPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  targetPillTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
  multilineInput: {
    height: 80,
    paddingTop: 12,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  durationPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  durationPillActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 168, 58, 0.12)',
  },
  durationPillTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  durationPillTitleActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  durationPillSub: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  oledPreviewBox: {
    backgroundColor: '#050705',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(73, 199, 121, 0.25)',
  },
  oledBezel: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 10,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  oledHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oledHeaderText: {
    color: '#38EF7D',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  oledHeaderRight: {
    color: '#FDA83A',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  oledDivider: {
    height: 1,
    backgroundColor: '#38EF7D',
    marginVertical: 4,
    opacity: 0.6,
  },
  oledTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  oledBody: {
    color: '#D4E2D4',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  oledFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingTop: 4,
  },
  oledFooterText: {
    color: '#888888',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  oledProgressBar: {
    width: 34,
    height: 6,
    borderWidth: 1,
    borderColor: '#38EF7D',
    borderRadius: 2,
    padding: 1,
  },
  oledProgressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: '#38EF7D',
  },
  oledFootnote: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  publishButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  publishButtonDisabled: {
    opacity: 0.45,
  },
  publishButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
