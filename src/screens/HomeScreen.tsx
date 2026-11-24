import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { mobileApi, MobileVisit, MobileFollowUp } from '../services/api';
import { CustomerDetailScreen } from './CustomerDetailScreen';
import { parseUtcDate, formatTime, formatDateTime } from '../utils/dateUtils';
import { scheduleActivityReminder } from '../services/notifications';
import { QuickActionFAB } from '../components/QuickActionFAB';

interface HomeScreenProps {
  currentUser?: any;
  onNavigateTab: (tab: 'Inventory' | 'Enquiries' | 'Schedule' | 'Visits' | 'More', subTab?: string) => void;
  onOpenQuickAction: (action: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  onNavigateTab,
  onOpenQuickAction,
}) => {
  const userName = currentUser?.full_name || 'Agent';
  const userRole = (currentUser?.role || 'executive').toLowerCase();
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabel =
    userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Executive';
  const roleBg =
    userRole === 'super_admin' ? '#EFF6FF' : userRole === 'admin' ? '#E1EFFE' : '#DEF7EC';
  const roleColor =
    userRole === 'super_admin' ? '#1D4ED8' : userRole === 'admin' ? '#1C64F2' : '#057A55';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalProps, setTotalProps] = useState(0);
  const [availableProps, setAvailableProps] = useState(0);
  const [rentProps, setRentProps] = useState(0);
  const [soldProps, setSoldProps] = useState(0);
  const [totalEnquiries, setTotalEnquiries] = useState(0);
  const [todayVisits, setTodayVisits] = useState<MobileVisit[]>([]);
  const [followups, setFollowups] = useState<MobileFollowUp[]>([]);
  const [overdueFollowupsCount, setOverdueFollowupsCount] = useState(0);
  const [customer360Id, setCustomer360Id] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [propsRes, enqRes, visitsRes, followupsRes] = await Promise.all([
        mobileApi.getProperties(),
        mobileApi.getEnquiries(),
        mobileApi.getVisits({ date: todayStr }),
        mobileApi.getFollowUps({ range: 'all' }),
      ]);

      const props = propsRes.items || [];
      setTotalProps(propsRes.total || props.length);
      setAvailableProps(props.filter((p) => p.status === 'available').length);
      setRentProps(props.filter((p) => p.status === 'rented').length);
      setSoldProps(props.filter((p) => p.status === 'sold').length);

      setTotalEnquiries(enqRes.total || (enqRes.items || []).length);

      // ONLY pending/scheduled visits that have to be done! (Exclude completed and cancelled)
      const activeVisits = (visitsRes.items || []).filter(
        (v) => v.status !== 'completed' && v.status !== 'cancelled'
      );
      setTodayVisits(activeVisits);

      // ONLY pending/scheduled callbacks that have to be done! (Exclude completed and cancelled)
      const activeFollowups = (followupsRes.items || []).filter(
        (f) => f.status !== 'completed' && f.status !== 'cancelled'
      );
      setFollowups(activeFollowups);
      setOverdueFollowupsCount(activeFollowups.filter((f) => new Date(f.scheduled_at) < new Date()).length);

      // Schedule local notification reminders for pending visits & follow-ups
      activeVisits.forEach((v) => {
        scheduleActivityReminder('visit', v.visit_id, v.customer_name, v.scheduled_at, v.property_society);
      });
      activeFollowups.forEach((f) => {
        scheduleActivityReminder('followup', f.followup_id, f.customer_name, f.scheduled_at, f.customer_phone);
      });
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Welcome Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarBox}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={20} color="#1D4ED8" />
            </View>
            <View style={styles.activeStatusDot} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.greetingTitle} numberOfLines={1}>Welcome, {userName}</Text>
              <View style={[styles.adminRolePill, { backgroundColor: roleBg }]}>
                <Text style={[styles.adminRoleText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Action Pill Buttons matching Stitch Image 3 */}
        <View style={styles.quickActionPillsRow}>
          <TouchableOpacity
            style={styles.quickActionPill}
            onPress={() => onOpenQuickAction('ADD_PROPERTY')}
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.quickActionPillText} numberOfLines={1}>+ Property</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionPill}
            onPress={() => onOpenQuickAction('ADD_ENQUIRY')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.quickActionPillText} numberOfLines={1}>+ Enquiry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionPill}
            onPress={() => onOpenQuickAction('SCHEDULE_VISIT')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.quickActionPillText} numberOfLines={1}>+ Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionPill}
            onPress={() => onNavigateTab('Schedule', 'followups')}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.quickActionPillText} numberOfLines={1}>Callbacks</Text>
          </TouchableOpacity>
        </View>

        {/* 4 Stat Tiles matching Stitch Image 3 */}
        <View style={styles.kpiGrid}>
          {/* Tile 1: Available Units */}
          <TouchableOpacity
            style={styles.kpiTile}
            onPress={() => onNavigateTab('Inventory')}
            activeOpacity={0.8}
          >
            <View style={styles.kpiTileHeader}>
              <Text style={styles.kpiTileLabel}>Available Units</Text>
              <Ionicons name="business" size={16} color={themeTokens.colors.primaryDark} />
            </View>
            <Text style={styles.kpiTileValue}>
              {availableProps} <Text style={styles.kpiTileSubval}>/ {totalProps} total</Text>
            </Text>
            <View style={styles.kpiTileFooter}>
              <Text style={styles.kpiFootText}>Rent: {rentProps}</Text>
              <Text style={styles.kpiFootText}>Sold: {soldProps}</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 2: Active Enquiries */}
          <TouchableOpacity
            style={styles.kpiTile}
            onPress={() => onNavigateTab('Enquiries')}
            activeOpacity={0.8}
          >
            <View style={styles.kpiTileHeader}>
              <Text style={styles.kpiTileLabel}>Active Enquiries</Text>
              <Ionicons name="chatbubbles" size={16} color={themeTokens.colors.primaryDark} />
            </View>
            <Text style={styles.kpiTileValue}>
              {totalEnquiries} <Text style={styles.kpiTileSubval}>pipeline</Text>
            </Text>
            <View style={styles.kpiTileFooter}>
              <Text style={[styles.kpiFootText, { color: themeTokens.colors.primaryDark, fontWeight: '700' }]}>
                High Intent Leads
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tile 3: Pending Site Visits */}
          <TouchableOpacity
            style={styles.kpiTile}
            onPress={() => onNavigateTab('Schedule')}
            activeOpacity={0.8}
          >
            <View style={styles.kpiTileHeader}>
              <Text style={styles.kpiTileLabel}>Pending Visits</Text>
              <Ionicons name="walk" size={16} color={themeTokens.colors.primaryDark} />
            </View>
            <Text style={styles.kpiTileValue}>
              {todayVisits.length}
              <Text style={styles.kpiTileSubval}>
                {' '}to do today
              </Text>
            </Text>
            <View style={styles.kpiTileFooter}>
              <Text style={[styles.kpiFootText, todayVisits.length === 0 ? { color: '#057A55', fontWeight: '700' } : {}]}>
                {todayVisits.length === 0 ? 'All completed ✓' : `${todayVisits.length} remaining`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tile 4: Pending Client Callbacks */}
          <TouchableOpacity
            style={styles.kpiTile}
            onPress={() => onNavigateTab('Schedule', 'followups')}
            activeOpacity={0.8}
          >
            <View style={styles.kpiTileHeader}>
              <Text style={styles.kpiTileLabel}>Pending Callbacks</Text>
              <Ionicons name="call" size={16} color={themeTokens.colors.primaryDark} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.kpiTileValue}>{followups.length}</Text>
              {overdueFollowupsCount > 0 && (
                <View style={styles.overdueMiniPill}>
                  <Text style={styles.overdueMiniPillText}>{overdueFollowupsCount} Overdue</Text>
                </View>
              )}
            </View>
            <View style={styles.kpiTileFooter}>
              <Text style={[styles.kpiFootText, followups.length === 0 ? { color: '#057A55', fontWeight: '700' } : {}]}>
                {followups.length === 0 ? 'All completed ✓' : 'Due for attention'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Today's Pending Site Visits Preview */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.sectionTitle}>Today's Pending Visits ({todayVisits.length})</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigateTab('Schedule')}>
            <Text style={styles.viewScheduleLink}>Full Schedule →</Text>
          </TouchableOpacity>
        </View>

        {todayVisits.length === 0 ? (
          <View style={styles.completedCard}>
            <View style={styles.completedCardContent}>
              <View style={styles.completedIconCircle}>
                <Ionicons name="checkmark-done" size={20} color="#057A55" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.completedCardTitle}>All site visits completed</Text>
                <Text style={styles.completedCardSub}>No pending showings remaining for today. Great job!</Text>
              </View>
            </View>
          </View>
        ) : (
          todayVisits.slice(0, 3).map((v) => {
            const timeStr = formatTime(v.scheduled_at);
            return (
              <TouchableOpacity
                key={v.visit_id}
                style={styles.visitItemCard}
                onPress={() => onNavigateTab('Schedule', 'today')}
                activeOpacity={0.88}
              >
                <View style={styles.visitItemTop}>
                  <View style={styles.timeTag}>
                    <Text style={styles.timeTagText}>{timeStr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitItemClient}>{v.customer_name}</Text>
                    <Text style={styles.visitItemSub} numberOfLines={1}>
                      #{v.property_id} • {v.property_society}
                    </Text>
                  </View>
                  <Badge
                    label={v.status.toUpperCase()}
                    variant={v.status === 'completed' ? 'success' : 'primary'}
                  />
                </View>

                <View style={styles.visitItemBottom}>
                  <Text style={styles.phoneText} selectable={false}>
                    {v.customer_phone}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`tel:${v.customer_phone}`).catch(() => { });
                      }}
                    >
                      <Ionicons name="call" size={13} color={themeTokens.colors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`https://wa.me/${v.customer_phone.replace(/\D/g, '')}`).catch(() => { });
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                    </TouchableOpacity>
                    <View style={styles.tapToViewPill}>
                      <Text style={styles.tapToViewPillText}>View in Schedule →</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Client Callbacks Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="call-outline" size={16} color={themeTokens.colors.primaryDark} />
            <Text style={styles.sectionTitle}>Pending Callbacks Due ({followups.length})</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            onPress={() => onNavigateTab('Schedule', 'followups')}
          >
            <Text style={styles.viewScheduleLink}>View All ({followups.length})</Text>
            <Ionicons name="chevron-forward" size={13} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {followups.length === 0 ? (
          <View style={styles.completedCard}>
            <View style={styles.completedCardContent}>
              <View style={styles.completedIconCircle}>
                <Ionicons name="checkmark-done" size={20} color="#057A55" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.completedCardTitle}>All callbacks completed</Text>
                <Text style={styles.completedCardSub}>All client follow-up calls are done and up to date.</Text>
              </View>
            </View>
          </View>
        ) : (
          followups.slice(0, 4).map((f) => {
            const sched = parseUtcDate(f.scheduled_at);
            const isOverdue = sched < new Date();
            const isPostVisit = Boolean(
              (f.notes && /visit|showing|seen|flat|site|inspection/i.test(f.notes)) ||
              (f.outcome && /visit/i.test(f.outcome))
            );
            const callReason = isPostVisit
              ? `Post-Visit Feedback • ${f.enquiry_requirement || 'Property Showing'}`
              : `Requirement Follow-up • ${f.enquiry_requirement || 'General Enquiry'}`;

            const dateStr = sched.toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });

            return (
              <TouchableOpacity
                key={f.id || f.followup_id}
                style={styles.followupItemCard}
                onPress={() => {
                  if (f.customer_id) {
                    setCustomer360Id(f.customer_id);
                  } else {
                    onNavigateTab('Schedule', 'followups');
                  }
                }}
                activeOpacity={0.88}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text style={styles.followupName}>{f.customer_name}</Text>
                    {isOverdue ? (
                      <View style={styles.overdueMiniPill}>
                        <Text style={styles.overdueMiniPillText}>Overdue</Text>
                      </View>
                    ) : (
                      <View style={[styles.overdueMiniPill, { backgroundColor: '#E0E7FF' }]}>
                        <Text style={[styles.overdueMiniPillText, { color: '#3730A3' }]}>Scheduled</Text>
                      </View>
                    )}
                  </View>

                  {/* Direct Action Call / WhatsApp */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`tel:${f.customer_phone}`).catch(() => { });
                      }}
                    >
                      <Ionicons name="call" size={13} color={themeTokens.colors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`https://wa.me/${f.customer_phone.replace(/\D/g, '')}`).catch(() => { });
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color={themeTokens.colors.textSecondary} />
                  </View>
                </View>

                {/* Call Purpose / Reason Box */}
                <View style={styles.homeReasonPill}>
                  <Ionicons name="information-circle" size={11} color="#92400E" />
                  <Text style={styles.homeReasonPillText} numberOfLines={1}>{callReason}</Text>
                </View>

                <Text style={styles.followupEnquiry}>
                  Enquiry #{f.enquiry_id} {f.enquiry_requirement ? `• ${f.enquiry_requirement}` : ''}
                </Text>
                {f.notes ? (
                  <Text style={styles.followupNotes} numberOfLines={2}>
                    &quot;{f.notes}&quot;
                  </Text>
                ) : null}

                {/* Action Prompt Pill at Bottom of Card */}
                <View style={styles.followupCardFooterRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={11} color={themeTokens.colors.textSecondary} />
                    <Text style={styles.followupFooterDate}>
                      {dateStr}
                    </Text>
                  </View>
                  <View style={styles.tapToViewPill}>
                    <Text style={styles.tapToViewPillText}>Tap for 360° Dossier & Notes →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Customer 360 Panoramic Dossier Modal */}
      {customer360Id && (
        <Modal visible={!!customer360Id} animationType="slide">
          <CustomerDetailScreen
            customerId={customer360Id}
            onClose={() => {
              setCustomer360Id(null);
              fetchDashboardData();
            }}
            onScheduleVisit={() => {
              setCustomer360Id(null);
              onNavigateTab('Schedule', 'today');
            }}
          />
        </Modal>
      )}

      {/* Floating Action Button (+ Property, + Enquiry, + Visit) */}
      <QuickActionFAB onOpenQuickAction={onOpenQuickAction} bottomOffset={20} />
    </View>
  );
};

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: themeTokens.colors.appBackground,
  },
  container: {
    padding: 16,
    paddingBottom: 80,
    backgroundColor: themeTokens.colors.appBackground,
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  avatarBox: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greetingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  adminRolePill: {
    backgroundColor: '#EBEBF7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  syncDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: themeTokens.colors.success,
  },
  syncText: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
    fontWeight: '600',
  },
  branchSubtext: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  quickActionPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  quickActionPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickActionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiTile: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  kpiTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textSecondary,
  },
  kpiTileValue: {
    fontSize: 20,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginTop: 6,
  },
  kpiTileSubval: {
    fontSize: 11,
    fontWeight: '500',
    color: themeTokens.colors.textSecondary,
  },
  kpiTileFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  kpiFootText: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
    fontWeight: '500',
  },
  overdueMiniPill: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  overdueMiniPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9B1C1C',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  viewScheduleLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyCardText: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
  },
  completedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    marginBottom: 10,
  },
  completedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  completedCardSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  visitItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 8,
  },
  visitItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeTag: {
    backgroundColor: '#EBEBF7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  visitItemClient: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  visitItemSub: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 1,
  },
  visitItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  phoneText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueBadge: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9B1C1C',
  },
  followupItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 8,
  },
  followupName: {
    fontSize: 13,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  homeReasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  homeReasonPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  followupEnquiry: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 3,
  },
  followupNotes: {
    fontSize: 11,
    color: themeTokens.colors.textPrimary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  followupCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  followupFooterDate: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
    fontWeight: '500',
  },
  tapToViewPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tapToViewPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
});
