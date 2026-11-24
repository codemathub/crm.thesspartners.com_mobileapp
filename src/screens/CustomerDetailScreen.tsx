import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, MobileCustomer, MobileEnquiry } from '../services/api';
import { DateTimePickerField } from '../components/DateTimePickerModal';
import { parseUtcDate, formatDateTime } from '../utils/dateUtils';

interface CustomerDetailScreenProps {
  customerId: string;
  onClose: () => void;
  onScheduleVisit?: (customer: MobileCustomer, enquiry?: MobileEnquiry) => void;
}

type TabMode = 'requirements' | 'visits' | 'notes' | 'timeline' | 'matches';

export const CustomerDetailScreen: React.FC<CustomerDetailScreenProps> = ({
  customerId,
  onClose,
  onScheduleVisit,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    customer: MobileCustomer;
    enquiries: MobileEnquiry[];
    visits: any[];
    followups: any[];
    matched_properties: any[];
    stats: any;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<TabMode>('requirements');
  const [selectedEnquiry, setSelectedEnquiry] = useState<MobileEnquiry | null>(null);

  // Follow-up note input state
  const [newNote, setNewNote] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // New Requirement / Enquiry Modal State
  const [addReqModalVisible, setAddReqModalVisible] = useState(false);
  const [reqLookingFor, setReqLookingFor] = useState('');
  const [reqTransType, setReqTransType] = useState<'rent' | 'sale'>('rent');
  const [reqBudgetMin, setReqBudgetMin] = useState('');
  const [reqBudgetMax, setReqBudgetMax] = useState('');
  const [reqMoveInDate, setReqMoveInDate] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [savingReq, setSavingReq] = useState(false);

  // Edit Customer Profile Modal State
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editWaPhone, setEditWaPhone] = useState('');
  const [editPriority, setEditPriority] = useState<'hot' | 'warm' | 'cold'>('hot');
  const [editCustType, setEditCustType] = useState<'tenant' | 'buyer' | 'owner' | 'agent'>('tenant');
  const [savingProfile, setSavingProfile] = useState(false);

  // Schedule Site Visit Modal State
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleTargetProp, setScheduleTargetProp] = useState<any>(null);
  const [scheduleSelectedEnquiryId, setScheduleSelectedEnquiryId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [schedulingVisit, setSchedulingVisit] = useState(false);

  const openScheduleVisitModal = (prop?: any, enq?: MobileEnquiry) => {
    setScheduleTargetProp(prop || null);
    if (enq) {
      setScheduleSelectedEnquiryId(enq.enquiry_id);
    } else if (data?.enquiries && data.enquiries.length > 0) {
      // Find first non-closed enquiry or fallback
      const activeEnq = data.enquiries.find((e) => !['deal_closed', 'aborted', 'cancelled'].includes(e.status)) || data.enquiries[0];
      setScheduleSelectedEnquiryId(activeEnq.enquiry_id);
    } else {
      setScheduleSelectedEnquiryId('');
    }
    const targetDate = new Date(Date.now() + 2 * 3600 * 1000);
    setScheduleDate(targetDate.toISOString());
    setScheduleNotes(prop ? `Site visit showing for #${prop.property_id} at ${prop.society_name || 'Society'}` : 'Site visit showing');
    setScheduleModalVisible(true);
  };

  const handleConfirmScheduleVisit = async () => {
    if (!scheduleSelectedEnquiryId) {
      Alert.alert('Enquiry Required', 'Please select or add an active requirement / enquiry for this customer.');
      return;
    }
    if (!scheduleTargetProp?.property_id) {
      Alert.alert('Property Required', 'Target Property ID is required for a showing.');
      return;
    }
    if (!scheduleDate) {
      Alert.alert('Date Required', 'Please select a visit date and time.');
      return;
    }

    setSchedulingVisit(true);
    try {
      await mobileApi.createVisit({
        enquiry_id: scheduleSelectedEnquiryId,
        property_id: scheduleTargetProp.property_id,
        scheduled_at: scheduleDate,
        notes: scheduleNotes.trim() || undefined,
      });

      Alert.alert(
        'Visit Scheduled!',
        `Site showing for Unit #${scheduleTargetProp.property_id} (${scheduleTargetProp.society_name || 'Society'}) has been booked.`
      );
      setScheduleModalVisible(false);
      setScheduleTargetProp(null);
      await fetchDossier();
      setActiveTab('timeline');
    } catch (err: any) {
      Alert.alert('Schedule Error', err.message || 'Could not schedule visit.');
    } finally {
      setSchedulingVisit(false);
    }
  };

  const fetchDossier = async () => {
    try {
      setLoading(true);
      const res = await mobileApi.getCustomer360(customerId);
      setData(res);
      if (res.customer) {
        setEditName(res.customer.name);
        setEditAltPhone(res.customer.alternate_phone || '');
        setEditWaPhone(res.customer.whatsapp_phone || '');
        setEditPriority((res.customer.priority as any) || 'hot');
        setEditCustType((res.customer.customer_type as any) || 'tenant');
      }
    } catch (err: any) {
      Alert.alert('Load Error', err.message || 'Could not load customer dossier');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [customerId]);

  const handleCall = () => {
    if (!data?.customer.primary_phone) {
      Alert.alert('Notice', 'No phone number on file for this client.');
      return;
    }
    Linking.openURL(`tel:${data.customer.primary_phone}`).catch(() => {
      Alert.alert('Notice', 'Could not open phone dialer on this device.');
    });
  };

  const handleWhatsApp = () => {
    if (!data?.customer.primary_phone) {
      Alert.alert('Notice', 'No phone number on file for this client.');
      return;
    }
    const clean = (data.customer.whatsapp_phone || data.customer.primary_phone).replace(/\D/g, '');
    const num = clean.startsWith('91') ? clean : `91${clean}`;
    Linking.openURL(`https://wa.me/${num}`).catch(() => {
      Alert.alert('Notice', 'Could not open WhatsApp messaging on this device.');
    });
  };

  const handleSaveFollowupNote = async () => {
    if (!newNote.trim()) {
      Alert.alert('Note Required', 'Please enter follow-up remarks or agenda.');
      return;
    }
    setSavingNote(true);
    try {
      await mobileApi.addCustomerFollowup(customerId, {
        notes: newNote.trim(),
        scheduled_at: nextFollowupDate || undefined,
      });
      setNewNote('');
      setNextFollowupDate('');
      Alert.alert('Success', nextFollowupDate ? 'Follow-up note and appointment scheduled.' : 'Follow-up note recorded.');
      fetchDossier();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateRequirement = async () => {
    if (!reqLookingFor.trim()) {
      Alert.alert('Requirement Required', 'Please specify what the customer is looking for (e.g. 2 BHK, 3 BHK Villa).');
      return;
    }
    setSavingReq(true);
    try {
      let finalNotes = reqNotes.trim();
      if (reqMoveInDate) {
        const moveInStr = new Date(reqMoveInDate).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        finalNotes = finalNotes ? `${finalNotes} | Target Move-in: ${moveInStr}` : `Target Move-in: ${moveInStr}`;
      }

      await mobileApi.createEnquiry({
        customer_id: customerId,
        customer_name: data?.customer.name,
        customer_phone: data?.customer.primary_phone,
        transaction_type: reqTransType,
        looking_for: reqLookingFor.trim(),
        budget_min: reqBudgetMin ? Number(reqBudgetMin) : undefined,
        budget_max: reqBudgetMax ? Number(reqBudgetMax) : undefined,
        notes: finalNotes || undefined,
        status: 'new',
      });
      setAddReqModalVisible(false);
      setReqLookingFor('');
      setReqBudgetMin('');
      setReqBudgetMax('');
      setReqMoveInDate('');
      setReqNotes('');
      Alert.alert('Success', 'Customer requirement added successfully.');
      fetchDossier();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add requirement');
    } finally {
      setSavingReq(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Name Required', 'Customer name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      await mobileApi.updateCustomer(customerId, {
        name: editName.trim(),
        alternate_phone: editAltPhone.trim() || undefined,
        whatsapp_phone: editWaPhone.trim() || undefined,
        priority: editPriority,
        customer_type: editCustType,
      });
      setEditProfileVisible(false);
      Alert.alert('Updated', 'Customer profile details updated.');
      fetchDossier();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={themeTokens.colors.primaryDark} />
        <Text style={styles.loadingText}>Loading Customer Details...</Text>
      </View>
    );
  }

  const { customer, enquiries, visits, followups, matched_properties, stats } = data;

  // Build unified chronological historical timeline
  const safeFormatDate = (val: any, fallback = 'Recently') => {
    if (!val) return fallback;
    const d = parseUtcDate(val);
    return isNaN(d.getTime()) ? fallback : d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const timelineEvents: Array<{
    id: string;
    type: 'visit' | 'followup' | 'enquiry';
    date: Date;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    details?: string;
  }> = [];

  visits.forEach((v: any) => {
    const rawDate = v.scheduled_at || v.created_at;
    const eventDate = rawDate ? parseUtcDate(rawDate) : new Date();
    timelineEvents.push({
      id: `v-${v.visit_id || v.id}`,
      type: 'visit',
      date: isNaN(eventDate.getTime()) ? new Date() : eventDate,
      title: `Site Visit: ${v.property_society || 'Property'} (${v.property_bhk || ''})`,
      subtitle: `Scheduled for ${safeFormatDate(v.scheduled_at, 'Scheduled Date TBD')}`,
      badge: (v.status || 'SCHEDULED').toUpperCase(),
      badgeColor: v.status === 'completed' ? '#16A34A' : v.status === 'cancelled' ? '#DC2626' : '#2563EB',
      details: v.outcome ? `Outcome: ${v.outcome}` : v.remarks ? `Remarks: ${v.remarks}` : undefined,
    });
  });

  followups.forEach((f: any) => {
    const rawDate = f.created_at || f.scheduled_at;
    const eventDate = rawDate ? parseUtcDate(rawDate) : new Date();
    timelineEvents.push({
      id: `f-${f.followup_id || f.id}`,
      type: 'followup',
      date: isNaN(eventDate.getTime()) ? new Date() : eventDate,
      title: `Follow-up Note by ${f.responsible_name || 'Executive'}`,
      subtitle: safeFormatDate(f.created_at || f.scheduled_at),
      badge: (f.status || 'NOTE').toUpperCase(),
      badgeColor: f.status === 'completed' ? '#059669' : '#D97706',
      details: f.notes,
    });
  });

  enquiries.forEach((e: any) => {
    const rawDate = e.created_at;
    const eventDate = rawDate ? parseUtcDate(rawDate) : new Date();
    timelineEvents.push({
      id: `e-${e.enquiry_id || e.id}`,
      type: 'enquiry',
      date: isNaN(eventDate.getTime()) ? new Date() : eventDate,
      title: `Requirement Logged: ${e.looking_for}`,
      subtitle: `Budget: ₹${(e.budget_min || 0).toLocaleString('en-IN')} - ₹${(e.budget_max || 0).toLocaleString('en-IN')}`,
      badge: (e.status || 'NEW').toUpperCase(),
      badgeColor: '#4F46E5',
      details: e.notes ? `Notes: ${e.notes}` : undefined,
    });
  });

  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeTokens.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {customer.name}
            </Text>
            <View style={[styles.priorityPill, customer.priority === 'hot' ? styles.hotPill : styles.warmPill]}>
              <Text style={styles.priorityText}>{(customer.priority || 'HOT').toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            ID: #{customer.customer_id} • {(customer.customer_type || 'Tenant').toUpperCase()}
          </Text>
        </View>

        {/* Quick Edit Profile Button */}
        <TouchableOpacity onPress={() => setEditProfileVisible(true)} style={styles.editBtn}>
          <Ionicons name="create-outline" size={20} color={themeTokens.colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Action Bar (Call, WhatsApp, Add Requirement) */}
      <View style={styles.quickBar}>
        <TouchableOpacity style={styles.actionCallBtn} onPress={handleCall}>
          <Ionicons name="call" size={16} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionWaBtn} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionAddReqBtn}
          onPress={() => setAddReqModalVisible(true)}
        >
          <Ionicons name="add-circle" size={16} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>+ What They Need</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Bar: Interactive Navigation to Sections */}
      <View style={styles.kpiRow}>
        <TouchableOpacity
          style={[styles.kpiCard, activeTab === 'requirements' && styles.kpiCardActive]}
          onPress={() => setActiveTab('requirements')}
          activeOpacity={0.75}
        >
          <Text style={[styles.kpiNumber, activeTab === 'requirements' && styles.kpiNumberActive]}>
            {stats?.total_enquiries || enquiries.length}
          </Text>
          <Text style={[styles.kpiLabel, activeTab === 'requirements' && styles.kpiLabelActive]}>
            Requirements
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.kpiCard, activeTab === 'visits' && styles.kpiCardActive]}
          onPress={() => setActiveTab('visits')}
          activeOpacity={0.75}
        >
          <Text style={[styles.kpiNumber, activeTab === 'visits' && styles.kpiNumberActive]}>
            {stats?.total_visits || visits.length}
          </Text>
          <Text style={[styles.kpiLabel, activeTab === 'visits' && styles.kpiLabelActive]}>
            Visits
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.kpiCard, activeTab === 'notes' && styles.kpiCardActive]}
          onPress={() => setActiveTab('notes')}
          activeOpacity={0.75}
        >
          <Text style={[styles.kpiNumber, activeTab === 'notes' && styles.kpiNumberActive]}>
            {stats?.total_followups || followups.length}
          </Text>
          <Text style={[styles.kpiLabel, activeTab === 'notes' && styles.kpiLabelActive]}>
            Notes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.kpiCard, activeTab === 'matches' && styles.kpiCardActive]}
          onPress={() => setActiveTab('matches')}
          activeOpacity={0.75}
        >
          <Text style={[styles.kpiNumber, { color: '#16A34A' }, activeTab === 'matches' && styles.kpiNumberActive]}>
            {stats?.matched_properties_count || matched_properties.length}
          </Text>
          <Text style={[styles.kpiLabel, activeTab === 'matches' && styles.kpiLabelActive]}>
            Matched
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs (Scrollable 5 Tabs) */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'requirements' && styles.activeTabItem]}
            onPress={() => setActiveTab('requirements')}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={activeTab === 'requirements' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
            <Text style={[styles.tabItemText, activeTab === 'requirements' && styles.activeTabItemText]}>
              Requirements ({enquiries.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'visits' && styles.activeTabItem]}
            onPress={() => setActiveTab('visits')}
          >
            <Ionicons
              name="walk-outline"
              size={15}
              color={activeTab === 'visits' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
            <Text style={[styles.tabItemText, activeTab === 'visits' && styles.activeTabItemText]}>
              Visits ({visits.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'notes' && styles.activeTabItem]}
            onPress={() => setActiveTab('notes')}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={15}
              color={activeTab === 'notes' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
            <Text style={[styles.tabItemText, activeTab === 'notes' && styles.activeTabItemText]}>
              Notes ({followups.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'matches' && styles.activeTabItem]}
            onPress={() => setActiveTab('matches')}
          >
            <Ionicons
              name="home-outline"
              size={15}
              color={activeTab === 'matches' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
            <Text style={[styles.tabItemText, activeTab === 'matches' && styles.activeTabItemText]}>
              Matches ({matched_properties.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'timeline' && styles.activeTabItem]}
            onPress={() => setActiveTab('timeline')}
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={activeTab === 'timeline' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
            <Text style={[styles.tabItemText, activeTab === 'timeline' && styles.activeTabItemText]}>
              Timeline ({timelineEvents.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Tab Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* TAB 1: REQUIREMENTS ("What They Need") */}
        {activeTab === 'requirements' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>What They Need (Active Enquiries)</Text>
              <TouchableOpacity
                style={styles.addMiniBtn}
                onPress={() => setAddReqModalVisible(true)}
              >
                <Ionicons name="add" size={16} color={themeTokens.colors.primaryDark} />
                <Text style={styles.addMiniBtnText}>Add Requirement</Text>
              </TouchableOpacity>
            </View>

            {enquiries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="clipboard-outline" size={32} color={themeTokens.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No requirements logged yet</Text>
                <Text style={styles.emptyDesc}>Tap &apos;Add Requirement&apos; above to record what this client is looking for.</Text>
              </View>
            ) : (
              enquiries.map((enq) => (
                <TouchableOpacity
                  key={enq.enquiry_id || enq.id}
                  style={styles.enquiryCard}
                  onPress={() => setSelectedEnquiry(enq)}
                  activeOpacity={0.88}
                >
                  <View style={styles.enquiryTopRow}>
                    <Text style={styles.enquiryId}>#{enq.enquiry_id}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{(enq.status || 'NEW').toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.enquiryReqText}>
                    {enq.looking_for} ({enq.transaction_type ? enq.transaction_type.toUpperCase() : 'RENT'})
                  </Text>

                  <View style={styles.budgetRow}>
                    <Text style={styles.budgetLabel}>Budget Range:</Text>
                    <Text style={styles.budgetValue}>
                      ₹{(enq.budget_min || 0).toLocaleString()} - ₹{(enq.budget_max || 0).toLocaleString()}
                      {enq.transaction_type === 'rent' ? '/mo' : ''}
                    </Text>
                  </View>

                  {enq.preferred_societies && enq.preferred_societies.length > 0 && (
                    <View style={styles.societyRow}>
                      <Text style={styles.societyLabel}>Preferred Societies:</Text>
                      <Text style={styles.societyValue}>{enq.preferred_societies.join(', ')}</Text>
                    </View>
                  )}

                  {enq.notes && (
                    <Text style={styles.enquiryNotes}>&quot;{enq.notes}&quot;</Text>
                  )}

                  <View style={styles.enquiryActionRow}>
                    <TouchableOpacity
                      style={styles.enqScheduleBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openScheduleVisitModal(undefined, enq);
                      }}
                    >
                      <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} />
                      <Text style={styles.enqScheduleBtnText}>Schedule Site Visit</Text>
                    </TouchableOpacity>

                    <View style={styles.viewDetailPill}>
                      <Text style={styles.viewDetailPillText}>View Details →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Customer Contact & Meta Details */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Customer Contact Dossier</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Primary Mobile:</Text>
                <Text style={styles.infoVal}>{customer.primary_phone}</Text>
              </View>
              {customer.alternate_phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Alternate Phone:</Text>
                  <Text style={styles.infoVal}>{customer.alternate_phone}</Text>
                </View>
              )}
              {customer.whatsapp_phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>WhatsApp Line:</Text>
                  <Text style={styles.infoVal}>{customer.whatsapp_phone}</Text>
                </View>
              )}
              {customer.notes && (
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoKey}>Profile Notes:</Text>
                  <Text style={styles.infoVal}>{customer.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB: VISITS - Full Showing History for this Customer */}
        {activeTab === 'visits' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Customer Visit History ({visits.length})</Text>
              <TouchableOpacity
                style={styles.addMiniBtn}
                onPress={() => openScheduleVisitModal()}
              >
                <Ionicons name="calendar" size={14} color={themeTokens.colors.primaryDark} />
                <Text style={styles.addMiniBtnText}>+ Schedule Visit</Text>
              </TouchableOpacity>
            </View>

            {visits.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="walk-outline" size={36} color={themeTokens.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No site visits recorded yet</Text>
                <Text style={styles.emptyDesc}>Schedule a property showing for this client to begin the visit trail.</Text>
                <TouchableOpacity
                  style={[styles.addMiniBtn, { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 }]}
                  onPress={() => openScheduleVisitModal()}
                >
                  <Text style={[styles.addMiniBtnText, { fontWeight: '800' }]}>+ Schedule First Showing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              visits.map((v: any, vIdx: number) => {
                const schedDate = parseUtcDate(v.scheduled_at || v.created_at);
                const isCompleted = v.status === 'completed';
                const isCancelled = v.status === 'cancelled';
                const executiveName =
                  v.agent_name ||
                  v.assigned_executive ||
                  v.claimed_by_name ||
                  v.created_by_name ||
                  v.completed_by_name ||
                  'Staff Executive';

                return (
                  <View key={v.visit_id || v.id || vIdx} style={styles.visitHistoryCard}>
                    {/* Header: Property & Status */}
                    <View style={styles.visitCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.visitPropTitle} numberOfLines={1}>
                          #{v.property_id} • {v.property_society || 'Property Showing'}
                        </Text>
                        {v.property_bhk ? (
                          <Text style={styles.visitPropSubtitle}>{v.property_bhk} Unit</Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          isCompleted
                            ? { backgroundColor: '#DCFCE7' }
                            : isCancelled
                            ? { backgroundColor: '#FEE2E2' }
                            : { backgroundColor: '#DBEAFE' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isCompleted
                              ? { color: '#15803D' }
                              : isCancelled
                              ? { color: '#B91C1C' }
                              : { color: '#1D4ED8' },
                          ]}
                        >
                          {(v.status || 'SCHEDULED').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Date & Time in IST */}
                    <View style={styles.visitDateRow}>
                      <Ionicons name="time-outline" size={14} color="#64748B" />
                      <Text style={styles.visitDateText}>
                        {formatDateTime(schedDate)}
                      </Text>
                    </View>

                    {/* Handled By / Completed By Executive */}
                    <View style={styles.executivePill}>
                      <Ionicons name="person" size={12} color="#1D4ED8" />
                      <Text style={styles.executivePillText}>
                        {isCompleted ? 'Completed by:' : 'Assigned Executive:'} {executiveName}
                      </Text>
                    </View>

                    {/* Outcome Badge if recorded */}
                    {v.outcome ? (
                      <View style={styles.outcomeBox}>
                        <Text style={styles.outcomeBoxText}>🎯 Outcome: {v.outcome}</Text>
                      </View>
                    ) : null}

                    {/* Notes & Remarks */}
                    {(v.notes || v.remarks) ? (
                      <View style={styles.visitNotesBox}>
                        <Text style={styles.visitNotesText}>
                          &quot;{v.notes || v.remarks}&quot;
                        </Text>
                      </View>
                    ) : null}

                    {/* Actions */}
                    <View style={styles.visitCardFooter}>
                      <TouchableOpacity
                        style={styles.visitFooterBtn}
                        onPress={() => openScheduleVisitModal(undefined, enquiries[0])}
                      >
                        <Ionicons name="repeat" size={13} color={themeTokens.colors.primaryDark} />
                        <Text style={styles.visitFooterBtnText}>Schedule Another Showing</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: FOLLOW-UP NOTES ("write follow up notes for them") */}
        {activeTab === 'notes' && (
          <View>
            {/* Quick Follow-up Note Writer */}
            <View style={styles.noteWriterCard}>
              <Text style={styles.writerTitle}>Write Follow-up Note</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Write call agenda, client feedback, or showing notes here..."
                placeholderTextColor={themeTokens.colors.textSecondary}
                multiline
                numberOfLines={3}
                value={newNote}
                onChangeText={setNewNote}
              />
              <View style={{ marginVertical: 8 }}>
                <DateTimePickerField
                  label="Schedule Next Follow-up (Optional)"
                  value={nextFollowupDate}
                  onChangeValue={setNextFollowupDate}
                  placeholder="Pick follow-up date & time..."
                />
              </View>
              <TouchableOpacity
                style={[styles.saveNoteBtn, savingNote && { opacity: 0.7 }]}
                onPress={handleSaveFollowupNote}
                disabled={savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.saveNoteBtnText}>Save Follow-up Note</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Notes History List */}
            <Text style={styles.sectionTitle}>Follow-up Notes History ({followups.length})</Text>
            {followups.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={32} color={themeTokens.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No follow-up notes yet</Text>
                <Text style={styles.emptyDesc}>Type in the box above to log your first call or meeting notes.</Text>
              </View>
            ) : (
              followups.map((f: any) => (
                <View key={f.followup_id || f.id} style={styles.noteItemCard}>
                  <View style={styles.noteItemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="person-circle" size={18} color={themeTokens.colors.primaryDark} />
                      <Text style={styles.noteAuthor}>{f.responsible_name || 'Staff'}</Text>
                    </View>
                    <Text style={styles.noteDate}>
                      {formatDateTime(f.created_at || f.scheduled_at)}
                    </Text>
                  </View>
                  <Text style={styles.noteContent}>{f.notes}</Text>
                  {f.outcome && (
                    <View style={styles.noteOutcomePill}>
                      <Text style={styles.noteOutcomeText}>Outcome: {f.outcome}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: HISTORICAL TIMELINE ("there old timeline what did and all") */}
        {activeTab === 'timeline' && (
          <View>
            <Text style={styles.sectionTitle}>Complete Historical Activity Timeline</Text>
            {timelineEvents.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="time-outline" size={32} color={themeTokens.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No activity history recorded</Text>
              </View>
            ) : (
              <View style={styles.timelineContainer}>
                {timelineEvents.map((ev, idx) => (
                  <View key={ev.id || idx} style={styles.timelineItem}>
                    {/* Left Icon Node */}
                    <View style={styles.timelineNode}>
                      <View
                        style={[
                          styles.timelineCircle,
                          {
                            backgroundColor:
                              ev.type === 'visit' ? '#DBEAFE' : ev.type === 'followup' ? '#FEF3C7' : '#F3E8FF',
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            ev.type === 'visit'
                              ? 'calendar'
                              : ev.type === 'followup'
                              ? 'chatbubble'
                              : 'document-text'
                          }
                          size={14}
                          color={ev.badgeColor}
                        />
                      </View>
                      {idx < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>

                    {/* Right Content Box */}
                    <View style={styles.timelineContentBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={styles.timelineTitle}>{ev.title}</Text>
                        <View style={[styles.timelineBadge, { backgroundColor: ev.badgeColor }]}>
                          <Text style={styles.timelineBadgeText}>{ev.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.timelineSubtitle}>{ev.subtitle}</Text>
                      {ev.details && <Text style={styles.timelineDetails}>{ev.details}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 4: MATCHED PROPERTIES */}
        {activeTab === 'matches' && (
          <View>
            <Text style={styles.sectionTitle}>
              Matched Properties in Active Inventory ({matched_properties.length})
            </Text>
            {matched_properties.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="home-outline" size={32} color={themeTokens.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No matching units found</Text>
                <Text style={styles.emptyDesc}>
                  Try expanding budget range or society preferences in requirements.
                </Text>
              </View>
            ) : (
              matched_properties.map((matchItem: any, idx: number) => {
                const prop = matchItem.property || matchItem;
                return (
                  <View key={prop.property_id || idx} style={styles.matchPropCard}>
                    <View style={styles.matchPropHeader}>
                      <Text style={styles.matchPropId}>{prop.property_id}</Text>
                      <View style={styles.scorePill}>
                        <Text style={styles.scorePillText}>{matchItem.match_score || 95}% Match</Text>
                      </View>
                    </View>

                    <Text style={styles.matchPropSociety}>{prop.society_name}</Text>
                    <Text style={styles.matchPropLocation}>
                      {prop.property_type} • {prop.location}
                    </Text>

                    <View style={styles.matchPropPriceRow}>
                      <Text style={styles.matchPropPrice}>
                        ₹{(prop.expected_amount || 0).toLocaleString()}
                        {prop.transaction_type === 'rent' ? '/mo' : ''}
                      </Text>
                      <TouchableOpacity
                        style={styles.matchScheduleBtn}
                        onPress={() => openScheduleVisitModal(prop)}
                      >
                        <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.matchScheduleBtnText}>Schedule Visit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL 1: ADD REQUIREMENT / WHAT THEY NEED */}
      <Modal visible={addReqModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>+ Add What They Need</Text>
              <TouchableOpacity onPress={() => setAddReqModalVisible(false)}>
                <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Transaction Type *</Text>
              <View style={styles.transRow}>
                <TouchableOpacity
                  style={[styles.transBtn, reqTransType === 'rent' && styles.transBtnActive]}
                  onPress={() => setReqTransType('rent')}
                >
                  <Text style={[styles.transBtnText, reqTransType === 'rent' && styles.transBtnTextActive]}>
                    Rent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.transBtn, reqTransType === 'sale' && styles.transBtnActive]}
                  onPress={() => setReqTransType('sale')}
                >
                  <Text style={[styles.transBtnText, reqTransType === 'sale' && styles.transBtnTextActive]}>
                    Sale / Buy
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Requirement / Looking For *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 2 BHK, 3 BHK + Study in Sector 62"
                placeholderTextColor={themeTokens.colors.textSecondary}
                value={reqLookingFor}
                onChangeText={setReqLookingFor}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Min Budget (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 25000"
                    placeholderTextColor={themeTokens.colors.textSecondary}
                    keyboardType="numeric"
                    value={reqBudgetMin}
                    onChangeText={setReqBudgetMin}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Max Budget (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 35000"
                    placeholderTextColor={themeTokens.colors.textSecondary}
                    keyboardType="numeric"
                    value={reqBudgetMax}
                    onChangeText={setReqBudgetMax}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <DateTimePickerField
                  mode="date"
                  label="Target Move-in / Possession Date (Optional)"
                  value={reqMoveInDate}
                  onChangeValue={setReqMoveInDate}
                  placeholder="Select target date from calendar..."
                />
              </View>

              <Text style={styles.formLabel}>Special Notes / Client Preferences</Text>
              <TextInput
                style={[styles.modalInput, { height: 70 }]}
                placeholder="Client preferences, furnishing preferences, etc."
                placeholderTextColor={themeTokens.colors.textSecondary}
                multiline
                value={reqNotes}
                onChangeText={setReqNotes}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, savingReq && { opacity: 0.7 }]}
              onPress={handleCreateRequirement}
              disabled={savingReq}
            >
              {savingReq ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Requirement</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT CUSTOMER PROFILE */}
      <Modal visible={editProfileVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer Details</Text>
              <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Customer Name"
                placeholderTextColor={themeTokens.colors.textSecondary}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={styles.formLabel}>Alternate Phone</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Secondary contact number"
                placeholderTextColor={themeTokens.colors.textSecondary}
                keyboardType="phone-pad"
                value={editAltPhone}
                onChangeText={setEditAltPhone}
              />

              <Text style={styles.formLabel}>WhatsApp Phone</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="WhatsApp number"
                placeholderTextColor={themeTokens.colors.textSecondary}
                keyboardType="phone-pad"
                value={editWaPhone}
                onChangeText={setEditWaPhone}
              />

              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.transRow}>
                {(['hot', 'warm', 'cold'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.transBtn, editPriority === p && styles.transBtnActive]}
                    onPress={() => setEditPriority(p)}
                  >
                    <Text style={[styles.transBtnText, editPriority === p && styles.transBtnTextActive]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Customer Type</Text>
              <View style={styles.transRow}>
                {(['tenant', 'buyer', 'owner', 'agent'] as const).map((ct) => (
                  <TouchableOpacity
                    key={ct}
                    style={[styles.transBtn, editCustType === ct && styles.transBtnActive]}
                    onPress={() => setEditCustType(ct)}
                  >
                    <Text style={[styles.transBtnText, editCustType === ct && styles.transBtnTextActive]}>
                      {ct.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, savingProfile && { opacity: 0.7 }]}
              onPress={handleUpdateProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Update Customer Details</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: SCHEDULE SITE SHOWING VISIT */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar" size={20} color={themeTokens.colors.primaryDark} />
                <Text style={styles.modalTitle}>Schedule Site Visit</Text>
              </View>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Selected Property Preview Banner */}
              {scheduleTargetProp && (
                <View style={styles.schedulePropCard}>
                  <View style={styles.schedulePropHeader}>
                    <Text style={styles.schedulePropId}>#{scheduleTargetProp.property_id}</Text>
                    <View style={styles.schedulePropBadge}>
                      <Text style={styles.schedulePropBadgeText}>
                        {scheduleTargetProp.transaction_type === 'rent' ? 'FOR RENT' : 'FOR SALE'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.schedulePropSociety}>{scheduleTargetProp.society_name}</Text>
                  <Text style={styles.schedulePropMeta}>
                    {scheduleTargetProp.bhk || scheduleTargetProp.property_type || 'Residential'} • {scheduleTargetProp.location || 'Prime Location'}
                  </Text>
                  <Text style={styles.schedulePropPrice}>
                    ₹{(scheduleTargetProp.expected_amount || 0).toLocaleString('en-IN')}
                    {scheduleTargetProp.transaction_type === 'rent' ? '/month' : ''}
                  </Text>
                </View>
              )}

              {/* Customer Info Row */}
              {customer && (
                <View style={styles.scheduleCustRow}>
                  <Ionicons name="person-circle-outline" size={18} color="#4F5278" />
                  <Text style={styles.scheduleCustText}>
                    Client: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{customer.name}</Text> ({customer.primary_phone})
                  </Text>
                </View>
              )}

              {/* Enquiry / Requirement Selector */}
              <Text style={styles.formLabel}>Target Requirement / Enquiry *</Text>
              {enquiries.length === 0 ? (
                <View style={styles.noEnqWarningBox}>
                  <Text style={styles.noEnqWarningText}>
                    This customer has no active requirements. Please add a requirement first.
                  </Text>
                </View>
              ) : enquiries.length === 1 ? (
                <View style={styles.singleEnqBox}>
                  <Text style={styles.singleEnqId}>#{enquiries[0].enquiry_id}</Text>
                  <Text style={styles.singleEnqReq}>{enquiries[0].looking_for || 'Client Requirement'}</Text>
                </View>
              ) : (
                <View style={{ gap: 6, marginBottom: 12 }}>
                  {enquiries.map((e) => (
                    <TouchableOpacity
                      key={e.enquiry_id}
                      style={[
                        styles.enqSelectPill,
                        scheduleSelectedEnquiryId === e.enquiry_id && styles.enqSelectPillActive,
                      ]}
                      onPress={() => setScheduleSelectedEnquiryId(e.enquiry_id)}
                    >
                      <Ionicons
                        name={scheduleSelectedEnquiryId === e.enquiry_id ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={scheduleSelectedEnquiryId === e.enquiry_id ? '#4F5278' : '#94A3B8'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.enqSelectId, scheduleSelectedEnquiryId === e.enquiry_id && { color: '#4F5278' }]}>
                          #{e.enquiry_id} • {e.transaction_type?.toUpperCase()}
                        </Text>
                        <Text style={styles.enqSelectDesc} numberOfLines={1}>
                          {e.looking_for || 'Requirement'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Date & Time Picker */}
              <View style={{ marginVertical: 6 }}>
                <DateTimePickerField
                  label="Showing Date & Time *"
                  value={scheduleDate}
                  onChangeValue={setScheduleDate}
                  placeholder="Select visit date & time..."
                  required
                />
              </View>

              {/* Instructions / Notes */}
              <Text style={styles.formLabel}>Showing Instructions / Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 64, textAlignVertical: 'top' }]}
                placeholder="e.g. Client requested evening showing, wants clubhouse tour"
                placeholderTextColor={themeTokens.colors.textSecondary}
                multiline
                numberOfLines={2}
                value={scheduleNotes}
                onChangeText={setScheduleNotes}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { flex: 1, backgroundColor: '#E2E8F0', marginTop: 0 }]}
                onPress={() => setScheduleModalVisible(false)}
              >
                <Text style={[styles.modalSubmitBtnText, { color: '#475569' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  { flex: 1.5, marginTop: 0 },
                  (schedulingVisit || !scheduleSelectedEnquiryId || !scheduleDate) && { opacity: 0.6 },
                ]}
                onPress={handleConfirmScheduleVisit}
                disabled={schedulingVisit || !scheduleSelectedEnquiryId || !scheduleDate}
              >
                {schedulingVisit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Confirm Visit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: ENQUIRY DOSSIER & DETAIL */}
      {selectedEnquiry && (
        <Modal visible={Boolean(selectedEnquiry)} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Enquiry #{selectedEnquiry.enquiry_id}</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Full Client Requirement Dossier
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedEnquiry(null)}>
                  <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {/* Status & Transaction Type */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={[styles.priorityPill, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.priorityText, { color: '#3730A3' }]}>
                      {(selectedEnquiry.transaction_type || 'Rent').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{(selectedEnquiry.status || 'NEW').toUpperCase()}</Text>
                  </View>
                </View>

                {/* Requirement Info */}
                <View style={styles.enquiryDossierSection}>
                  <Text style={styles.enquiryDossierLabel}>LOOKING FOR</Text>
                  <Text style={styles.enquiryDossierValue}>{selectedEnquiry.looking_for}</Text>
                </View>

                <View style={styles.enquiryDossierSection}>
                  <Text style={styles.enquiryDossierLabel}>BUDGET RANGE</Text>
                  <Text style={[styles.enquiryDossierValue, { color: '#057A55', fontWeight: '800' }]}>
                    ₹{(selectedEnquiry.budget_min || 0).toLocaleString('en-IN')} - ₹{(selectedEnquiry.budget_max || 0).toLocaleString('en-IN')}
                    {selectedEnquiry.transaction_type === 'rent' ? '/mo' : ''}
                  </Text>
                </View>

                {selectedEnquiry.preferred_societies && selectedEnquiry.preferred_societies.length > 0 && (
                  <View style={styles.enquiryDossierSection}>
                    <Text style={styles.enquiryDossierLabel}>PREFERRED SOCIETIES</Text>
                    <Text style={styles.enquiryDossierValue}>{selectedEnquiry.preferred_societies.join(', ')}</Text>
                  </View>
                )}

                {selectedEnquiry.notes && (
                  <View style={styles.enquiryDossierSection}>
                    <Text style={styles.enquiryDossierLabel}>NOTES & REMARKS</Text>
                    <View style={styles.visitNotesBox}>
                      <Text style={styles.visitNotesText}>&quot;{selectedEnquiry.notes}&quot;</Text>
                    </View>
                  </View>
                )}

                {/* Customer Contact Direct Actions */}
                <View style={styles.enquiryContactBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: themeTokens.colors.textPrimary }}>
                      {customer.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                      {customer.primary_phone}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.miniCallBtn} onPress={handleCall}>
                      <Ionicons name="call" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniWaBtn} onPress={handleWhatsApp}>
                      <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons in Footer */}
              <View style={styles.enquiryDossierFooter}>
                <TouchableOpacity
                  style={styles.dossierActionBtnSecondary}
                  onPress={() => {
                    setSelectedEnquiry(null);
                    setActiveTab('matches');
                  }}
                >
                  <Ionicons name="home-outline" size={14} color={themeTokens.colors.primaryDark} />
                  <Text style={styles.dossierActionBtnSecondaryText}>View Matches</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dossierActionBtnPrimary}
                  onPress={() => {
                    const enq = selectedEnquiry;
                    setSelectedEnquiry(null);
                    openScheduleVisitModal(undefined, enq);
                  }}
                >
                  <Ionicons name="calendar" size={14} color="#FFFFFF" />
                  <Text style={styles.dossierActionBtnPrimaryText}>Schedule Visit</Text>
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
    backgroundColor: '#F8FAFC',
    paddingTop: STATUSBAR_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingTop: STATUSBAR_HEIGHT,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: themeTokens.colors.textSecondary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hotPill: {
    backgroundColor: '#FEE2E2',
  },
  warmPill: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  actionCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionWaBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionAddReqBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.primaryDark,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: themeTokens.colors.softSurface,
    paddingVertical: 4,
  },
  kpiCardActive: {
    backgroundColor: '#EEF0F8',
    borderRadius: 8,
  },
  kpiNumberActive: {
    color: themeTokens.colors.primaryDark,
  },
  kpiLabelActive: {
    color: themeTokens.colors.primaryDark,
    fontWeight: '700',
  },
  kpiNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  tabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: themeTokens.colors.primaryDark,
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  activeTabItemText: {
    color: themeTokens.colors.primaryDark,
    fontWeight: '800',
  },
  viewDetailPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewDetailPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
  },
  visitHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  visitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  visitPropTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  visitPropSubtitle: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  visitDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  visitDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  executivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  executivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  outcomeBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  outcomeBoxText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  visitNotesBox: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  visitNotesText: {
    fontSize: 11,
    color: '#334155',
    fontStyle: 'italic',
  },
  visitCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 8,
  },
  visitFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  visitFooterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  enquiryDossierSection: {
    marginBottom: 12,
  },
  enquiryDossierLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  enquiryDossierValue: {
    fontSize: 13,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  enquiryContactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 12,
  },
  miniCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniWaBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enquiryDossierFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 6,
  },
  dossierActionBtnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.primaryDark,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dossierActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dossierActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF0F8',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dossierActionBtnSecondaryText: {
    color: themeTokens.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
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
  },
  addMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  enquiryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  enquiryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enquiryId: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: themeTokens.colors.primaryDark,
  },
  statusBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  enquiryReqText: {
    fontSize: 14,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginTop: 6,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  budgetLabel: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
  },
  budgetValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  societyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  societyLabel: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  societyValue: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  enquiryNotes: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  enquiryActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: themeTokens.colors.softSurface,
  },
  enqScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  enqScheduleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.primaryDark,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginTop: 12,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.softSurface,
  },
  infoKey: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  noteWriterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  writerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: themeTokens.colors.softSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 10,
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
    textAlignVertical: 'top',
    height: 75,
  },
  saveNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.primaryDark,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
  },
  saveNoteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  noteItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  noteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  noteDate: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
  },
  noteContent: {
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
    lineHeight: 18,
  },
  noteOutcomePill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  noteOutcomeText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
  },
  timelineContainer: {
    marginTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineNode: {
    alignItems: 'center',
    marginRight: 12,
    width: 24,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: themeTokens.colors.border,
    marginTop: 4,
  },
  timelineContentBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 12,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    flex: 1,
  },
  timelineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  timelineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timelineSubtitle: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  timelineDetails: {
    fontSize: 12,
    color: themeTokens.colors.textPrimary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  matchPropCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  matchPropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchPropId: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: themeTokens.colors.primaryDark,
  },
  scorePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  matchPropSociety: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginTop: 4,
  },
  matchPropLocation: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  matchPropPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: themeTokens.colors.softSurface,
  },
  matchPropPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  matchScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  matchScheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  transRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  transBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    alignItems: 'center',
  },
  transBtnActive: {
    backgroundColor: themeTokens.colors.primaryDark,
    borderColor: themeTokens.colors.primaryDark,
  },
  transBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  transBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: themeTokens.colors.softSurface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 8,
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
    marginBottom: 6,
  },
  modalSubmitBtn: {
    backgroundColor: themeTokens.colors.primaryDark,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  schedulePropCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 12,
    marginBottom: 12,
  },
  schedulePropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  schedulePropId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6D28D9',
  },
  schedulePropBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  schedulePropBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6D28D9',
  },
  schedulePropSociety: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  schedulePropMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  schedulePropPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  scheduleCustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  scheduleCustText: {
    fontSize: 12,
    color: '#475569',
  },
  noEnqWarningBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  noEnqWarningText: {
    fontSize: 12,
    color: '#B91C1C',
  },
  singleEnqBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  singleEnqId: {
    fontSize: 12,
    fontWeight: '800',
    color: themeTokens.colors.primaryDark,
    marginBottom: 2,
  },
  singleEnqReq: {
    fontSize: 12,
    color: '#334155',
  },
  enqSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  enqSelectPillActive: {
    borderColor: '#4F5278',
    backgroundColor: '#F8FAFC',
  },
  enqSelectId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  enqSelectDesc: {
    fontSize: 11,
    color: '#64748B',
  },
});
