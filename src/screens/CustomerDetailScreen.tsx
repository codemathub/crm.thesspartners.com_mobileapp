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

interface CustomerDetailScreenProps {
  customerId: string;
  onClose: () => void;
  onScheduleVisit?: (customer: MobileCustomer, enquiry?: MobileEnquiry) => void;
}

type TabMode = 'requirements' | 'notes' | 'timeline' | 'matches';

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
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    const eventDate = rawDate ? new Date(rawDate) : new Date();
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
    const eventDate = rawDate ? new Date(rawDate) : new Date();
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
    const eventDate = rawDate ? new Date(rawDate) : new Date();
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

      {/* KPI Stats Bar */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNumber}>{stats?.total_enquiries || enquiries.length}</Text>
          <Text style={styles.kpiLabel}>Requirements</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNumber}>{stats?.total_visits || visits.length}</Text>
          <Text style={styles.kpiLabel}>Visits</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNumber}>{stats?.total_followups || followups.length}</Text>
          <Text style={styles.kpiLabel}>Notes</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: '#16A34A' }]}>
            {stats?.matched_properties_count || matched_properties.length}
          </Text>
          <Text style={styles.kpiLabel}>Matched</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'requirements' && styles.activeTabItem]}
          onPress={() => setActiveTab('requirements')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={activeTab === 'requirements' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
          />
          <Text style={[styles.tabItemText, activeTab === 'requirements' && styles.activeTabItemText]}>
            Requirements ({enquiries.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'notes' && styles.activeTabItem]}
          onPress={() => setActiveTab('notes')}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={activeTab === 'notes' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
          />
          <Text style={[styles.tabItemText, activeTab === 'notes' && styles.activeTabItemText]}>
            Notes ({followups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'timeline' && styles.activeTabItem]}
          onPress={() => setActiveTab('timeline')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'timeline' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
          />
          <Text style={[styles.tabItemText, activeTab === 'timeline' && styles.activeTabItemText]}>
            Timeline ({timelineEvents.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'matches' && styles.activeTabItem]}
          onPress={() => setActiveTab('matches')}
        >
          <Ionicons
            name="home-outline"
            size={16}
            color={activeTab === 'matches' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
          />
          <Text style={[styles.tabItemText, activeTab === 'matches' && styles.activeTabItemText]}>
            Matches ({matched_properties.length})
          </Text>
        </TouchableOpacity>
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
                <View key={enq.enquiry_id || enq.id} style={styles.enquiryCard}>
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
                      onPress={() => onScheduleVisit && onScheduleVisit(customer, enq)}
                    >
                      <Ionicons name="calendar-outline" size={14} color={themeTokens.colors.primaryDark} />
                      <Text style={styles.enqScheduleBtnText}>Schedule Site Visit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                      {new Date(f.created_at || f.scheduled_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
                        onPress={() => onScheduleVisit && onScheduleVisit(customer)}
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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
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
});
