import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { mobileApi, MobileVisit, MobileFollowUp } from '../services/api';
import { AutocompleteIdInput } from '../components/AutocompleteIdInput';
import { DateTimePickerField, DateTimePickerModal } from '../components/DateTimePickerModal';
import { parseUtcDate, formatDateTime } from '../utils/dateUtils';
import { scheduleActivityReminder, cancelActivityReminder } from '../services/notifications';

const safeLocale = (val: any): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-IN');
};

interface VisitsScreenProps {
  initialTab?: 'all' | 'today' | 'completed' | 'followups' | 'claim';
  initialAction?: string;
  onActionHandled?: () => void;
  onScheduleVisit?: () => void;
  onClaimVisit?: (visitId: string) => void;
  onCompleteVisit?: (visitId: string) => void;
  initialEnquiryId?: string;
  initialPropertyId?: string;
}

export const VisitsScreen: React.FC<VisitsScreenProps> = ({
  initialTab = 'all',
  initialAction,
  onActionHandled,
  initialEnquiryId,
  initialPropertyId,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'completed' | 'followups' | 'claim'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialAction === 'SCHEDULE_VISIT') {
      setScheduleModalVisible(true);
      if (onActionHandled) onActionHandled();
    }
  }, [initialAction]);

  useEffect(() => {
    if (initialEnquiryId) {
      setEnquiryId(initialEnquiryId);
    }
    if (initialPropertyId) {
      setPropertyId(initialPropertyId);
    }
  }, [initialEnquiryId, initialPropertyId]);

  const [visits, setVisits] = useState<MobileVisit[]>([]);
  const [openClaims, setOpenClaims] = useState<MobileVisit[]>([]);
  const [followups, setFollowups] = useState<MobileFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [openClaimsCount, setOpenClaimsCount] = useState(0);
  const [followupCount, setFollowupCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Detailed Follow-up Modal State
  const [selectedFollowupDetail, setSelectedFollowupDetail] = useState<MobileFollowUp | null>(null);
  const [followupHistory, setFollowupHistory] = useState<MobileFollowUp[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Schedule Next Touch Modal
  const [showAddNextTouchModal, setShowAddNextTouchModal] = useState(false);
  const [nextTouchDate, setNextTouchDate] = useState('');
  const [nextTouchNotes, setNextTouchNotes] = useState('');
  const [savingNextTouch, setSavingNextTouch] = useState(false);

  // Complete Followup Modal
  const [completeFollowupModalItem, setCompleteFollowupModalItem] = useState<MobileFollowUp | null>(null);
  const [followupOutcome, setFollowupOutcome] = useState('Client Interested - Requested Callback');
  const [followupRemarks, setFollowupRemarks] = useState('');
  const [chainNextFollowup, setChainNextFollowup] = useState(false);
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupNotes, setNextFollowupNotes] = useState('');

  // Reschedule Followup Modal
  const [rescheduleFollowupModalItem, setRescheduleFollowupModalItem] = useState<MobileFollowUp | null>(null);
  const [followupNewDate, setFollowupNewDate] = useState('');
  const [followupRescheduleReason, setFollowupRescheduleReason] = useState('');

  // Schedule Modal
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [enquiryId, setEnquiryId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);

  // Complete Modal
  const [completeModalItem, setCompleteModalItem] = useState<MobileVisit | null>(null);
  const [outcome, setOutcome] = useState('🏆 Deal Closed / Booked');
  const [dealAmount, setDealAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Reschedule Modal
  const [rescheduleModalItem, setRescheduleModalItem] = useState<MobileVisit | null>(null);
  const [newDate, setNewDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Custom Date Filter (Enterprise Calendar Picker)
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterDateModalVisible, setFilterDateModalVisible] = useState(false);
  const [calendarScheduledDates, setCalendarScheduledDates] = useState<Set<string>>(new Set());

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCalendarDays = () => {
    const days: Date[] = [];
    const now = new Date();
    // Upcoming 14 days starting from today (Day 0 to Day 13)
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const fetchVisits = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const params: any = {};
      if (filterDate) {
        params.date = filterDate.split('T')[0];
        params.status = 'all'; // return all visits on this date: completed, scheduled, rescheduled!
      } else if (activeTab === 'today') {
        params.date = todayStr;
      } else if (activeTab === 'completed') {
        params.status = 'completed';
      } else if (activeTab === 'all') {
        params.status = 'active';
      }

      const [allRes, claimRes, followupRes, fullVisitsRes] = await Promise.all([
        mobileApi.getVisits(params),
        mobileApi.getVisits({ open_claims_only: true }),
        mobileApi.getFollowUps({ range: filterDate ? 'all' : (activeTab === 'today' ? 'today' : 'all') }),
        mobileApi.getVisits({ status: 'all' }),
      ]);
      setVisits(allRes.items);
      setOpenClaims(claimRes.items);
      setTodayCount(allRes.today_visits_count);
      setOpenClaimsCount(claimRes.open_claims_count);

      // Track ALL dates that have scheduled visits across the calendar
      const scheduledSet = new Set<string>();
      (fullVisitsRes.items || []).forEach((v) => {
        if (v.scheduled_at && v.status !== 'cancelled') {
          scheduledSet.add(formatLocalDate(parseUtcDate(v.scheduled_at)));
        }
      });
      setCalendarScheduledDates(scheduledSet);

      let fuItems = followupRes.items;
      if (filterDate) {
        const dStr = filterDate.split('T')[0];
        fuItems = fuItems.filter((f) => f.scheduled_at && f.scheduled_at.startsWith(dStr));
      }
      setFollowups(fuItems);
      setFollowupCount(followupRes.total);
      setOverdueCount(followupRes.overdue_count);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCompleteFollowup = async () => {
    if (!completeFollowupModalItem) return;
    try {
      await mobileApi.completeFollowUp(completeFollowupModalItem.followup_id, {
        outcome: followupOutcome,
        remarks: followupRemarks.trim() || undefined,
        next_followup_at: chainNextFollowup && nextFollowupDate ? nextFollowupDate : undefined,
        next_followup_notes: chainNextFollowup && nextFollowupNotes ? nextFollowupNotes : undefined,
      });
      // Cancel reminder for this completed callback
      cancelActivityReminder('followup', completeFollowupModalItem.followup_id);
      // If chaining another follow-up, schedule a reminder for the new date
      if (chainNextFollowup && nextFollowupDate) {
        scheduleActivityReminder(
          'followup',
          `${completeFollowupModalItem.followup_id}_next`,
          completeFollowupModalItem.customer_name,
          nextFollowupDate,
          completeFollowupModalItem.customer_phone
        );
      }
      Alert.alert('Follow-up Recorded', `Outcome logged for #${completeFollowupModalItem.followup_id}`);
      setCompleteFollowupModalItem(null);
      setFollowupRemarks('');
      setChainNextFollowup(false);
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not complete follow-up.');
    }
  };

  const handleRescheduleFollowup = async () => {
    if (!rescheduleFollowupModalItem || !followupRescheduleReason.trim()) {
      Alert.alert('Validation Error', 'Reschedule reason is mandatory.');
      return;
    }
    try {
      const target = followupNewDate.trim() || new Date(Date.now() + 86400000).toISOString();
      await mobileApi.rescheduleFollowUp(rescheduleFollowupModalItem.followup_id, target, followupRescheduleReason.trim());
      // Update reminder for the new rescheduled time
      scheduleActivityReminder(
        'followup',
        rescheduleFollowupModalItem.followup_id,
        rescheduleFollowupModalItem.customer_name,
        target,
        rescheduleFollowupModalItem.customer_phone
      );
      Alert.alert('Follow-up Rescheduled', `Updated #${rescheduleFollowupModalItem.followup_id}`);
      setRescheduleFollowupModalItem(null);
      setFollowupRescheduleReason('');
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not reschedule follow-up.');
    }
  };

  const openFollowupDetail = async (f: MobileFollowUp) => {
    setSelectedFollowupDetail(f);
    setLoadingHistory(true);
    try {
      const res = await mobileApi.getFollowUps({
        customer_id: f.customer_id,
        range: 'all',
      });
      setFollowupHistory(res.items || []);
    } catch {
      setFollowupHistory([f]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateNextTouch = async () => {
    if (!selectedFollowupDetail || !nextTouchDate.trim() || !nextTouchNotes.trim()) {
      Alert.alert('Validation Error', 'Scheduled Date/Time and Agenda Notes are required.');
      return;
    }
    setSavingNextTouch(true);
    try {
      await mobileApi.createFollowUp({
        enquiry_id: selectedFollowupDetail.enquiry_id,
        scheduled_at: nextTouchDate.trim(),
        notes: nextTouchNotes.trim(),
      });
      Alert.alert('Success', 'Next follow-up touchpoint scheduled in customer cadence.');
      setShowAddNextTouchModal(false);
      setNextTouchDate('');
      setNextTouchNotes('');
      // Refresh history
      openFollowupDetail(selectedFollowupDetail);
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not schedule next follow-up.');
    } finally {
      setSavingNextTouch(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [activeTab, filterDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVisits();
  };

  const handleClaim = async (v: MobileVisit) => {
    try {
      await mobileApi.claimVisit(v.visit_id);
      Alert.alert(
        'Visit Claimed!',
        `You now own visit #${v.visit_id} for ${v.customer_name}.\nIt has been moved to your active schedule.`,
      );
      setActiveTab('all');
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Claim Failed', err.message || 'Visit was already claimed by another executive.');
    }
  };

  const handleComplete = async () => {
    if (!completeModalItem) return;
    setSubmittingComplete(true);
    try {
      if (outcome.includes('Deal Closed') || outcome.includes('Booked')) {
        await mobileApi.closeVisitDeal(completeModalItem.visit_id, {
          deal_amount: dealAmount ? Number(dealAmount) : (completeModalItem.property_amount || undefined),
          final_remarks: remarks.trim() || 'Deal closed from site visit showing.',
        });
        Alert.alert(
          '🏆 Deal Closed & Property Synced!',
          `Visit #${completeModalItem.visit_id} closed successfully!\nProperty #${completeModalItem.property_id} updated to ${completeModalItem.property_transaction_type === 'rent' ? 'RENTED' : 'SOLD'}.\nEnquiry #${completeModalItem.enquiry_id} marked as DEAL CLOSED.`,
        );
      } else if (outcome.includes('Not Interested') || outcome.includes('Disliked')) {
        await mobileApi.abortVisitDeal(completeModalItem.visit_id, {
          reason: remarks.trim() || 'Client Disliked / Not Interested after site visit.',
          remarks: remarks.trim() || undefined,
        });
        Alert.alert(
          'Visit Recorded',
          `Visit #${completeModalItem.visit_id} recorded as Not Interested. Linked enquiry updated.`,
        );
      } else {
        await mobileApi.completeVisit(completeModalItem.visit_id, outcome, remarks.trim() || undefined);
        Alert.alert('Visit Completed', `Visit #${completeModalItem.visit_id} recorded with outcome: ${outcome}`);
      }
      // Cancel upcoming notification reminders for this completed visit
      cancelActivityReminder('visit', completeModalItem.visit_id);
      setCompleteModalItem(null);
      setOutcome('🏆 Deal Closed / Booked');
      setDealAmount('');
      setRemarks('');
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not complete visit.');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleModalItem || !rescheduleReason.trim()) {
      Alert.alert('Validation Error', 'Reschedule reason is mandatory.');
      return;
    }
    try {
      const targetDate = newDate.trim() || new Date(Date.now() + 86400000).toISOString();
      await mobileApi.rescheduleVisit(rescheduleModalItem.visit_id, targetDate, rescheduleReason.trim());
      // Re-schedule reminder for the updated visit time
      scheduleActivityReminder(
        'visit',
        rescheduleModalItem.visit_id,
        rescheduleModalItem.customer_name,
        targetDate,
        rescheduleModalItem.property_society
      );
      Alert.alert('Visit Rescheduled', `Visit #${rescheduleModalItem.visit_id} updated to new date/time.`);
      setRescheduleModalItem(null);
      setNewDate('');
      setRescheduleReason('');
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not reschedule visit.');
    }
  };

  const handleScheduleVisit = async () => {
    if (!enquiryId.trim() || !propertyId.trim()) {
      Alert.alert('Validation Error', 'Enquiry ID and Property ID are required.');
      return;
    }
    setSavingVisit(true);
    try {
      const visitDate = scheduledDate.trim() || new Date(Date.now() + 7200000).toISOString();
      const created = await mobileApi.createVisit({
        enquiry_id: enquiryId.trim(),
        property_id: propertyId.trim().toUpperCase(),
        scheduled_at: visitDate,
        notes: notes.trim() || undefined,
      });
      if (created && (created as any).visit_id) {
        scheduleActivityReminder(
          'visit',
          (created as any).visit_id,
          (created as any).customer_name || 'Client',
          visitDate,
          (created as any).property_society
        );
      }
      Alert.alert('Visit Scheduled', 'Visit scheduled and assigned to your schedule.');
      setScheduleModalVisible(false);
      setEnquiryId('');
      setPropertyId('');
      setScheduledDate('');
      setNotes('');
      setActiveTab('all');
      fetchVisits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not schedule visit.');
    } finally {
      setSavingVisit(false);
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.title} numberOfLines={1}>Daily Schedule</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {filterDate
                ? `📅 Filtered: ${new Date(filterDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
                : `${formattedDate} • Visits & Callbacks`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.scheduleBtn}
            onPress={() => setScheduleModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.scheduleBtnText}>Visit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendly-Style Schedule Browser: Interactive Horizontal Date Ribbon (Upcoming 14 Days) */}
      <View style={styles.dateRibbonContainer}>
        <View style={styles.dateRibbonHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Ionicons name="calendar" size={14} color="#1D4ED8" />
            <Text style={styles.dateRibbonTitle} numberOfLines={1}>Date</Text>
            {filterDate && (
              <TouchableOpacity
                style={styles.activeFilterBadge}
                onPress={() => setFilterDate(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.activeFilterBadgeText} numberOfLines={1}>
                  {new Date(filterDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
                <Ionicons name="close-circle" size={12} color="#DC2626" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={[styles.quickRibbonBtn, !filterDate && styles.quickRibbonBtnActive]}
              onPress={() => setFilterDate(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.quickRibbonBtnText, !filterDate && styles.quickRibbonBtnTextActive]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickRibbonBtn, filterDate === formatLocalDate(new Date()) && styles.quickRibbonBtnActive]}
              onPress={() => setFilterDate(formatLocalDate(new Date()))}
              activeOpacity={0.8}
            >
              <Text style={[styles.quickRibbonBtnText, filterDate === formatLocalDate(new Date()) && styles.quickRibbonBtnTextActive]}>
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.calendarPickerBtn}
              onPress={() => setFilterDateModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={13} color="#1D4ED8" />
              <Text style={styles.calendarPickerBtnText}>Pick Date</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Horizontal Date Cards Strip (Upcoming 14 Days from Today) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRibbonScroll}
        >
          {getCalendarDays().map((day) => {
            const dayStr = formatLocalDate(day);
            const isSelected = filterDate === dayStr;
            const isToday = dayStr === formatLocalDate(new Date());
            const hasScheduledVisits = calendarScheduledDates.has(dayStr);
            const showDot = !isToday && hasScheduledVisits;
            const dayName = day.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
            const dayNumber = day.getDate();
            const monthName = day.toLocaleDateString('en-IN', { month: 'short' });

            return (
              <TouchableOpacity
                key={dayStr}
                style={[
                  styles.dateRibbonCard,
                  isToday && !isSelected && styles.dateRibbonCardTodayGreen,
                  isSelected && styles.dateRibbonCardSelected,
                ]}
                onPress={() => {
                  if (isSelected) {
                    setFilterDate(null);
                  } else {
                    setFilterDate(dayStr);
                  }
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dateRibbonDayName,
                    isToday && !isSelected && styles.dateRibbonTextTodayGreen,
                    isSelected && styles.dateRibbonTextSelected,
                  ]}
                >
                  {dayName}
                </Text>
                <Text
                  style={[
                    styles.dateRibbonDayNum,
                    isToday && !isSelected && styles.dateRibbonNumTodayGreen,
                    isSelected && styles.dateRibbonTextSelected,
                  ]}
                >
                  {dayNumber}
                </Text>
                <Text
                  style={[
                    styles.dateRibbonMonth,
                    isToday && !isSelected && styles.dateRibbonTextTodayGreen,
                    isSelected && styles.dateRibbonTextSelected,
                  ]}
                >
                  {monthName}
                </Text>

                {/* Show under-dot ONLY when visits are scheduled in data; never show on today, blank if no visit */}
                {showDot ? (
                  <View style={[styles.visitScheduleUnderDot, isSelected && { backgroundColor: '#FFFFFF' }]} />
                ) : (
                  <View style={styles.blankDotPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Segmented Filter Bar: 5 Dedicated Horizontal Tabs */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentedTabBarScroll}
        >
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'all' && styles.segmentBtnActive]}
            onPress={() => {
              setFilterDate(null);
              setActiveTab('all');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={activeTab === 'all' ? '#FFFFFF' : '#1D4ED8'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.segmentBtnText, activeTab === 'all' && styles.segmentBtnTextActive]}
              numberOfLines={1}
            >
              All Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'today' && styles.segmentBtnActive]}
            onPress={() => {
              setFilterDate(null);
              setActiveTab('today');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="time"
              size={13}
              color={activeTab === 'today' ? '#FFFFFF' : '#1D4ED8'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.segmentBtnText, activeTab === 'today' && styles.segmentBtnTextActive]}
              numberOfLines={1}
            >
              Today ({todayCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'completed' && styles.segmentBtnActive]}
            onPress={() => {
              setFilterDate(null);
              setActiveTab('completed');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="trophy"
              size={13}
              color={activeTab === 'completed' ? '#FFFFFF' : '#1D4ED8'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.segmentBtnText, activeTab === 'completed' && styles.segmentBtnTextActive]}
              numberOfLines={1}
            >
              Completed & Booked
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'followups' && styles.segmentBtnActive]}
            onPress={() => {
              setFilterDate(null);
              setActiveTab('followups');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="call"
              size={13}
              color={activeTab === 'followups' ? '#FFFFFF' : '#1D4ED8'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.segmentBtnText, activeTab === 'followups' && styles.segmentBtnTextActive]}
              numberOfLines={1}
            >
              Callbacks ({followupCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'claim' && styles.segmentBtnActive]}
            onPress={() => {
              setFilterDate(null);
              setActiveTab('claim');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="flash"
              size={13}
              color={activeTab === 'claim' ? '#FFFFFF' : '#1D4ED8'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.segmentBtnText, activeTab === 'claim' && styles.segmentBtnTextActive]}
              numberOfLines={1}
            >
              Claim Pool {openClaimsCount > 0 ? `(${openClaimsCount})` : ''}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeTokens.colors.primary} />
          <Text style={styles.loadingText}>Loading operational visits...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Available Sector Leads (Open Claim Pool) */}
          {activeTab === 'claim' && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Available Sector Leads (Claim Pool)</Text>
                <Text style={styles.sectionMeta}>Auto-refreshes live</Text>
              </View>

              {openClaims.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No unclaimed leads currently in sector pool. All visits are assigned directly.</Text>
                </View>
              ) : (
                openClaims.map((claim) => (
                  <View key={claim.visit_id} style={styles.claimCard}>
                    <View style={styles.claimNoticeRow}>
                      <Text style={styles.claimNoticeText}>● UNASSIGNED VISIT IN YOUR SECTOR</Text>
                      <View style={styles.priorityPill}>
                        <Text style={styles.priorityPillText}>Priority Match</Text>
                      </View>
                    </View>

                    <View style={styles.claimDetailsRow}>
                      <View style={styles.propertyIconBox}>
                        <Ionicons name="business" size={20} color={themeTokens.colors.primaryDark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.claimPropMeta}>
                          #{claim.property_id} • {claim.property_society}
                        </Text>
                        <Text style={styles.claimClientName}>Client: {claim.customer_name}</Text>
                        <Text style={styles.claimReqText}>
                          {claim.property_bhk || 'Residential'} • ₹{safeLocale(claim.property_amount)} ({claim.property_transaction_type?.toUpperCase() || 'RENT'})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.claimFooterRow}>
                      <View style={styles.claimRuleBox}>
                        <Ionicons name="shield-checkmark-outline" size={13} color={themeTokens.colors.textSecondary} />
                        <Text style={styles.claimRuleText}>Claiming assigns visit directly to your schedule</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.claimActionBtn}
                        onPress={() => handleClaim(claim)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkbox-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.claimActionBtnText}>Claim Visit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Scheduled & Completed Visits Section */}
          {(filterDate || activeTab === 'all' || activeTab === 'today' || activeTab === 'completed') && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {filterDate
                    ? `📅 Visits on ${new Date(filterDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
                    : activeTab === 'all'
                    ? 'All Upcoming Scheduled Visits'
                    : activeTab === 'today'
                    ? "Today's Scheduled Visits"
                    : 'Completed Visits & Booked Deals'}
                </Text>
                <Text style={styles.sectionMeta}>{visits.length} showings</Text>
              </View>

              {visits.length === 0 ? (
                <EmptyState
                  title={filterDate ? 'No Showings on this Date' : activeTab === 'completed' ? 'No Completed Visits' : 'No Visits Scheduled'}
                  description={
                    filterDate
                      ? `No visits were recorded or scheduled for ${new Date(filterDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}.`
                      : activeTab === 'completed'
                      ? 'No visits have been marked completed yet.'
                      : 'You have no active visits in this view. Schedule a new showing or check Claim Pool.'
                  }
                  actionLabel="Schedule Visit"
                  onAction={() => {
                    if (filterDate) {
                      setScheduledDate(filterDate);
                    }
                    setScheduleModalVisible(true);
                  }}
                  iconName={filterDate ? 'calendar-outline' : activeTab === 'completed' ? 'trophy-outline' : 'calendar-outline'}
                />
              ) : (
                visits.map((item) => {
                  const visitDate = parseUtcDate(item.scheduled_at);
                  const timeStr = visitDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const dateStr = visitDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                  const isDealClosed = Boolean(
                    item.outcome && (item.outcome.includes('Deal Closed') || item.outcome.includes('Booked'))
                  );

                  return (
                    <View key={item.visit_id} style={styles.visitCard}>
                      {/* Top Header Pill Row */}
                      <View style={styles.visitHeaderRow}>
                        <View style={styles.timePill}>
                          <Text style={styles.timePillText}>{dateStr} • {timeStr}</Text>
                        </View>
                        <Badge
                          label={item.status.toUpperCase()}
                          variant={item.status === 'completed' ? 'success' : item.status === 'rescheduled' ? 'warning' : 'primary'}
                        />
                        <View style={styles.assignedBadge}>
                          <Ionicons name="person-outline" size={11} color="#1D4ED8" />
                          <Text style={styles.assignedText} numberOfLines={1}>
                            {item.assigned_name || 'Assigned to You'}
                          </Text>
                        </View>
                      </View>

                      {/* Property & Client Info */}
                      <View style={styles.propertyInfoRow}>
                        <View style={styles.propertyThumbBox}>
                          <Ionicons name="home" size={20} color={themeTokens.colors.primaryDark} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.propertyCodeTitle}>
                            #{item.property_id} • {item.property_society}
                          </Text>
                          <Text style={styles.claimReqText}>
                            {item.property_bhk || 'Residential'} • ₹{safeLocale(item.property_amount)} ({item.property_transaction_type?.toUpperCase() || 'RENT'})
                          </Text>
                          <Text style={styles.customerName}>Client: {item.customer_name}</Text>
                        </View>

                        {/* Direct Call / WhatsApp Buttons */}
                        <View style={{ gap: 4 }}>
                          <TouchableOpacity
                            style={styles.directCallBtn}
                            onPress={() => Linking.openURL(`tel:${item.customer_phone}`).catch(() => {})}
                          >
                            <Ionicons name="call" size={11} color="#FFFFFF" />
                            <Text style={styles.directCallBtnText}>Call</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.directWaBtn}
                            onPress={() => {
                              const cleanPhone = (item.customer_phone || '').replace(/[^0-9]/g, '');
                              Linking.openURL(`https://wa.me/91${cleanPhone}`).catch(() => {});
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={11} color="#FFFFFF" />
                            <Text style={styles.directCallBtnText}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Rescheduled Notice */}
                      {item.status === 'rescheduled' && item.reschedule_reason ? (
                        <View style={styles.rescheduleNoticeBox}>
                          <Ionicons name="repeat" size={13} color="#D97706" />
                          <Text style={styles.rescheduleNoticeText}>
                            Rescheduled: {item.reschedule_reason}
                          </Text>
                        </View>
                      ) : null}

                      {/* Completed Outcome Box */}
                      {item.status === 'completed' ? (
                        <View style={[
                          styles.completedOutcomeBox,
                          isDealClosed ? styles.completedOutcomeDealBox : null
                        ]}>
                          <Ionicons
                            name={isDealClosed ? 'trophy' : 'checkmark-circle'}
                            size={14}
                            color={isDealClosed ? '#16A34A' : '#1D4ED8'}
                          />
                          <View style={{ flex: 1, marginLeft: 6 }}>
                            <Text style={[styles.completedOutcomeTitle, isDealClosed ? { color: '#16A34A' } : null]}>
                              Outcome: {item.outcome || 'Visit Completed'}
                            </Text>
                            {item.remarks ? (
                              <Text style={styles.completedOutcomeRemarks}>{item.remarks}</Text>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        /* Client Notes Container */
                        <View style={styles.clientNotesBox}>
                          <Ionicons name="reader-outline" size={14} color={themeTokens.colors.primaryDark} style={{ marginRight: 6 }} />
                          <Text style={styles.clientNotesText} numberOfLines={2}>
                            {item.remarks || item.notes || 'Client scheduled for site showing. Present unit features and property amenities.'}
                          </Text>
                        </View>
                      )}

                      {/* Action Button Row */}
                      <View style={styles.actionBtnRow}>
                        {item.status !== 'completed' && item.status !== 'cancelled' ? (
                          <>
                            <TouchableOpacity
                              style={styles.primaryActionBtn}
                              onPress={() => {
                                setCompleteModalItem(item);
                                setOutcome('🏆 Deal Closed / Booked');
                                setDealAmount(item.property_amount ? String(item.property_amount) : '');
                                setRemarks('');
                              }}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                              <Text style={styles.primaryActionBtnText}>Complete / Outcome</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.secondaryActionBtn}
                              onPress={() => {
                                setRescheduleModalItem(item);
                                setNewDate('');
                                setRescheduleReason('');
                              }}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />
                              <Text style={styles.secondaryActionBtnText}>Reschedule</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 6 }}>
                            <Ionicons name="checkmark-done-circle" size={16} color="#16A34A" />
                            <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>
                              Showing Concluded {isDealClosed ? '• Deal Closed 🏆' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Scheduled Client Callbacks Section */}
          {(activeTab === 'followups' || activeTab === 'all') && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>📞 Scheduled Client Callbacks</Text>
                {overdueCount > 0 ? (
                  <View style={styles.overdueBadge}>
                    <Text style={styles.overdueBadgeText}>{overdueCount} Overdue</Text>
                  </View>
                ) : (
                  <Text style={styles.sectionMeta}>{followups.length} scheduled</Text>
                )}
              </View>

              {followups.length === 0 ? (
                <EmptyState
                  title="No Callbacks Due"
                  description="All scheduled customer follow-up calls are complete."
                  iconName="call-outline"
                />
              ) : (
                followups.map((f) => {
                  const sched = parseUtcDate(f.scheduled_at);
                  const isOverdue = sched < new Date() && f.status !== 'completed' && f.status !== 'cancelled';
                  const isPostVisit = Boolean(
                    (f.notes && /visit|showing|seen|flat|site|inspection/i.test(f.notes)) ||
                    (f.outcome && /visit/i.test(f.outcome))
                  );
                  const callReason = isPostVisit
                    ? `Post-Visit Feedback • ${f.enquiry_requirement || 'Property Showing'}`
                    : `Requirement Follow-up • ${f.enquiry_requirement || 'General Enquiry'}`;

                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.visitCard}
                      activeOpacity={0.9}
                      onPress={() => openFollowupDetail(f)}
                    >
                      {/* Top Header Row with Callback Pill & Status */}
                      <View style={styles.callbackCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.callbackPill}>
                            <Ionicons name="call" size={11} color="#1D4ED8" />
                            <Text style={styles.callbackPillText}>CLIENT CALLBACK</Text>
                          </View>
                          <Text style={styles.callbackIdText}>#{f.followup_id}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isOverdue && (
                            <View style={styles.overdueBadge}>
                              <Text style={styles.overdueBadgeText}>Overdue</Text>
                            </View>
                          )}
                          <Badge
                            label={f.status.toUpperCase()}
                            variant={f.status === 'completed' ? 'success' : isOverdue ? 'danger' : 'primary'}
                          />
                        </View>
                      </View>

                      {/* Scheduled Date/Time Row */}
                      <View style={styles.callbackScheduledRow}>
                        <Ionicons name="time" size={13} color="#1D4ED8" />
                        <Text style={styles.callbackScheduledText}>
                          Scheduled: {sched.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} at {sched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      {/* Customer Info Block with One-Tap Direct Action Buttons */}
                      <View style={styles.customerInfoBlock}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={styles.clientAvatarPill}>
                              <Ionicons name="person" size={15} color="#1D4ED8" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.customerName}>{f.customer_name}</Text>
                              <Text style={styles.customerPhone} selectable={false}>
                                📞 {f.customer_phone}
                              </Text>
                            </View>
                          </View>

                          {/* Quick One-Tap Contact Buttons */}
                          <View style={styles.directContactRow}>
                            <TouchableOpacity
                              style={styles.directCallBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                Linking.openURL(`tel:${f.customer_phone}`).catch(() => {});
                              }}
                            >
                              <Ionicons name="call" size={12} color="#FFFFFF" />
                              <Text style={styles.directCallBtnText}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.directWaBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                Linking.openURL(`https://wa.me/${f.customer_phone.replace(/\D/g, '')}`).catch(() => {});
                              }}
                            >
                              <Ionicons name="logo-whatsapp" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Context / Reason Box: WHY ARE WE CALLING? */}
                      <View style={styles.callbackReasonBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="information-circle" size={13} color="#92400E" />
                          <Text style={styles.callbackReasonLabel}>REASON / CALL PURPOSE:</Text>
                        </View>
                        <Text style={styles.callbackReasonText}>{callReason}</Text>
                      </View>

                      {/* Call Agenda & Remarks Box */}
                      <View style={styles.clientNotesBox}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={themeTokens.colors.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.clientNotesText} numberOfLines={2}>
                          "{f.notes || 'Follow up with customer regarding property preferences & next steps.'}"
                        </Text>
                      </View>

                      {/* Bottom Action Buttons Row */}
                      <View style={styles.actionBtnRow}>
                        {f.status !== 'completed' && f.status !== 'cancelled' ? (
                          <>
                            <TouchableOpacity
                              style={[styles.primaryActionBtn, { flex: 1.2 }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                setCompleteFollowupModalItem(f);
                                setFollowupOutcome('Client Interested - Requested Callback');
                                setFollowupRemarks('');
                                setChainNextFollowup(false);
                              }}
                            >
                              <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.primaryActionBtnText}>Mark Completed</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.secondaryActionBtn, { flex: 1 }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                setRescheduleFollowupModalItem(f);
                                setFollowupNewDate('');
                                setFollowupRescheduleReason('');
                              }}
                            >
                              <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />
                              <Text style={styles.secondaryActionBtnText}>Reschedule</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                            <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary }}>
                              Outcome: {f.outcome || 'Completed'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Schedule Visit Modal */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Field Visit</Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <AutocompleteIdInput
                label="Target Enquiry / Client"
                placeholder="Search enquiry ID, client, or phone (2-3 chars)..."
                value={enquiryId}
                onChangeId={setEnquiryId}
                entityType="enquiry"
                required
                helperText="Type 2-3 characters (e.g. ENQ, 80, Deepak) to select client"
              />

              <AutocompleteIdInput
                label="Property ID"
                placeholder="Search property ID, society, unit (2-3 chars)..."
                value={propertyId}
                onChangeId={setPropertyId}
                entityType="property"
                required
                helperText="Type 2-3 characters (e.g. AE, 203, ACE) to select property unit"
              />

              <DateTimePickerField
                label="Scheduled Date & Showing Time"
                value={scheduledDate}
                onChangeValue={setScheduledDate}
                placeholder="Pick date & showing hour from calendar..."
                required
              />

              <Text style={styles.formLabel}>Visit Instructions & Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="e.g. Client requested evening showing, wants clubhouse tour"
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor={themeTokens.colors.textSecondary}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setScheduleModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                label={savingVisit ? 'Scheduling...' : 'Schedule Visit'}
                variant="primary"
                onPress={handleScheduleVisit}
                disabled={savingVisit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Visit Modal */}
      {completeModalItem && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '88%', width: '92%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Complete Site Visit</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    #{completeModalItem.visit_id} • {completeModalItem.customer_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCompleteModalItem(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Property Context Card */}
                <View style={styles.modalPropSummaryCard}>
                  <Ionicons name="business" size={16} color="#1D4ED8" />
                  <Text style={styles.modalPropSummaryText}>
                    #{completeModalItem.property_id} • {completeModalItem.property_society || 'Property'} • ₹{safeLocale(completeModalItem.property_amount)} ({completeModalItem.property_transaction_type?.toUpperCase() || 'RENT'})
                  </Text>
                </View>

                {/* Outcome Quick Selection Chips */}
                <Text style={styles.formLabel}>Select Visit Outcome *</Text>
                <View style={styles.outcomeChipsContainer}>
                  {[
                    { label: '🏆 Deal Closed / Booked', value: '🏆 Deal Closed / Booked', activeColor: '#16A34A', activeBg: '#DCFCE7' },
                    { label: '🤝 Client Interested', value: '🤝 Interested / In Negotiation', activeColor: '#2563EB', activeBg: '#DBEAFE' },
                    { label: '🔄 Need Another Unit', value: '🔄 Need Another Option / Revisit', activeColor: '#D97706', activeBg: '#FEF3C7' },
                    { label: '❌ Not Interested', value: '❌ Disliked / Not Interested', activeColor: '#DC2626', activeBg: '#FEE2E2' },
                  ].map((chip) => {
                    const isSelected = outcome === chip.value;
                    return (
                      <TouchableOpacity
                        key={chip.value}
                        style={[
                          styles.outcomeChip,
                          isSelected && { backgroundColor: chip.activeBg, borderColor: chip.activeColor, borderWidth: 1.5 },
                        ]}
                        onPress={() => setOutcome(chip.value)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.outcomeChipText,
                            isSelected && { color: chip.activeColor, fontWeight: '700' },
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Dual Deal Sync Banner */}
                {(outcome.includes('Deal Closed') || outcome.includes('Booked')) && (
                  <View style={styles.dualSyncNoticeBox}>
                    <Ionicons name="flash" size={16} color="#16A34A" />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.dualSyncNoticeTitle}>⚡ Dual Deal Sync Activated</Text>
                      <Text style={styles.dualSyncNoticeBody}>
                        Submitting will automatically mark Property #{completeModalItem.property_id} as {completeModalItem.property_transaction_type === 'rent' ? 'RENTED' : 'SOLD'} and Enquiry #{completeModalItem.enquiry_id} as DEAL CLOSED.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Deal Amount input for closed deals */}
                {(outcome.includes('Deal Closed') || outcome.includes('Booked')) && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.formLabel}>Agreed Deal Amount (₹)</Text>
                    <TextInput
                      style={styles.formInput}
                      keyboardType="numeric"
                      placeholder={`e.g. ${completeModalItem.property_amount || 25000}`}
                      value={dealAmount}
                      onChangeText={setDealAmount}
                      placeholderTextColor={themeTokens.colors.textSecondary}
                    />
                  </View>
                )}

                <Text style={styles.formLabel}>Remarks & Client Feedback</Text>
                <TextInput
                  style={[styles.formInput, { height: 70 }]}
                  multiline
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Client feedback, terms discussed, advance token..."
                  placeholderTextColor={themeTokens.colors.textSecondary}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setCompleteModalItem(null)}
                  disabled={submittingComplete}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  label={submittingComplete ? 'Saving...' : (outcome.includes('Deal Closed') || outcome.includes('Booked')) ? '🏆 Close & Sync Deal' : 'Complete Visit'}
                  variant="primary"
                  onPress={handleComplete}
                  disabled={submittingComplete}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reschedule Visit Modal */}
      {rescheduleModalItem && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '88%', width: '92%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Reschedule Visit</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    #{rescheduleModalItem.visit_id} • {rescheduleModalItem.customer_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setRescheduleModalItem(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <DateTimePickerField
                  label="New Date & Showing Time"
                  value={newDate}
                  onChangeValue={setNewDate}
                  placeholder="Pick rescheduled date & clock..."
                  required
                />

                <Text style={styles.formLabel}>Quick Reasons</Text>
                <View style={styles.reasonChipsContainer}>
                  {[
                    'Client requested next day',
                    'Client running late / traffic',
                    'Keys / Owner unavailable',
                    'Client requested weekend',
                    'Weather / Rain delay',
                  ].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.reasonChip,
                        rescheduleReason === r && styles.reasonChipActive,
                      ]}
                      onPress={() => setRescheduleReason(r)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          rescheduleReason === r && styles.reasonChipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Mandatory Reschedule Reason *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Client requested morning slot"
                  value={rescheduleReason}
                  onChangeText={setRescheduleReason}
                  placeholderTextColor={themeTokens.colors.textSecondary}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setRescheduleModalItem(null)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  label="Confirm Reschedule"
                  variant="primary"
                  onPress={handleReschedule}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Complete Follow-up Modal */}
      {completeFollowupModalItem && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Complete Follow-up</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    #{completeFollowupModalItem.followup_id} • {completeFollowupModalItem.customer_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCompleteFollowupModalItem(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Call / Meeting Outcome *</Text>
              <TextInput
                style={styles.formInput}
                value={followupOutcome}
                onChangeText={setFollowupOutcome}
                placeholder="e.g. Client Requested Callback"
                placeholderTextColor={themeTokens.colors.textSecondary}
              />

              <Text style={styles.formLabel}>Conversation Remarks</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Client comments, preferences, feedback..."
                multiline
                value={followupRemarks}
                onChangeText={setFollowupRemarks}
                placeholderTextColor={themeTokens.colors.textSecondary}
              />

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 8 }}
                onPress={() => setChainNextFollowup(!chainNextFollowup)}
              >
                <Ionicons
                  name={chainNextFollowup ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={themeTokens.colors.primaryDark}
                />
                <Text style={{ fontSize: 12, fontWeight: '600', color: themeTokens.colors.textPrimary }}>
                  Schedule Next Follow-up in Chain
                </Text>
              </TouchableOpacity>

              {chainNextFollowup && (
                <View style={{ gap: 6 }}>
                  <DateTimePickerField
                    label="Next Scheduled Date & Time"
                    value={nextFollowupDate}
                    onChangeValue={setNextFollowupDate}
                    placeholder="Pick next touchpoint date..."
                  />
                  <Text style={styles.formLabel}>Next Call Objective</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Confirm site visit"
                    value={nextFollowupNotes}
                    onChangeText={setNextFollowupNotes}
                    placeholderTextColor={themeTokens.colors.textSecondary}
                  />
                </View>
              )}

              <View style={styles.modalFooter}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setCompleteFollowupModalItem(null)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  label="Record Outcome"
                  variant="primary"
                  onPress={handleCompleteFollowup}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reschedule Follow-up Modal */}
      {rescheduleFollowupModalItem && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Reschedule Follow-up</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    #{rescheduleFollowupModalItem.followup_id} • {rescheduleFollowupModalItem.customer_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setRescheduleFollowupModalItem(null)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <DateTimePickerField
                label="New Date & Showing Time"
                value={followupNewDate}
                onChangeValue={setFollowupNewDate}
                placeholder="Pick date & clock..."
                required
              />

              <Text style={styles.formLabel}>Mandatory Reason *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Client requested evening call"
                value={followupRescheduleReason}
                onChangeText={setFollowupRescheduleReason}
                placeholderTextColor={themeTokens.colors.textSecondary}
              />

              <View style={styles.modalFooter}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setRescheduleFollowupModalItem(null)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  label="Confirm"
                  variant="primary"
                  onPress={handleRescheduleFollowup}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal: Full Follow-up Details & Customer Touch History */}
      {selectedFollowupDetail && (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%', width: '94%' }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modalTitle}>#{selectedFollowupDetail.followup_id}</Text>
                    <Badge
                      label={selectedFollowupDetail.status.toUpperCase()}
                      variant={selectedFollowupDetail.status === 'completed' ? 'success' : selectedFollowupDetail.status === 'due' ? 'danger' : 'primary'}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary, marginTop: 2 }}>
                    Authoritative Follow-up Touchpoint Details
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedFollowupDetail(null)}>
                  <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                {/* Section 1: Customer & Communication Card */}
                <View style={[styles.clientNotesBox, { backgroundColor: '#F8F9FC', padding: 12, borderRadius: 8, marginVertical: 8 }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: themeTokens.colors.primaryDark, letterSpacing: 0.6 }}>
                    CUSTOMER IDENTITY
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: themeTokens.colors.textPrimary, marginTop: 2 }}>
                    {selectedFollowupDetail.customer_name}
                  </Text>
                  <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>
                    Phone: {selectedFollowupDetail.customer_phone}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.contactPillBtn, { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 8, backgroundColor: '#EFF6FF', borderRadius: 6 }]}
                      onPress={() => Linking.openURL(`tel:${selectedFollowupDetail.customer_phone}`).catch(() => {})}
                    >
                      <Ionicons name="call" size={14} color={themeTokens.colors.primaryDark} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: themeTokens.colors.primaryDark }}>Call Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.contactPillBtn, { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 8, backgroundColor: '#E4F3ED', borderRadius: 6 }]}
                      onPress={() => Linking.openURL(`https://wa.me/${selectedFollowupDetail.customer_phone.replace(/\D/g, '')}`).catch(() => {})}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#03543F' }}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Section 2: Enquiry Context */}
                <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: themeTokens.colors.textSecondary, letterSpacing: 0.6 }}>
                    ENQUIRY CONTEXT
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: themeTokens.colors.primaryDark, marginTop: 2 }}>
                    Enquiry Ref: {selectedFollowupDetail.enquiry_id}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textPrimary, marginTop: 2 }}>
                    Requirement: {selectedFollowupDetail.enquiry_requirement || 'General enquiry requirement'}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, marginTop: 4 }}>
                    Assigned Executive: <Text style={{ fontWeight: '700', color: themeTokens.colors.textPrimary }}>{selectedFollowupDetail.responsible_name || 'Field Agent'}</Text>
                  </Text>
                </View>

                {/* Section 3: This Follow-up's Agenda & Outcome */}
                <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: themeTokens.colors.textSecondary, letterSpacing: 0.6 }}>
                    TOUCHPOINT SCHEDULE & NOTES
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: themeTokens.colors.textPrimary }}>
                      {formatDateTime(selectedFollowupDetail.scheduled_at)}
                    </Text>
                  </View>

                  <View style={{ marginTop: 8, padding: 8, backgroundColor: '#F9FAFB', borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: themeTokens.colors.textSecondary }}>AGENDA / OBJECTIVE:</Text>
                    <Text style={{ fontSize: 12, color: themeTokens.colors.textPrimary, marginTop: 2 }}>
                      {selectedFollowupDetail.notes || 'No specific agenda recorded.'}
                    </Text>
                  </View>

                  {selectedFollowupDetail.status === 'completed' && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#DEF7EC', borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#03543F' }}>COMPLETED OUTCOME:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#03543F', marginTop: 2 }}>
                        {selectedFollowupDetail.outcome || 'Completed'}
                      </Text>
                      {selectedFollowupDetail.remarks && (
                        <Text style={{ fontSize: 12, color: '#1E429F', marginTop: 4 }}>
                          Remarks: "{selectedFollowupDetail.remarks}"
                        </Text>
                      )}
                    </View>
                  )}

                  {selectedFollowupDetail.reschedule_reason && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FEF08A', borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#854D0E' }}>RESCHEDULE REASON:</Text>
                      <Text style={{ fontSize: 12, color: '#854D0E', marginTop: 2 }}>
                        {selectedFollowupDetail.reschedule_reason}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Section 4: Chronological History Trail for this Customer */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: themeTokens.colors.primaryDark, letterSpacing: 0.5 }}>
                      CUSTOMER TOUCH CADENCE HISTORY ({followupHistory.length})
                    </Text>
                    {loadingHistory && <ActivityIndicator size="small" color={themeTokens.colors.primaryDark} />}
                  </View>

                  {followupHistory.length === 0 ? (
                    <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, fontStyle: 'italic', padding: 8 }}>
                      This is the initial recorded touchpoint for this customer enquiry.
                    </Text>
                  ) : (
                    followupHistory.map((h, idx) => {
                      const hDate = parseUtcDate(h.scheduled_at);
                      const isCurrent = h.followup_id === selectedFollowupDetail.followup_id;
                      return (
                        <View
                          key={h.id || h.followup_id}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isCurrent ? themeTokens.colors.primaryDark : '#E5E7EB',
                            backgroundColor: isCurrent ? '#EFF6FF' : '#FFFFFF',
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: themeTokens.colors.textPrimary }}>
                                Touch #{idx + 1} • {h.followup_id}
                              </Text>
                              {isCurrent && (
                                <Text style={{ fontSize: 10, fontWeight: '700', color: themeTokens.colors.primaryDark, backgroundColor: '#FFFFFF', paddingHorizontal: 4, borderRadius: 4 }}>
                                  Viewing Now
                                </Text>
                              )}
                            </View>
                            <Badge
                              label={h.status.toUpperCase()}
                              variant={h.status === 'completed' ? 'success' : 'primary'}
                            />
                          </View>
                          <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary, marginTop: 2 }}>
                            {hDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {hDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Executive: {h.responsible_name || 'Agent'}
                          </Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textPrimary, marginTop: 4 }}>
                            Notes: "{h.notes}"
                          </Text>
                          {h.outcome && (
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#03543F', marginTop: 2 }}>
                              Outcome: {h.outcome} {h.remarks ? `— "${h.remarks}"` : ''}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>

              {/* Action Bar Footer */}
              <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                {selectedFollowupDetail.status !== 'completed' && selectedFollowupDetail.status !== 'cancelled' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { flex: 1 }]}
                      onPress={() => {
                        setCompleteFollowupModalItem(selectedFollowupDetail);
                        setFollowupOutcome('Client Interested - Requested Callback');
                        setFollowupRemarks('');
                        setChainNextFollowup(false);
                      }}
                    >
                      <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.primaryActionBtnText}>Complete Touch</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryActionBtn, { flex: 1 }]}
                      onPress={() => {
                        setRescheduleFollowupModalItem(selectedFollowupDetail);
                        setFollowupNewDate('');
                        setFollowupRescheduleReason('');
                      }}
                    >
                      <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={styles.secondaryActionBtnText}>Reschedule</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { flex: 1, backgroundColor: themeTokens.colors.primaryDark }]}
                    onPress={() => {
                      setShowAddNextTouchModal(true);
                      setNextTouchDate(new Date(Date.now() + 86400000).toISOString());
                      setNextTouchNotes('');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.primaryActionBtnText}>Schedule Next Touch</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { paddingHorizontal: 16 }]}
                  onPress={() => setSelectedFollowupDetail(null)}
                >
                  <Text style={styles.secondaryActionBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal: Schedule Additional Customer Touchpoint */}
      {showAddNextTouchModal && selectedFollowupDetail && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Schedule Next Touchpoint</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    For {selectedFollowupDetail.customer_name} ({selectedFollowupDetail.enquiry_id})
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddNextTouchModal(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <DateTimePickerField
                label="Scheduled Date & Time"
                value={nextTouchDate}
                onChangeValue={setNextTouchDate}
                placeholder="Pick appointment date & time..."
                required
              />

              <Text style={styles.formLabel}>Touchpoint Agenda & Instructions *</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                multiline
                placeholder="e.g. Follow up on counter-offer from owner, confirm site visit"
                value={nextTouchNotes}
                onChangeText={setNextTouchNotes}
                placeholderTextColor={themeTokens.colors.textSecondary}
              />

              <View style={styles.modalFooter}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setShowAddNextTouchModal(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  label={savingNextTouch ? 'Saving...' : 'Confirm Touchpoint'}
                  variant="primary"
                  onPress={handleCreateNextTouch}
                  disabled={savingNextTouch}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Calendar Filter Modal */}
      <DateTimePickerModal
        visible={filterDateModalVisible}
        mode="date"
        title="Filter Schedule by Date"
        allowPast={true}
        minDate={null}
        value={filterDate || new Date().toISOString()}
        onConfirm={(_d: Date, iso: string) => {
          setFilterDate(iso);
          setFilterDateModalVisible(false);
        }}
        onClose={() => setFilterDateModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeTokens.colors.appBackground,
  },
  header: {
    backgroundColor: themeTokens.colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: themeTokens.colors.primaryDark,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeTokens.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeTokens.colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  pickDatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  clearDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  clearDatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  dateRibbonContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  dateRibbonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateRibbonTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  activeFilterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  quickRibbonBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  quickRibbonBtnActive: {
    backgroundColor: '#1D4ED8',
  },
  quickRibbonBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  quickRibbonBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4.5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  calendarPickerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    marginLeft: 3,
  },
  dateRibbonScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  dateRibbonCard: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateRibbonCardSelected: {
    backgroundColor: '#292A3A',
    borderColor: '#292A3A',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  dateRibbonCardToday: {
    borderColor: '#1D4ED8',
    borderWidth: 1.5,
    backgroundColor: '#EEF2FF',
  },
  dateRibbonCardTodayGreen: {
    borderColor: '#16A34A',
    borderWidth: 1.5,
    backgroundColor: '#DCFCE7',
  },
  dateRibbonDayName: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  dateRibbonTextTodayGreen: {
    color: '#15803D',
    fontWeight: '800',
  },
  dateRibbonDayNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginVertical: 1,
  },
  dateRibbonNumTodayGreen: {
    color: '#166534',
    fontWeight: '900',
  },
  dateRibbonMonth: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  dateRibbonTextSelected: {
    color: '#FFFFFF',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1D4ED8',
    marginTop: 3,
  },
  todayGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
    marginTop: 3,
  },
  visitScheduleUnderDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    marginTop: 3,
  },
  blankDotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 3,
  },
  tabBarWrapper: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  segmentedTabBarScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  segmentedTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 10,
    gap: 4,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  segmentBtnActive: {
    backgroundColor: themeTokens.colors.primaryDark,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 0,
    elevation: 0,
  },
  segmentBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  rescheduleNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  rescheduleNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  completedOutcomeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1D4ED8',
  },
  completedOutcomeDealBox: {
    backgroundColor: '#DCFCE7',
    borderLeftColor: '#16A34A',
  },
  completedOutcomeTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  completedOutcomeRemarks: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: themeTokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: themeTokens.colors.softSurface,
  },
  tabChipActive: {
    backgroundColor: themeTokens.colors.primaryDark,
  },
  tabChipDate: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabChipDateActive: {
    backgroundColor: themeTokens.colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
  },
  activeDateBannerText: {
    fontSize: 12,
    color: '#1D4ED8',
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  clearDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  callbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callbackPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  callbackIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  callbackScheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1D4ED8',
  },
  callbackScheduledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  customerInfoBlock: {
    marginBottom: 8,
  },
  clientAvatarPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBEBF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  directCallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  directWaBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callbackReasonBox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  callbackReasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  callbackReasonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: themeTokens.colors.textSecondary,
    marginTop: 10,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  sectionMeta: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: themeTokens.colors.surface,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
  },
  claimCard: {
    backgroundColor: themeTokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  claimNoticeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  claimNoticeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.6,
  },
  priorityPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  claimDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  propertyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: themeTokens.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimPropMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  claimClientName: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginTop: 1,
  },
  claimReqText: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  claimFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: themeTokens.colors.border,
    paddingTop: 10,
  },
  claimRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  claimRuleText: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
  },
  claimActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeTokens.colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  claimActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitCard: {
    backgroundColor: themeTokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  visitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  timePill: {
    backgroundColor: themeTokens.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  assignedText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginLeft: 'auto',
  },
  propertyInfoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  propertyThumbBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: themeTokens.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyCodeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginTop: 1,
  },
  customerPhone: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 1,
  },
  clientNotesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeTokens.colors.softSurface,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  clientNotesText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    flex: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: themeTokens.colors.border,
    paddingTop: 10,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeTokens.colors.primaryDark,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeTokens.colors.softSurface,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: themeTokens.colors.surface,
    borderRadius: 14,
    padding: 20,
    elevation: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
    backgroundColor: themeTokens.colors.surface,
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 16,
  },
  overdueBadge: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9B1C1C',
  },
  contactPillBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPropSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  modalPropSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
    flex: 1,
  },
  outcomeChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  outcomeChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  outcomeChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  dualSyncNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dualSyncNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  dualSyncNoticeBody: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 15,
  },
  reasonChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  reasonChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: themeTokens.colors.primaryDark,
  },
  reasonChipText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  reasonChipTextActive: {
    color: themeTokens.colors.primaryDark,
    fontWeight: '700',
  },
});
