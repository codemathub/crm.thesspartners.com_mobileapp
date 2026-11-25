import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 38) : 0;
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import {
  mobileApi,
  MobileTask,
  MobileAnnouncement,
  MobileNotification,
} from '../services/api';

interface TasksScreenProps {
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({ onClose, onNavigateTab }) => {
  const [activeTab, setActiveTab] = useState<'NOTIFICATIONS' | 'TASKS' | 'ANNOUNCEMENTS'>('TASKS');
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Complete modal
  const [completingTask, setCompletingTask] = useState<MobileTask | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Detail view modal
  const [viewingTask, setViewingTask] = useState<MobileTask | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, noticesRes, notifsRes] = await Promise.all([
        mobileApi.getTasks(),
        mobileApi.getAnnouncements(),
        mobileApi.getNotifications(),
      ]);
      setTasks(tasksRes.items || []);
      setAnnouncements(noticesRes || []);
      setNotifications(notifsRes.items || []);
    } catch (err: any) {
      // In case of error, show friendly warning
      console.warn('Failed to load tasks and directives:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcknowledge = async (task: MobileTask) => {
    try {
      const updated = await mobileApi.acknowledgeTask(task.task_id);
      Alert.alert('Acknowledged', `Task #${task.task_id} marked as acknowledged. Response SLA met!`);
      setTasks((prev) => prev.map((t) => (t.task_id === task.task_id ? updated : t)));
    } catch (err: any) {
      Alert.alert('Acknowledgment Error', err.message);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completingTask) return;
    setSubmittingComplete(true);
    try {
      const updated = await mobileApi.completeTask(completingTask.task_id, completionRemarks.trim() || undefined);
      Alert.alert('Task Completed', `Directive #${completingTask.task_id} successfully marked as resolved.`);
      setTasks((prev) => prev.map((t) => (t.task_id === completingTask.task_id ? updated : t)));
      setCompletingTask(null);
      setCompletionRemarks('');
    } catch (err: any) {
      Alert.alert('Completion Error', err.message);
    } finally {
      setSubmittingComplete(false);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await mobileApi.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.warn(err);
    }
  };

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'acknowledged').length;
  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      {/* Top Header if used as modal or full screen */}
      {onClose && (
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Tasks & Notifications</Text>
          <View style={{ width: 32 }} />
        </View>
      )}

      {/* Tabs Row matching Stitch Image 8 */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'NOTIFICATIONS' && styles.tabPillActive]}
          onPress={() => setActiveTab('NOTIFICATIONS')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabPillText, activeTab === 'NOTIFICATIONS' && styles.tabPillTextActive]}>
            All Notifications
          </Text>
          <View style={[styles.tabCountBadge, activeTab === 'NOTIFICATIONS' && styles.tabCountBadgeActive]}>
            <Text style={[styles.tabCountText, activeTab === 'NOTIFICATIONS' && styles.tabCountTextActive]}>
              {notifications.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'TASKS' && styles.tabPillActive]}
          onPress={() => setActiveTab('TASKS')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabPillText, activeTab === 'TASKS' && styles.tabPillTextActive]}>
            Assigned Tasks
          </Text>
          <View style={[styles.tabCountBadge, activeTab === 'TASKS' && styles.tabCountBadgeActive]}>
            <Text style={[styles.tabCountText, activeTab === 'TASKS' && styles.tabCountTextActive]}>
              {pendingTasksCount}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'ANNOUNCEMENTS' && styles.tabPillActive]}
          onPress={() => setActiveTab('ANNOUNCEMENTS')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabPillText, activeTab === 'ANNOUNCEMENTS' && styles.tabPillTextActive]}>
            Announcements
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={themeTokens.colors.primaryDark} style={{ marginVertical: 20 }} />
        )}

        {/* 1. BRANCH NOTICE CARD matching Stitch Image 8 */}
        {announcements.length > 0 && (
          <View style={styles.branchNoticeCard}>
            <View style={styles.noticeHeaderRow}>
              <View style={styles.noticeIconBox}>
                <Ionicons name="megaphone" size={16} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.noticeKickerRow}>
                  <Text style={styles.noticeKicker}>BRANCH NOTICE</Text>
                  <Text style={styles.noticeDate}>Today • All Executives</Text>
                </View>
                <Text style={styles.noticeHeadline}>{announcements[0].title}</Text>
              </View>
            </View>
            <Text style={styles.noticeBody}>{announcements[0].body}</Text>
            <TouchableOpacity style={styles.noticeLinkRow} onPress={() => setActiveTab('ANNOUNCEMENTS')}>
              <Text style={styles.noticeLinkText}>View All Notices</Text>
              <Ionicons name="arrow-forward" size={13} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        )}

        {/* TAB CONTENT: TASKS */}
        {activeTab === 'TASKS' && (
          <View style={{ gap: 14 }}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>ASSIGNED TASKS</Text>
                <View style={styles.liveDot} />
              </View>
              <Text style={styles.slaWatchText}>Priority Tasks</Text>
            </View>

            {tasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkbox-outline" size={32} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Operational Tasks Assigned</Text>
                <Text style={styles.emptySubtitle}>You are all caught up with your assigned tasks.</Text>
              </View>
            ) : (
              tasks.map((task) => {
                const isPending = task.status === 'pending';
                const isAck = task.status === 'acknowledged';
                const isDone = task.status === 'completed';

                return (
                  <View key={task.id} style={styles.directiveCard}>
                    {/* Top Assigned info */}
                    <View style={styles.directiveTopRow}>
                      <Ionicons name="checkbox" size={16} color="#1D4ED8" />
                      <Text style={styles.assignedByText}>
                        Assigned by {task.assigned_by_name || 'Admin'}
                      </Text>
                      <Text style={styles.timestampText}>
                        {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {/* Headline */}
                    <Text style={styles.directiveTitle} numberOfLines={1}>
                      {task.title}
                    </Text>

                    {/* Status Pill & SLA Badge */}
                    <View style={styles.statusSlaRow}>
                      <View
                        style={[
                          styles.statusPill,
                          isDone && { backgroundColor: '#DEF7EC' },
                          isAck && { backgroundColor: '#E0E7FF' },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            isDone && { backgroundColor: '#059669' },
                            isAck && { backgroundColor: '#4338CA' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusPillText,
                            isDone && { color: '#03543F' },
                            isAck && { color: '#3730A3' },
                          ]}
                        >
                          {isPending
                            ? 'Pending Acknowledgement'
                            : isAck
                            ? 'Acknowledged'
                            : isDone
                            ? 'Completed'
                            : task.status}
                        </Text>
                      </View>

                      <Text style={styles.slaLabelText}>
                        Standard {task.sla_minutes}m response SLA
                      </Text>
                    </View>

                    {/* Target Client & Budget Table */}
                    {(task.target_client_name || task.monthly_budget || task.asset_preference) && (
                      <View style={styles.detailsBox}>
                        <View style={styles.detailsGrid}>
                          {task.target_client_name && (
                            <View style={styles.gridCol}>
                              <Text style={styles.gridLabel}>Target Client</Text>
                              <Text style={styles.gridValue}>{task.target_client_name}</Text>
                            </View>
                          )}
                          {task.monthly_budget && (
                            <View style={styles.gridCol}>
                              <Text style={styles.gridLabel}>Monthly Budget</Text>
                              <Text style={styles.gridValue}>{task.monthly_budget}</Text>
                            </View>
                          )}
                        </View>

                        {task.asset_preference && (
                          <View style={{ marginTop: 8 }}>
                            <Text style={styles.gridLabel}>Asset Preference</Text>
                            <Text style={styles.gridValue}>{task.asset_preference}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Lockbox Custody Tag if present */}
                    {task.lockbox_tag && (
                      <View style={styles.lockboxRow}>
                        <Ionicons name="key-outline" size={14} color="#1D4ED8" />
                        <Text style={styles.lockboxText}>Lockbox Tag #{task.lockbox_tag}</Text>
                      </View>
                    )}

                    {/* Action Buttons matching Stitch Image 8 */}
                    <View style={styles.actionButtonsCol}>
                      {isPending && (
                        <TouchableOpacity
                          style={styles.primaryActionButton}
                          onPress={() => handleAcknowledge(task)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="eye-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryActionText}>Acknowledge Task</Text>
                        </TouchableOpacity>
                      )}

                      {isAck && (
                        <TouchableOpacity
                          style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
                          onPress={() => setCompletingTask(task)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark-done" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryActionText}>Mark Task Completed</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.secondaryActionButton}
                        onPress={() => setViewingTask(task)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="information-circle-outline" size={17} color="#1D4ED8" style={{ marginRight: 6 }} />
                        <Text style={styles.secondaryActionText}>View Lead Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB CONTENT: NOTIFICATIONS */}
        {activeTab === 'NOTIFICATIONS' && (
          <View style={{ gap: 10 }}>
            {notifications.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="notifications-off-outline" size={32} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>You have no pending alerts.</Text>
              </View>
            ) : (
              notifications.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notificationCard, !n.is_read && styles.notificationCardUnread]}
                  onPress={() => handleMarkNotificationRead(n.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notifTopRow}>
                    <View style={styles.notifTypePill}>
                      <Text style={styles.notifTypeText}>{n.notification_type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.notifTime}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifBody}>{n.body}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* TAB CONTENT: ANNOUNCEMENTS */}
        {activeTab === 'ANNOUNCEMENTS' && (
          <View style={{ gap: 12 }}>
            {announcements.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="megaphone-outline" size={32} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Branch Announcements</Text>
                <Text style={styles.emptySubtitle}>Check back later for company updates.</Text>
              </View>
            ) : (
              announcements.map((a) => (
                <View key={a.id} style={styles.announcementFullCard}>
                  <View style={styles.announcementHeader}>
                    <Text style={styles.announcementAudience}>FOR: {a.audience.toUpperCase()}</Text>
                    <Text style={styles.announcementDate}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.announcementTitle}>{a.title}</Text>
                  <Text style={styles.announcementBody}>{a.body}</Text>
                  <Text style={styles.announcementAuthor}>
                    Posted by {a.created_by_name || 'Admin Management'}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL: Complete Task */}
      {completingTask && (
        <Modal visible={Boolean(completingTask)} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>Complete Task #{completingTask.task_id}</Text>
                <TouchableOpacity onPress={() => setCompletingTask(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalTaskTitle}>{completingTask.title}</Text>

              <Text style={styles.inputLabel}>Completion Remarks</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Physical keys verified in lockbox rack. Lead called and visit confirmed."
                value={completionRemarks}
                onChangeText={setCompletionRemarks}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setCompletingTask(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleConfirmComplete}
                  disabled={submittingComplete}
                >
                  {submittingComplete ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Confirm Completed</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL: View Lead / Task Details */}
      {viewingTask && (
        <Modal visible={Boolean(viewingTask)} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>Task Details #{viewingTask.task_id}</Text>
                <TouchableOpacity onPress={() => setViewingTask(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                <Text style={styles.modalTaskTitle}>{viewingTask.title}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Type:</Text>
                  <Text style={styles.detailVal}>{viewingTask.task_type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Target Response Time:</Text>
                  <Text style={styles.detailVal}>{viewingTask.sla_minutes} Minutes</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Status:</Text>
                  <Text style={styles.detailVal}>{viewingTask.status.toUpperCase()}</Text>
                </View>

                {viewingTask.target_client_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Target Client:</Text>
                    <Text style={styles.detailVal}>{viewingTask.target_client_name}</Text>
                  </View>
                )}
                {viewingTask.target_client_phone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Client Phone:</Text>
                    <Text style={styles.detailVal}>{viewingTask.target_client_phone}</Text>
                  </View>
                )}
                {viewingTask.monthly_budget && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Budget:</Text>
                    <Text style={styles.detailVal}>{viewingTask.monthly_budget}</Text>
                  </View>
                )}
                {viewingTask.asset_preference && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Preference:</Text>
                    <Text style={styles.detailVal}>{viewingTask.asset_preference}</Text>
                  </View>
                )}
                {viewingTask.instructions && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.detailKey}>Instructions:</Text>
                    <Text style={styles.detailVal}>{viewingTask.instructions}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { flex: 1 }]}
                  onPress={() => setViewingTask(null)}
                >
                  <Text style={styles.modalSubmitText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
    paddingTop: STATUSBAR_HEIGHT,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF6FF',
  },
  backBtn: {
    padding: 6,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF6FF',
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: '#1D4ED8',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tabCountBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  tabCountTextActive: {
    color: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  // Branch Notice Card matching Stitch Image 8
  branchNoticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    gap: 8,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  noticeHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  noticeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  noticeDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  noticeHeadline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  noticeBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  noticeLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  noticeLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  // Section Header matching Stitch Image 8
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  slaWatchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  // Operational Directive Card matching Stitch Image 8
  directiveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    gap: 12,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  directiveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignedByText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    flex: 1,
  },
  timestampText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  directiveTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  statusSlaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1D4ED8',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  slaLabelText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  lockboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lockboxText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  actionButtonsCol: {
    gap: 8,
    marginTop: 4,
  },
  // Dark slate button matching Stitch theme
  primaryActionButton: {
    backgroundColor: '#1D4ED8',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  // Soft secondary button matching Stitch theme
  secondaryActionButton: {
    backgroundColor: '#EFF6FF',
    height: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  // Empty State
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFF6FF',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
  // Notification cards
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    gap: 4,
  },
  notificationCardUnread: {
    backgroundColor: '#F5F6FB',
    borderColor: '#D4D7E8',
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTypePill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  notifTypeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  notifTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  notifBody: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  // Announcement Full Card
  announcementFullCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#1D4ED8',
    gap: 6,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  announcementAudience: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  announcementDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  announcementBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  announcementAuthor: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  modalTaskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalSubmitBtn: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailKey: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});
