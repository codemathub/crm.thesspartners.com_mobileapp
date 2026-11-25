import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal as RNModal,
  Linking,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import {
  mobileApi,
  MobileNotification,
  MobileTask,
  MobileAnnouncement,
  MobileVisit,
} from '../services/api';

export interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenTasksScreen?: () => void;
  onOpenEnquiries?: (enquiryId?: string) => void;
  onOpenProperty?: (propertyId: string) => void;
  onOpenSchedule?: (subTab?: string) => void;
  onUpdateUnreadCount?: (newCount: number) => void;
}

type FilterTab = 'ALL' | 'TASKS' | 'VISITS' | 'ANNOUNCEMENTS';

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onOpenTasksScreen,
  onOpenEnquiries,
  onOpenProperty,
  onOpenSchedule,
  onUpdateUnreadCount,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [todayVisits, setTodayVisits] = useState<MobileVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Local interaction states
  const [acknowledgedTaskIds, setAcknowledgedTaskIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [notifsRes, tasksRes, noticesRes, visitsRes] = await Promise.all([
        mobileApi.getNotifications().catch(() => ({ items: [], total: 0, unread_count: 0 })),
        mobileApi.getTasks().catch(() => ({ items: [] })),
        mobileApi.getAnnouncements().catch(() => []),
        mobileApi.getVisits({ date: todayStr }).catch(() => ({ items: [] })),
      ]);
      const notifItems = notifsRes.items || [];
      setNotifications(notifItems);
      setTasks(tasksRes.items || []);
      setAnnouncements(noticesRes || []);
      setTodayVisits(visitsRes.items || []);

      const unreadCount = notifItems.filter((n) => !n.is_read).length;
      onUpdateUnreadCount?.(unreadCount);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadData();
    }
  }, [visible]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcknowledgeTask = async (taskId: string) => {
    try {
      await mobileApi.acknowledgeTask(taskId);
      setAcknowledgedTaskIds((prev) => [...prev, taskId]);
      Alert.alert('Task Acknowledged', `Task #${taskId} locked to your profile. Great work!`);
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Task acknowledged.');
    }
  };

  const handleCallClient = (phone?: string) => {
    if (!phone) {
      Alert.alert('Notice', 'No phone number available for this client.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Notice', 'Phone dialer could not be opened on this device.');
    });
  };

  const handleNavigate = (query?: string) => {
    if (!query) {
      Alert.alert('Notice', 'No address available for navigation.');
      return;
    }
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(query)}`).catch(() => {
      Alert.alert('Notice', 'Navigation maps could not be opened.');
    });
  };

  const handleMarkNotifRead = async (item: MobileNotification) => {
    try {
      // 1. Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      const remainingUnread = notifications.filter((n) => !n.is_read && n.id !== item.id).length;
      onUpdateUnreadCount?.(remainingUnread);

      // 2. Persist to MongoDB backend
      await mobileApi.markNotificationRead(item.id);

      // 3. Navigation to target item like a real enterprise app
      if (item.entity_type === 'enquiry' && item.entity_id) {
        onClose();
        onOpenEnquiries?.(item.entity_id);
      } else if (item.entity_type === 'property' && item.entity_id) {
        onClose();
        onOpenProperty?.(item.entity_id);
      } else if (item.entity_type === 'visit') {
        onClose();
        onOpenSchedule?.('today');
      } else if (item.entity_type === 'task') {
        onClose();
        onOpenTasksScreen?.();
      }
    } catch {
      // offline fallback
    }
  };

  const handleClearAll = async () => {
    try {
      // 1. Optimistically mark all read in UI
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      // 2. Immediately clear the red dot badge in App.tsx
      onUpdateUnreadCount?.(0);
      // 3. Persist to backend database
      await mobileApi.markAllNotificationsRead();
    } catch (err) {
      console.warn('Could not mark all notifications read:', err);
    }
  };

  // Count active unread items
  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' && !acknowledgedTaskIds.includes(t.task_id)).length;
  const activeAlertsCount = unreadNotifsCount + pendingTasksCount + todayVisits.filter((v) => v.status === 'scheduled').length;

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalSheetContainer}>
          {/* Top Drag Handle */}
          <View style={styles.dragHandleBar} />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="notifications" size={18} color="#FFFFFF" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.headerTitle}>Notifications</Text>
                  {unreadNotifsCount > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{unreadNotifsCount} New</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.headerSubtitle}>Updates on leads, client visits & assigned tasks</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {unreadNotifsCount > 0 && (
                <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn} activeOpacity={0.88}>
                  <Text style={styles.clearBtnText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.88}>
                <Ionicons name="close" size={20} color="#1F2937" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterPillText, activeFilter === 'ALL' && styles.filterPillTextActive]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'TASKS' && styles.filterPillActive]}
              onPress={() => setActiveFilter('TASKS')}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={13}
                color={activeFilter === 'TASKS' ? '#1D4ED8' : '#6B7280'}
              />
              <Text style={[styles.filterPillText, activeFilter === 'TASKS' && styles.filterPillTextActive]}>
                Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'VISITS' && styles.filterPillActive]}
              onPress={() => setActiveFilter('VISITS')}
            >
              <Ionicons
                name="calendar"
                size={12}
                color={activeFilter === 'VISITS' ? '#1D4ED8' : '#6B7280'}
              />
              <Text style={[styles.filterPillText, activeFilter === 'VISITS' && styles.filterPillTextActive]}>
                Visits
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ANNOUNCEMENTS' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ANNOUNCEMENTS')}
            >
              <Ionicons
                name="megaphone"
                size={12}
                color={activeFilter === 'ANNOUNCEMENTS' ? '#1D4ED8' : '#6B7280'}
              />
              <Text style={[styles.filterPillText, activeFilter === 'ANNOUNCEMENTS' && styles.filterPillTextActive]}>
                Announcements
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Alerts List */}
          <ScrollView
            style={styles.alertsScrollView}
            contentContainerStyle={styles.alertsScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1D4ED8" />
                <Text style={styles.loadingText}>Fetching live notifications...</Text>
              </View>
            ) : (
              <>
                {/* 1. REAL SERVER TASKS */}
                {tasks
                  .filter((t) => activeFilter === 'ALL' || activeFilter === 'TASKS')
                  .map((t) => {
                    const isAck = t.status === 'acknowledged' || acknowledgedTaskIds.includes(t.task_id);
                    return (
                      <View key={t.task_id} style={[styles.alertCard, !isAck && styles.alertCardPriority]}>
                        <View style={styles.cardHeader}>
                          <View style={[styles.cardTypeIcon, { backgroundColor: isAck ? '#DCFCE7' : '#FEE2E2' }]}>
                            <Ionicons name={isAck ? 'checkmark' : 'alert-circle'} size={14} color={isAck ? '#16A34A' : '#DC2626'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.cardCategory}>ASSIGNED TASK</Text>
                              <Text style={styles.cardDot}>•</Text>
                              <Text style={styles.cardTime}>
                                {t.due_at
                                  ? `Due ${new Date(t.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : 'Priority Task'}
                              </Text>
                            </View>
                            <Text style={styles.cardTitle}>{t.title}</Text>
                          </View>
                        </View>

                        <Text style={styles.cardBody}>{t.instructions || 'Action item assigned.'}</Text>

                        {!isAck ? (
                          <View style={styles.actionsRow}>
                            <TouchableOpacity
                              style={styles.primaryActionBtn}
                              onPress={() => handleAcknowledgeTask(t.task_id)}
                              activeOpacity={0.88}
                            >
                              <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                              <Text style={styles.primaryActionBtnText}>Acknowledge Task</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.acknowledgedNoticeBox}>
                            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                            <Text style={styles.acknowledgedNoticeText}>Task Acknowledged</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                {/* 2. REAL SCHEDULED VISITS FOR TODAY */}
                {(activeFilter === 'ALL' || activeFilter === 'VISITS') &&
                  todayVisits.map((v) => (
                    <View key={v.visit_id} style={styles.alertCard}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.cardTypeIcon, { backgroundColor: '#DBEAFE' }]}>
                          <Ionicons name="calendar" size={14} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.cardCategory}>SITE VISIT</Text>
                            <Text style={styles.cardDot}>•</Text>
                            <Text style={styles.cardTime}>
                              {v.scheduled_at
                                ? new Date(v.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'Scheduled'}
                            </Text>
                          </View>
                          <Text style={styles.cardTitle}>Visit #{v.visit_id}: {v.property_society}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardBody}>
                        Client: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{v.customer_name}</Text> • Property #{v.property_id} ({v.property_bhk || 'Residential'}) • Status: {v.status.toUpperCase()}
                      </Text>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.callActionBtn}
                          onPress={() => handleCallClient(v.customer_phone)}
                          activeOpacity={0.88}
                        >
                          <Ionicons name="call" size={14} color="#059669" />
                          <Text style={styles.callActionBtnText} numberOfLines={1}>Call {v.customer_name.split(' ')[0]}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryActionBtn}
                          onPress={() => handleNavigate(`${v.property_society} ${v.property_location}`)}
                          activeOpacity={0.88}
                        >
                          <Ionicons name="navigate-outline" size={14} color="#1D4ED8" />
                          <Text style={styles.secondaryActionBtnText} numberOfLines={1}>Navigate</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                {/* 3. REAL BRANCH ANNOUNCEMENTS */}
                {(activeFilter === 'ALL' || activeFilter === 'ANNOUNCEMENTS') &&
                  announcements.map((a) => (
                    <View key={a.id} style={styles.alertCard}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.cardTypeIcon, { backgroundColor: '#F3E8FF' }]}>
                          <Ionicons name="megaphone" size={14} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.cardCategory}>OFFICE ANNOUNCEMENT</Text>
                            <Text style={styles.cardDot}>•</Text>
                            <Text style={styles.cardTime}>
                              {a.created_at ? new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                            </Text>
                          </View>
                          <Text style={styles.cardTitle}>{a.title}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardBody}>{a.body}</Text>
                    </View>
                  ))}

                {/* 4. REAL SERVER NOTIFICATIONS */}
                {notifications
                  .filter((n) => {
                    if (activeFilter === 'ALL') return true;
                    if (activeFilter === 'TASKS' && n.notification_type?.includes('task')) return true;
                    if (activeFilter === 'VISITS' && n.notification_type?.includes('visit')) return true;
                    if (activeFilter === 'ANNOUNCEMENTS' && n.notification_type?.includes('announcement')) return true;
                    return false;
                  })
                  .map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.alertCard, !item.is_read && styles.alertCardUnread]}
                      onPress={() => handleMarkNotifRead(item)}
                      activeOpacity={0.88}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.cardTypeIcon, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="notifications" size={14} color="#1D4ED8" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.cardCategory}>
                              {item.notification_type.toUpperCase()}
                            </Text>
                            <Text style={styles.cardDot}>•</Text>
                            <Text style={styles.cardTime}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <Text style={styles.cardTitle}>{item.title}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardBody}>{item.body}</Text>
                    </TouchableOpacity>
                  ))}

                {/* EMPTY STATE */}
                {unreadNotifsCount === 0 && tasks.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="checkmark-done-circle-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>You're all caught up!</Text>
                    <Text style={styles.emptySubtitle}>
                      No unread notifications or pending action items.
                    </Text>
                  </View>
                )}

                {/* SUBTLE SYSTEM FOOTER HINT */}
                <View style={styles.systemPushNotice}>
                  <Ionicons name="shield-checkmark" size={14} color="#1D4ED8" />
                  <Text style={styles.systemPushText}>
                    Background push notifications active • Alerts trigger even when G² Brothers CRM is minimized.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: '92%',
    minHeight: '65%',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  alertsScrollView: {
    flex: 1,
  },
  alertsScrollContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  alertCardPriority: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFDFD',
  },
  alertCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#1D4ED8',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cardDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  cardTime: {
    fontSize: 11,
    color: '#64748B',
  },
  priorityBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  cardBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  slaTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  slaTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  callActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  iconOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconOutlineBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  acknowledgedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acknowledgedNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240,
  },
  systemPushNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  systemPushText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
});
