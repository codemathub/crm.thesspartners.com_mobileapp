import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { EmptyState } from '../components/ui/EmptyState';
import {
  mobileApi,
  MobileEnquiry,
  MobileCustomer,
  MobilePropertyMatchItem,
  MobileSociety,
  AutocompleteSuggestion,
  validateMobileNumber,
} from '../services/api';
import { CustomerDetailScreen } from './CustomerDetailScreen';
import { DuplicateCheckModal } from '../components/DuplicateCheckModal';
import { DateTimePickerField } from '../components/DateTimePickerModal';
import { formatDateTime } from '../utils/dateUtils';

const safeLocale = (val: any): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-IN');
};

interface EnquiriesScreenProps {
  onAddEnquiry?: () => void;
  onSelectEnquiry?: (enquiryId: string, propertyId?: string) => void;
  initialAction?: string;
  onActionHandled?: () => void;
  targetCustomerId?: string;
  onClearTargetCustomerId?: () => void;
  targetEnquiryId?: string;
  onClearTargetEnquiryId?: () => void;
}

export const EnquiriesScreen: React.FC<EnquiriesScreenProps> = ({
  onAddEnquiry,
  onSelectEnquiry,
  initialAction,
  onActionHandled,
  targetCustomerId,
  onClearTargetCustomerId,
  targetEnquiryId,
  onClearTargetEnquiryId,
}) => {
  const [enquiries, setEnquiries] = useState<MobileEnquiry[]>([]);
  const [customers, setCustomers] = useState<MobileCustomer[]>([]);
  const [societies, setSocieties] = useState<MobileSociety[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<'All' | 'New' | 'Follow-up' | 'Visit Scheduled' | 'Hot' | 'History'>('All');

  // Live Autocomplete Suggestions
  const [liveSuggestions, setLiveSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Customer 360 Full Screen & Duplicate Checker State
  const [customer360Id, setCustomer360Id] = useState<string | null>(null);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<(MobileCustomer & { enquiriesList: MobileEnquiry[] }) | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<MobileEnquiry | null>(null);
  const [enquiryTimeline, setEnquiryTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineNote, setTimelineNote] = useState('');
  const [savingTimelineNote, setSavingTimelineNote] = useState(false);
  const [closeDealVisible, setCloseDealVisible] = useState(false);
  const [dealPropId, setDealPropId] = useState('');
  const [dealPrice, setDealPrice] = useState('');
  const [dealRemarks, setDealRemarks] = useState('');
  const [savingDeal, setSavingDeal] = useState(false);
  const [abortVisible, setAbortVisible] = useState(false);
  const [abortReason, setAbortReason] = useState('');
  const [savingAbort, setSavingAbort] = useState(false);

  // Sort State
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'name_asc' | 'name_desc' | 'enquiries_desc' | 'oldest'>('newest');

  // Add Customer / Enquiry Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [societyModalVisible, setSocietyModalVisible] = useState(false);

  useEffect(() => {
    if (initialAction === 'new' || initialAction === 'ADD_ENQUIRY') {
      setAddModalVisible(true);
      if (onActionHandled) onActionHandled();
    }
  }, [initialAction]);

  useEffect(() => {
    if (targetCustomerId) {
      setCustomer360Id(targetCustomerId);
      if (onClearTargetCustomerId) onClearTargetCustomerId();
    }
  }, [targetCustomerId]);

  useEffect(() => {
    if (targetEnquiryId) {
      const found = enquiries.find((e) => e.enquiry_id === targetEnquiryId);
      if (found) {
        setSelectedEnquiry(found);
      } else {
        for (const c of customers as any[]) {
          const matched = c.enquiriesList?.find((e: any) => e.enquiry_id === targetEnquiryId);
          if (matched) {
            setSelectedEnquiry(matched);
            break;
          }
        }
      }
      if (onClearTargetEnquiryId) onClearTargetEnquiryId();
    }
  }, [targetEnquiryId, enquiries, customers]);

  // Customer Fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAltPhone, setCustAltPhone] = useState('');
  const [custWaPhone, setCustWaPhone] = useState('');
  const [customerType, setCustomerType] = useState<'tenant' | 'buyer' | 'agent' | 'owner'>('tenant');
  const [custPriority, setCustPriority] = useState<'hot' | 'warm' | 'cold'>('hot');
  const [leadSource, setLeadSource] = useState('Walk-in');

  // Enquiry Fields
  const [transactionType, setTransactionType] = useState<'rent' | 'sale'>('rent');
  const [lookingFor, setLookingFor] = useState('3 BHK');
  const [preferredSocietyId, setPreferredSocietyId] = useState('');
  const [preferredSocietyName, setPreferredSocietyName] = useState('');
  const [preferredLoc, setPreferredLoc] = useState('Sector 62 Gurgaon');
  const [budgetMin, setBudgetMin] = useState('50000');
  const [budgetMax, setBudgetMax] = useState('70000');
  const [tenantPreference, setTenantPreference] = useState('Family Only');
  const [expectedMoveInDate, setExpectedMoveInDate] = useState('');
  const [enqNotes, setEnqNotes] = useState('');
  const [savingEnq, setSavingEnq] = useState(false);

  // Duplicate phone state (Stitch Image 6)
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [sharedReason, setSharedReason] = useState('');
  const [forceSeparateProfile, setForceSeparateProfile] = useState(false);

  // Matches Modal State (Stitch Image 4)
  const [matchesModalVisible, setMatchesModalVisible] = useState(false);
  const [matchingEnquiry, setMatchingEnquiry] = useState<MobileEnquiry | null>(null);
  const [matchesList, setMatchesList] = useState<MobilePropertyMatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const openMatchesModal = async (enquiry: MobileEnquiry) => {
    setMatchingEnquiry(enquiry);
    setMatchesModalVisible(true);
    setLoadingMatches(true);
    setMatchesList([]);
    try {
      const res = await mobileApi.getEnquiryMatches(enquiry.enquiry_id);
      setMatchesList(res.matches || []);
    } catch (err: any) {
      Alert.alert('Match Engine Error', err.message || 'Could not fetch matching properties.');
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (text.trim().length >= 1) {
      setSearchLoading(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await mobileApi.getSuggestions(text.trim(), 'enquiry', 6);
          setLiveSuggestions(res.suggestions || []);
          setIsSearchSuggestionsOpen((res.suggestions || []).length > 0);
        } catch {
          setLiveSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
        fetchDirectoryWithQuery(text.trim());
      }, 250);
    } else {
      setLiveSuggestions([]);
      setIsSearchSuggestionsOpen(false);
      setSearchLoading(false);
      searchDebounceRef.current = setTimeout(() => {
        fetchDirectoryWithQuery('');
      }, 250);
    }
  };

  const fetchDirectoryWithQuery = async (queryText?: string) => {
    try {
      const q = queryText !== undefined ? queryText : searchQuery;
      const [enqRes, custRes, socRes] = await Promise.all([
        mobileApi.getEnquiries(q.trim() || undefined, undefined, activeChip === 'History' ? false : true),
        mobileApi.getCustomers(q.trim() || undefined),
        mobileApi.getSocieties(),
      ]);
      setEnquiries(enqRes.items || []);
      setCustomers(custRes.items || []);
      setSocieties(socRes);
      if (socRes.length > 0 && !preferredSocietyId) {
        setPreferredSocietyId(socRes[0].society_id || socRes[0].id);
        setPreferredSocietyName(socRes[0].name);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelectEnquiryItem = async (enq: MobileEnquiry) => {
    setSelectedEnquiry(enq);
    setLoadingTimeline(true);
    try {
      const res = await mobileApi.getEnquiryTimeline(enq.enquiry_id);
      setEnquiryTimeline(res.events || []);
    } catch {
      setEnquiryTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleAddTimelineNote = async () => {
    if (!selectedEnquiry || !timelineNote.trim()) return;
    setSavingTimelineNote(true);
    try {
      await mobileApi.createFollowUp({
        enquiry_id: selectedEnquiry.enquiry_id,
        scheduled_at: new Date().toISOString(),
        notes: timelineNote.trim(),
      });
      setTimelineNote('');
      const res = await mobileApi.getEnquiryTimeline(selectedEnquiry.enquiry_id);
      setEnquiryTimeline(res.events || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save follow-up note.');
    } finally {
      setSavingTimelineNote(false);
    }
  };

  const handleConfirmCloseDeal = async () => {
    if (!selectedEnquiry) return;
    if (!dealPropId.trim()) {
      Alert.alert('Required', 'Please enter the Property ID being closed.');
      return;
    }
    setSavingDeal(true);
    try {
      await mobileApi.closeEnquiryDeal(selectedEnquiry.enquiry_id, {
        property_id: dealPropId.trim().toUpperCase(),
        deal_amount: dealPrice ? Number(dealPrice) : undefined,
        final_remarks: dealRemarks.trim() || undefined,
      });
      Alert.alert('Deal Closed!', `Enquiry ${selectedEnquiry.enquiry_id} closed and Property ${dealPropId.trim().toUpperCase()} marked as ${selectedEnquiry.transaction_type === 'rent' ? 'Rented' : 'Sold'}.`);
      setCloseDealVisible(false);
      setSelectedEnquiry(null);
      setDealPropId('');
      setDealPrice('');
      setDealRemarks('');
      fetchDirectory();
    } catch (err: any) {
      Alert.alert('Close Deal Failed', err.message || 'Could not close deal.');
    } finally {
      setSavingDeal(false);
    }
  };

  const handleConfirmAbort = async () => {
    if (!selectedEnquiry) return;
    if (!abortReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for aborting this enquiry.');
      return;
    }
    setSavingAbort(true);
    try {
      await mobileApi.abortEnquiry(selectedEnquiry.enquiry_id, {
        reason: abortReason.trim(),
      });
      Alert.alert('Enquiry Aborted', `Enquiry ${selectedEnquiry.enquiry_id} has been dropped.`);
      setAbortVisible(false);
      setSelectedEnquiry(null);
      setAbortReason('');
      fetchDirectory();
    } catch (err: any) {
      Alert.alert('Abort Failed', err.message || 'Could not abort enquiry.');
    } finally {
      setSavingAbort(false);
    }
  };

  const fetchDirectory = () => fetchDirectoryWithQuery();

  useEffect(() => {
    fetchDirectory();
  }, [activeChip]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDirectory();
  };

  const handlePhoneBlur = async () => {
    if (!custPhone.trim() || custPhone.trim().length < 8) return;
    try {
      const res = await mobileApi.checkDuplicatePhone(custPhone.trim());
      if (res.has_duplicate) {
        setDuplicateWarning(res.matches[0]);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateCustomerEnquiry = async () => {
    const cleanCustName = custName.trim();
    const cleanCustPhone = custPhone.trim();

    if (!cleanCustName || cleanCustName.length < 2) {
      Alert.alert('Required Field', 'Customer Name is compulsory (min 2 characters).');
      return;
    }

    const phoneVal = validateMobileNumber(cleanCustPhone, 'Customer Mobile Number');
    if (!phoneVal.valid) {
      Alert.alert('Compulsory Mobile Number', phoneVal.error);
      return;
    }

    if (custAltPhone.trim()) {
      const altVal = validateMobileNumber(custAltPhone.trim(), 'Alternate Phone');
      if (!altVal.valid) {
        Alert.alert('Invalid Alternate Phone', altVal.error);
        return;
      }
    }

    if (duplicateWarning && !sharedReason.trim() && forceSeparateProfile) {
      Alert.alert('Policy Requirement', 'Duplicate phone number detected. Shared phone reason is required.');
      return;
    }

    setSavingEnq(true);
    try {
      let targetCustomerId: string;

      // If linking to existing customer from duplicate match
      if (duplicateWarning && !forceSeparateProfile) {
        targetCustomerId = duplicateWarning.customer_id;
      } else {
        const custPayload: any = {
          name: cleanCustName,
          primary_phone: cleanCustPhone,
          alternate_phone: custAltPhone.trim() || undefined,
          whatsapp_phone: custWaPhone.trim() || undefined,
          customer_type: customerType,
          priority: custPriority,
          lead_source: leadSource,
          notes: enqNotes.trim() || undefined,
          shared_phone_reason: forceSeparateProfile && duplicateWarning ? sharedReason.trim() : undefined,
        };
        const custRes = await mobileApi.createCustomer(custPayload);
        targetCustomerId = custRes.customer_id;
      }

      let finalEnqNotes = enqNotes.trim();
      if (expectedMoveInDate) {
        const moveInStr = new Date(expectedMoveInDate).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        finalEnqNotes = finalEnqNotes ? `${finalEnqNotes} | Target Move-in: ${moveInStr}` : `Target Move-in: ${moveInStr}`;
      }

      // Create linked enquiry with full parameters
      await mobileApi.createEnquiry({
        customer_id: targetCustomerId,
        transaction_type: transactionType,
        looking_for: lookingFor.trim(),
        budget_min: budgetMin ? parseFloat(budgetMin) : 0,
        budget_max: budgetMax ? parseFloat(budgetMax) : 0,
        preferred_locations: preferredLoc.trim() ? [preferredLoc.trim()] : undefined,
        preferred_societies: preferredSocietyName ? [preferredSocietyName] : undefined,
        tenant_type: tenantPreference,
        priority: custPriority,
        notes: finalEnqNotes || undefined,
      });

      Alert.alert('Success', 'Customer profile and enquiry registered successfully.');
      setAddModalVisible(false);
      setCustName('');
      setCustPhone('');
      setCustAltPhone('');
      setCustWaPhone('');
      setExpectedMoveInDate('');
      setEnqNotes('');
      setDuplicateWarning(null);
      setSharedReason('');
      setForceSeparateProfile(false);
      fetchDirectory();
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not create enquiry.');
    } finally {
      setSavingEnq(false);
    }
  };

  // Group enquiries by customer and sort
  const groupedCustomers = customers.map((c) => {
    const custEnquiries = enquiries.filter((e) => e.customer_id === c.customer_id);
    return {
      ...c,
      enquiriesList: custEnquiries,
    };
  });

  if (sortBy === 'name_asc') {
    groupedCustomers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy === 'name_desc') {
    groupedCustomers.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (sortBy === 'enquiries_desc') {
    groupedCustomers.sort((a, b) => (b.enquiriesList?.length || 0) - (a.enquiriesList?.length || 0));
  } else if (sortBy === 'oldest') {
    groupedCustomers.sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
  } else {
    // 'newest' default
    groupedCustomers.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
  }

  return (
    <View style={styles.container}>
      {/* Search Header matching Stitch Image 2 */}
      <View style={styles.searchHeader}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Customer Directory</Text>
            <Text style={styles.headerSubtitle}>
              ● {enquiries.length} active customer pipelines & enquiries
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.checkDuplicateHeaderBtn}
              onPress={() => setDuplicateModalVisible(true)}
            >
              <Ionicons name="copy-outline" size={13} color="#991B1B" />
              <Text style={styles.checkDuplicateHeaderBtnText}>Check Duplicates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortBtn,
                sortBy !== 'newest' && { backgroundColor: '#EEF0F8', borderColor: '#4F5278', borderWidth: 1 },
              ]}
              onPress={() => setSortModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-vertical"
                size={18}
                color={sortBy !== 'newest' ? '#4F5278' : themeTokens.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search input with live autocomplete */}
        <View style={styles.searchInputBox}>
          <Ionicons name="search" size={16} color={themeTokens.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, phone, #ENQ, location (2-3 chars)..."
            value={searchQuery}
            onChangeText={handleSearchTextChange}
            onSubmitEditing={fetchDirectory}
            placeholderTextColor="#9CA3AF"
          />
          {searchLoading && <ActivityIndicator size="small" color="#4F5278" style={{ marginRight: 4 }} />}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchTextChange('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Live Suggestions Dropdown */}
      {isSearchSuggestionsOpen && liveSuggestions.length > 0 && (
        <View style={styles.liveSuggestionsDropdown}>
          <View style={styles.liveSuggestionsHeader}>
            <Text style={styles.liveSuggestionsHeaderText}>
              QUICK MATCHES ({liveSuggestions.length})
            </Text>
            <TouchableOpacity onPress={() => setIsSearchSuggestionsOpen(false)}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6366F1' }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          {liveSuggestions.map((sug) => (
            <TouchableOpacity
              key={`${sug.entity_type}-${sug.id}`}
              style={styles.liveSuggestionRow}
              onPress={() => {
                setSearchQuery(sug.id);
                setIsSearchSuggestionsOpen(false);
                if (sug.entity_type === 'customer') {
                  setCustomer360Id(sug.id);
                } else if (sug.extra?.customer_id) {
                  setCustomer360Id(sug.extra.customer_id);
                } else {
                  fetchDirectoryWithQuery(sug.id);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.liveSuggestionIconBox}>
                <Ionicons name={sug.entity_type === 'customer' ? 'person' : 'search'} size={14} color="#4F5278" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.liveSuggestionTitle} numberOfLines={1}>
                    {sug.title}
                  </Text>
                  <View
                    style={[
                      styles.badgePillSmall,
                      { backgroundColor: sug.badge.toUpperCase() === 'HOT' ? '#FDE8E8' : '#EEF0F8' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: sug.badge.toUpperCase() === 'HOT' ? '#9B1C1C' : '#4F5278',
                      }}
                    >
                      {sug.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.liveSuggestionSubtitle} numberOfLines={1}>
                  {sug.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter Chips Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'All', label: `Active (${customers.length})` },
            { id: 'New', label: 'New' },
            { id: 'Follow-up', label: 'Follow-up' },
            { id: 'Visit Scheduled', label: 'Visit Scheduled' },
            { id: 'Hot', label: 'Hot Leads' },
            { id: 'History', label: 'Closed / History' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[styles.filterChip, activeChip === chip.id && styles.filterChipActive]}
              onPress={() => setActiveChip(chip.id as any)}
            >
              <Text style={[styles.filterChipText, activeChip === chip.id && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Urgency Legend matching Stitch Image 2 */}
      <View style={styles.urgencyLegendRow}>
        <Text style={styles.urgencyLabel}>URGENCY:</Text>
        <View style={styles.hotPill}>
          <Text style={styles.hotPillText}>● Hot Lead</Text>
        </View>
        <View style={styles.warmPill}>
          <Text style={styles.warmPillText}>● Warm</Text>
        </View>
        <View style={styles.coldPill}>
          <Text style={styles.coldPillText}>● Cold</Text>
        </View>
      </View>

      {/* Customer Directory List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeTokens.colors.primaryDark} />
          <Text style={styles.loadingText}>Loading customer pipelines...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.cardsScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {groupedCustomers.length === 0 ? (
            <EmptyState
              title="No customer pipelines"
              description="Register client requirements using the + Add Customer / Enquiry button."
              iconName="people-outline"
            />
          ) : (
            groupedCustomers.map((cust) => {
              const initials = cust.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <TouchableOpacity
                  key={cust.id || cust.customer_id}
                  style={styles.customerCard}
                  onPress={() => setCustomer360Id(cust.customer_id)}
                  activeOpacity={0.9}
                >
                  {/* Customer Header */}
                  <View style={styles.customerHeaderRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.customerName}>{cust.name}</Text>
                        <View
                          style={[
                            styles.hotBadge,
                            cust.priority === 'warm' && { backgroundColor: '#FEF3C7' },
                            cust.priority === 'cold' && { backgroundColor: '#F3F4F6' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.hotBadgeText,
                              cust.priority === 'warm' && { color: '#92400E' },
                              cust.priority === 'cold' && { color: '#4B5563' },
                            ]}
                          >
                            {cust.priority === 'hot' ? '🔥 Hot' : cust.priority === 'warm' ? '⚡ Warm' : '❄️ Cold'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.custMetaText}>
                        Cust ID: {cust.customer_id} •{' '}
                        {cust.customer_type ? cust.customer_type.toUpperCase() : 'TENANT'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dotsBtn}
                      onPress={() => setCustomer360Id(cust.customer_id)}
                    >
                      <Ionicons name="ellipsis-vertical" size={16} color={themeTokens.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Contact Row */}
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={13} color={themeTokens.colors.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.phoneText}>
                      {cust.primary_phone}
                    </Text>
                    <View style={styles.whatsappDotRow}>
                      <View style={styles.whatsappDot} />
                      <Text style={styles.whatsappText}>WhatsApp Active</Text>
                    </View>
                  </View>

                  {/* Active Enquiries Subheader */}
                  <View style={styles.enquiriesSubheader}>
                    <Text style={styles.enqCountText}>
                      ⚡ {cust.enquiriesList.length} {activeChip === 'History' ? 'PAST ENQUIRIES' : 'ACTIVE ENQUIRIES'}
                    </Text>
                    <Text style={styles.matchScoreText}>{cust.customer_type ? cust.customer_type.toUpperCase() : 'LEAD'}</Text>
                  </View>

                  {/* Nested Enquiries Cards */}
                  <View style={styles.nestedEnquiriesContainer}>
                    {cust.enquiriesList.length === 0 ? (
                      <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary, fontStyle: 'italic' }}>
                        No open enquiries currently active.
                      </Text>
                    ) : (
                      cust.enquiriesList.map((enq) => (
                        <TouchableOpacity
                          key={enq.enquiry_id}
                          style={styles.enquiryItemBox}
                          onPress={() => handleSelectEnquiryItem(enq)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.enquiryItemTop}>
                            <Text style={styles.enquiryIdText}>#{enq.enquiry_id}</Text>
                            <View style={styles.visitScheduledBadge}>
                              <Text style={styles.visitScheduledBadgeText}>
                                {enq.status === 'visit_scheduled'
                                  ? '📅 Visit Scheduled'
                                  : enq.status === 'deal_closed'
                                    ? '🤝 Deal Closed'
                                    : enq.status === 'aborted'
                                      ? '❌ Aborted'
                                      : enq.status === 'new'
                                        ? 'New Enquiry'
                                        : enq.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.enquiryReqText}>
                            Looking for {enq.looking_for} ({enq.transaction_type ? enq.transaction_type.toUpperCase() : 'RENT'})
                          </Text>
                          <View style={styles.enquiryBudgetRow}>
                            <Text style={styles.enquiryBudgetText}>
                              💵 Budget: ₹{(enq.budget_min || 0) / 1000}k - ₹{(enq.budget_max || 0) / 1000}k/mo
                            </Text>
                            <Text style={styles.enquiryUpdatedText}>
                              🕒 {enq.created_at ? formatDateTime(enq.created_at) : 'Active'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {/* Action Buttons Row matching Stitch Image 2 */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={() => Linking.openURL(`tel:${cust.primary_phone}`).catch(() => {})}
                    >
                      <Ionicons name="call-outline" size={13} color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={styles.actionPillBtnText} numberOfLines={1}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={() => Linking.openURL(`https://wa.me/${cust.primary_phone.replace(/\D/g, '')}`).catch(() => {})}
                    >
                      <Ionicons name="logo-whatsapp" size={13} color="#25D366" style={{ marginRight: 4 }} />
                      <Text style={styles.actionPillBtnText} numberOfLines={1}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionPillBtn, { backgroundColor: themeTokens.colors.primaryDark }]}
                      onPress={() => setCustomer360Id(cust.customer_id)}
                    >
                      <Ionicons name="person-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionPillBtnText, { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={1}>
                        Details
                      </Text>
                    </TouchableOpacity>

                    {cust.enquiriesList.length > 0 && (
                      <TouchableOpacity
                        style={[styles.actionPillBtn, { backgroundColor: '#EEF0F8' }]}
                        onPress={() => openMatchesModal(cust.enquiriesList[0])}
                      >
                        <Ionicons name="business-outline" size={13} color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionPillBtnText, { color: themeTokens.colors.primaryDark, fontWeight: '700' }]} numberOfLines={1}>
                          Matches
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Floating Action Button: + Add Customer / Enquiry matching Stitch Image 2 */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.fabBtnText}>Add Customer / Enquiry</Text>
      </TouchableOpacity>

      {/* Modal 1: Add Customer & Enquiry with 100% Options Parity matching Web Super Admin Console */}
      {addModalVisible && (
        <Modal visible={addModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Add Customer & Enquiry</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Direct lead entry & pipeline assignment
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Stitch Image 6 Duplicate Warning Banner */}
                {duplicateWarning && (
                  <View style={styles.duplicateBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="copy-outline" size={16} color="#9B1C1C" />
                      <Text style={styles.duplicateTitle}>DUPLICATE MATCH DETECTED</Text>
                    </View>
                    <Text style={styles.duplicateDesc}>
                      Matched phone ({custPhone}) already exists under profile #{duplicateWarning.customer_id} ({duplicateWarning.name}).
                    </Text>

                    <View style={{ gap: 6, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.duplicateActionBtn, !forceSeparateProfile && styles.duplicateActionBtnActive]}
                        onPress={() => setForceSeparateProfile(false)}
                      >
                        <Text style={[styles.duplicateActionText, !forceSeparateProfile && styles.duplicateActionTextActive]}>
                          ✓ Add New Enquiry to Existing Customer ({duplicateWarning.customer_id})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.duplicateActionBtn, forceSeparateProfile && styles.duplicateActionBtnActive]}
                        onPress={() => setForceSeparateProfile(true)}
                      >
                        <Text style={[styles.duplicateActionText, forceSeparateProfile && styles.duplicateActionTextActive]}>
                          Create Separate Profile (Requires Reason)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {forceSeparateProfile && (
                      <TextInput
                        style={[styles.formInput, { marginTop: 8, borderColor: '#F87171' }]}
                        placeholder="Mandatory reason for separate profile (e.g. Spouse/Business Partner)"
                        value={sharedReason}
                        onChangeText={setSharedReason}
                        placeholderTextColor="#9CA3AF"
                      />
                    )}
                  </View>
                )}

                {/* SECTION 1: Customer Identification */}
                <Text style={styles.sectionHeadingText}>1. Customer Identification & Contact</Text>

                <Text style={styles.formLabel}>Customer Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter customer full name"
                  value={custName}
                  onChangeText={setCustName}
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.formLabel}>Primary Phone *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter 10-digit primary phone"
                  value={custPhone}
                  onChangeText={setCustPhone}
                  onBlur={handlePhoneBlur}
                  keyboardType="phone-pad"
                  placeholderTextColor="#9CA3AF"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Alternate Phone</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Optional alternate phone"
                      value={custAltPhone}
                      onChangeText={setCustAltPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>WhatsApp Phone</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Optional WhatsApp phone"
                      value={custWaPhone}
                      onChangeText={setCustWaPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Customer Type Chips */}
                <Text style={styles.formLabel}>Customer Type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(['tenant', 'buyer', 'agent', 'owner'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chipOption, customerType === t && styles.chipOptionActive]}
                      onPress={() => setCustomerType(t)}
                    >
                      <Text style={[styles.chipOptionText, customerType === t && styles.chipOptionTextActive]}>
                        {t.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Priority Selector */}
                <Text style={styles.formLabel}>Lead Priority</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.priorityPill, custPriority === 'hot' && styles.priorityPillHotActive]}
                    onPress={() => setCustPriority('hot')}
                  >
                    <Text style={[styles.priorityPillText, custPriority === 'hot' && styles.priorityPillTextActive]}>
                      🔥 Hot Lead
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityPill, custPriority === 'warm' && styles.priorityPillWarmActive]}
                    onPress={() => setCustPriority('warm')}
                  >
                    <Text style={[styles.priorityPillText, custPriority === 'warm' && styles.priorityPillTextActive]}>
                      ⚡ Warm
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityPill, custPriority === 'cold' && styles.priorityPillColdActive]}
                    onPress={() => setCustPriority('cold')}
                  >
                    <Text style={[styles.priorityPillText, custPriority === 'cold' && styles.priorityPillTextActive]}>
                      ❄️ Cold
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Lead Source */}
                <Text style={styles.formLabel}>Lead Source</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {['Walk-in', 'Phone Call', 'Portal / Web', 'Referral'].map((src) => (
                    <TouchableOpacity
                      key={src}
                      style={[styles.chipOption, leadSource === src && styles.chipOptionActive]}
                      onPress={() => setLeadSource(src)}
                    >
                      <Text style={[styles.chipOptionText, leadSource === src && styles.chipOptionTextActive]}>
                        {src}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* SECTION 2: Enquiry Specifications & Budget */}
                <Text style={[styles.sectionHeadingText, { marginTop: 12 }]}>2. Requirement & Budget</Text>

                <Text style={styles.formLabel}>Transaction Type *</Text>
                <View style={styles.segmentRow}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, transactionType === 'rent' && styles.segmentBtnActive]}
                    onPress={() => setTransactionType('rent')}
                  >
                    <Text style={[styles.segmentBtnText, transactionType === 'rent' && styles.segmentBtnTextActive]}>
                      For Rent
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, transactionType === 'sale' && styles.segmentBtnActive]}
                    onPress={() => setTransactionType('sale')}
                  >
                    <Text style={[styles.segmentBtnText, transactionType === 'sale' && styles.segmentBtnTextActive]}>
                      For Sale
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* BHK / Looking For Chips */}
                <Text style={styles.formLabel}>Looking For (BHK) *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['1 RK', '1 BHK', '2 BHK', '2 BHK + Study', '3 BHK', '3 BHK + 3T', '4 BHK', 'Villa', 'Studio', 'Office Space'].map((bhk) => (
                      <TouchableOpacity
                        key={bhk}
                        style={[styles.chipOption, lookingFor === bhk && styles.chipOptionActive]}
                        onPress={() => setLookingFor(bhk)}
                      >
                        <Text style={[styles.chipOptionText, lookingFor === bhk && styles.chipOptionTextActive]}>
                          {bhk}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Preferred Society Selector */}
                <Text style={styles.formLabel}>Preferred Society (Optional)</Text>
                <TouchableOpacity
                  style={styles.dropdownSelectorBtn}
                  onPress={() => setSocietyModalVisible(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="business-outline" size={16} color="#4F5278" />
                    <Text style={styles.dropdownSelectorText}>
                      {preferredSocietyName || 'Select Preferred Society'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Preferred Location */}
                <Text style={styles.formLabel}>Preferred Sector / Area</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Sector 62 Gurgaon, Golf Course Ext"
                  value={preferredLoc}
                  onChangeText={setPreferredLoc}
                  placeholderTextColor="#9CA3AF"
                />

                {/* Budget Range */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Min Budget (₹) *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="50000"
                      value={budgetMin}
                      onChangeText={setBudgetMin}
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Max Budget (₹) *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="70000"
                      value={budgetMax}
                      onChangeText={setBudgetMax}
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Tenant Preference */}
                <Text style={styles.formLabel}>Tenant Preference</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['Family Only', 'Bachelor', 'Family + Bachelor', 'Corporate'].map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      style={[styles.chipOption, tenantPreference === pref && styles.chipOptionActive]}
                      onPress={() => setTenantPreference(pref)}
                    >
                      <Text style={[styles.chipOptionText, tenantPreference === pref && styles.chipOptionTextActive]}>
                        {pref}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* SECTION 3: Notes & Action */}
                <Text style={[styles.sectionHeadingText, { marginTop: 12 }]}>3. Notes & Additional Info</Text>

                <View style={{ marginBottom: 10 }}>
                  <DateTimePickerField
                    mode="date"
                    label="Target Move-In Date (Optional)"
                    value={expectedMoveInDate}
                    onChangeValue={setExpectedMoveInDate}
                    placeholder="Select move-in date from calendar..."
                  />
                </View>

                <TextInput
                  style={[styles.formInput, { height: 60 }]}
                  placeholder="Prefers high floor, corner unit, morning sunlight..."
                  value={enqNotes}
                  onChangeText={setEnqNotes}
                  multiline
                  placeholderTextColor="#9CA3AF"
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setAddModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, savingEnq && { opacity: 0.8 }]}
                  onPress={handleCreateCustomerEnquiry}
                  disabled={savingEnq}
                >
                  {savingEnq ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>Register Customer Enquiry</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal 2: Society Selector Modal */}
      {societyModalVisible && (
        <Modal visible={societyModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 400 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Preferred Society</Text>
                <TouchableOpacity onPress={() => setSocietyModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ marginTop: 8 }}>
                {societies.length === 0 ? (
                  <Text style={{ padding: 16, color: '#9CA3AF', textAlign: 'center' }}>
                    No active societies found. Add societies in Super Admin Master Data.
                  </Text>
                ) : (
                  societies.map((soc) => (
                    <TouchableOpacity
                      key={soc.id || soc.society_id}
                      style={styles.societyListItem}
                      onPress={() => {
                        setPreferredSocietyId(soc.society_id || soc.id);
                        setPreferredSocietyName(soc.name);
                        setSocietyModalVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.societyItemTitle}>{soc.name}</Text>
                        <Text style={styles.societyItemSub}>#{soc.society_id}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal 3: Deterministic Matching Bottom Sheet (Stitch Image 4) */}
      {matchesModalVisible && (
        <Modal visible={matchesModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Property Matches</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Deterministic matcher for #{matchingEnquiry?.enquiry_id}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setMatchesModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {loadingMatches ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={themeTokens.colors.primaryDark} />
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, marginTop: 6 }}>
                    Computing rule density matches...
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {matchesList.length === 0 ? (
                    <Text style={{ padding: 20, textAlign: 'center', color: themeTokens.colors.textSecondary }}>
                      No matching properties currently available in inventory.
                    </Text>
                  ) : (
                    matchesList.map((m: any, idx: number) => {
                      const p = m.property || m;
                      const propId = p.property_id || m.property_id || `PROP-${idx}`;
                      const socName = p.society_name || m.society_name || 'Society Scheduled';
                      const loc = p.location || m.location || 'Service Area';
                      const bhk = p.bhk || p.property_type || m.bhk || 'Residential Unit';
                      const expectedAmount = p.expected_amount !== undefined ? p.expected_amount : (m.expected_amount || 0);
                      const txType = p.transaction_type || m.transaction_type || (matchingEnquiry?.transaction_type || 'rent');
                      const matchScore = m.match_score !== undefined ? m.match_score : 85;
                      const matchReasons = m.match_reasons || [];

                      return (
                        <View key={propId || idx} style={styles.matchCandidateCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: themeTokens.colors.primaryDark }}>
                                #{propId}
                              </Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>
                                • {bhk}
                              </Text>
                            </View>
                            <View style={styles.matchScoreBadge}>
                              <Text style={styles.matchScoreBadgeText}>{matchScore}% Match</Text>
                            </View>
                          </View>

                          <Text style={{ fontSize: 14, fontWeight: '800', color: themeTokens.colors.textPrimary, marginTop: 4 }}>
                            {socName}
                          </Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, marginTop: 2 }}>
                            {loc} • ₹{safeLocale(expectedAmount)}{txType === 'rent' ? '/mo' : ''}
                          </Text>

                          {/* Match Reasons Tags */}
                          {matchReasons.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                              {matchReasons.map((r: string, rIdx: number) => (
                                <View key={rIdx} style={styles.matchTagPill}>
                                  <Text style={styles.matchTagText}>✓ {r}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Quick Action Buttons on Each Matched Unit */}
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: '#4338CA',
                                paddingVertical: 7,
                                borderRadius: 6,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 4,
                              }}
                              onPress={() => {
                                const enq = matchingEnquiry;
                                setMatchesModalVisible(false);
                                if (onSelectEnquiry && enq) {
                                  onSelectEnquiry(enq.enquiry_id, propId);
                                } else {
                                  Alert.alert('Schedule Showing', `Showing booked for Enquiry #${enq?.enquiry_id} on Property #${propId}.`);
                                }
                              }}
                            >
                              <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Schedule Showing</Text>
                            </TouchableOpacity>

                            {matchingEnquiry?.customer_phone && (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#DCFCE7',
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 6,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onPress={() => {
                                  const text = encodeURIComponent(
                                    `Hello ${matchingEnquiry.customer_name}! We found a matching property for you:\n\n*${socName}* (${bhk})\n📍 ${loc}\n💰 ₹${safeLocale(expectedAmount)}${txType === 'rent' ? '/month' : ''}\nRef ID: ${propId}\n\nWould you like to schedule a showing visit?`
                                  );
                                  const cleanPhone = matchingEnquiry.customer_phone.replace(/[^0-9]/g, '');
                                  Linking.openURL(`https://wa.me/${cleanPhone}?text=${text}`);
                                }}
                              >
                                <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={{
                                backgroundColor: '#ECFDF5',
                                paddingHorizontal: 8,
                                paddingVertical: 7,
                                borderRadius: 6,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: '#A7F3D0',
                              }}
                              onPress={() => {
                                setMatchesModalVisible(false);
                                setSelectedEnquiry(matchingEnquiry);
                                setDealPropId(propId);
                                setDealPrice(String(expectedAmount || ''));
                                setCloseDealVisible(true);
                              }}
                            >
                              <Text style={{ color: '#047857', fontSize: 11, fontWeight: '700' }}>Close Deal</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setMatchesModalVisible(false)}
              >
                <Text style={styles.closeModalBtnText}>Close Matches</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Full Screen Customer 360 & Timeline Dossier */}
      {customer360Id && (
        <Modal visible={!!customer360Id} animationType="slide">
          <CustomerDetailScreen
            customerId={customer360Id}
            onClose={() => {
              setCustomer360Id(null);
              fetchDirectory();
            }}
            onScheduleVisit={(cust, enq) => {
              setCustomer360Id(null);
              if (onSelectEnquiry && enq) onSelectEnquiry(enq.enquiry_id);
            }}
          />
        </Modal>
      )}

      {/* Standalone Duplicate Lead & Phone Checker Modal */}
      <DuplicateCheckModal
        visible={duplicateModalVisible}
        onClose={() => setDuplicateModalVisible(false)}
        onOpenCustomer={(cid) => {
          setDuplicateModalVisible(false);
          setCustomer360Id(cid);
        }}
        onAddEnquiryToExisting={(cust) => {
          setDuplicateModalVisible(false);
          setCustName(cust.name);
          setCustPhone(cust.primary_phone);
          setCustAltPhone(cust.alternate_phone || '');
          setCustWaPhone(cust.whatsapp_phone || '');
          setDuplicateWarning(cust);
          setAddModalVisible(true);
        }}
      />

      {/* Modal 5: Overhauled Full Enquiry Detail & Timeline Modal */}
      {selectedEnquiry && (
        <Modal visible={Boolean(selectedEnquiry)} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '88%' }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modalTitle}>Enquiry #{selectedEnquiry.enquiry_id}</Text>
                    <View
                      style={[
                        styles.badgePillSmall,
                        {
                          backgroundColor:
                            selectedEnquiry.status === 'deal_closed'
                              ? '#D1FAE5'
                              : selectedEnquiry.status === 'aborted'
                              ? '#FEE2E2'
                              : '#EEF2FF',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color:
                            selectedEnquiry.status === 'deal_closed'
                              ? '#047857'
                              : selectedEnquiry.status === 'aborted'
                              ? '#B91C1C'
                              : '#4338CA',
                        }}
                      >
                        {selectedEnquiry.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary, marginTop: 2 }}>
                    Created: {selectedEnquiry.created_at ? formatDateTime(selectedEnquiry.created_at) : 'Earlier'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedEnquiry(null)}>
                  <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
                {/* Client Contact Quick Action Card */}
                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderColor: '#E2E8F0', borderWidth: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 }}>CLIENT CONTACT</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>{selectedEnquiry.customer_name}</Text>
                      <Text style={{ fontSize: 12, color: '#475569' }}>{selectedEnquiry.customer_phone}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {selectedEnquiry.customer_phone ? (
                        <>
                          <TouchableOpacity
                            style={{ backgroundColor: '#EEF2FF', padding: 6, borderRadius: 6 }}
                            onPress={() => Linking.openURL(`tel:${selectedEnquiry.customer_phone}`)}
                          >
                            <Ionicons name="call" size={16} color="#4338CA" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: '#DCFCE7', padding: 6, borderRadius: 6 }}
                            onPress={() => {
                              const clean = selectedEnquiry.customer_phone.replace(/[^0-9]/g, '');
                              Linking.openURL(`https://wa.me/${clean}`);
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                          </TouchableOpacity>
                        </>
                      ) : null}
                      <TouchableOpacity
                        style={{ backgroundColor: '#4338CA', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 }}
                        onPress={() => {
                          const target = selectedEnquiry.customer_id;
                          setSelectedEnquiry(null);
                          if (target) setCustomer360Id(target);
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Requirement Specifications */}
                <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, borderColor: '#E2E8F0', borderWidth: 1, gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 }}>REQUIREMENT SPECS</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Looking For:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>{selectedEnquiry.looking_for} ({selectedEnquiry.transaction_type.toUpperCase()})</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Budget Range:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                      ₹{safeLocale(selectedEnquiry.budget_min)} - ₹{safeLocale(selectedEnquiry.budget_max)}
                    </Text>
                  </View>
                  {selectedEnquiry.preferred_locations && selectedEnquiry.preferred_locations.length > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>Locations:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', flex: 1, textAlign: 'right' }}>
                        {selectedEnquiry.preferred_locations.join(', ')}
                      </Text>
                    </View>
                  )}
                  {selectedEnquiry.notes ? (
                    <View style={{ backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>NOTES</Text>
                      <Text style={{ fontSize: 11, color: '#78350F', marginTop: 2 }}>{selectedEnquiry.notes}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Executive Action Timeline */}
                <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, borderColor: '#E2E8F0', borderWidth: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B' }}>EXECUTIVE TIMELINE</Text>
                    <Text style={{ fontSize: 10, color: '#64748B' }}>{enquiryTimeline.length} events</Text>
                  </View>

                  {/* Quick Note Input */}
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                        borderRadius: 6,
                        fontSize: 12,
                        backgroundColor: '#F8FAFC',
                      }}
                      placeholder="Add follow-up note..."
                      placeholderTextColor="#94A3B8"
                      value={timelineNote}
                      onChangeText={setTimelineNote}
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#4338CA',
                        paddingHorizontal: 12,
                        justifyContent: 'center',
                        borderRadius: 6,
                      }}
                      onPress={handleAddTimelineNote}
                      disabled={savingTimelineNote || !timelineNote.trim()}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        {savingTimelineNote ? '...' : '+ Note'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Timeline Stream */}
                  {loadingTimeline ? (
                    <ActivityIndicator size="small" color="#4338CA" style={{ padding: 12 }} />
                  ) : enquiryTimeline.length === 0 ? (
                    <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: 8 }}>
                      No action timeline logged yet.
                    </Text>
                  ) : (
                    enquiryTimeline.map((item, idx) => (
                      <View
                        key={idx}
                        style={{
                          padding: 8,
                          backgroundColor: item.type === 'visit' ? '#F0FDF4' : item.type === 'followup' ? '#FFFBEB' : '#F8FAFC',
                          borderLeftWidth: 3,
                          borderLeftColor: item.type === 'visit' ? '#16A34A' : item.type === 'followup' ? '#D97706' : '#4338CA',
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E293B' }}>
                            {item.type === 'visit' ? 'Site Showing' : item.type === 'followup' ? 'Follow-up' : item.event_type || 'Activity'}
                          </Text>
                          <Text style={{ fontSize: 9, color: '#64748B' }}>
                            {item.created_at || item.scheduled_at
                              ? formatDateTime(item.created_at || item.scheduled_at)
                              : ''}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
                          {item.notes || item.remarks || item.outcome || (item.details ? JSON.stringify(item.details) : '')}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                          By: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.actor_name || item.executive_name || item.created_by_name || 'System'}</Text>
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Action Suite Buttons */}
                <View style={{ gap: 6, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, { backgroundColor: '#4338CA' }]}
                    onPress={() => {
                      const enq = selectedEnquiry;
                      setSelectedEnquiry(null);
                      openMatchesModal(enq);
                    }}
                  >
                    <Text style={styles.modalSubmitBtnText}>✨ View Smart Property Matches</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.modalSubmitBtn, { flex: 1, backgroundColor: '#059669' }]}
                      onPress={() => setCloseDealVisible(true)}
                    >
                      <Text style={styles.modalSubmitBtnText}>🤝 Close Deal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSubmitBtn, { flex: 1, backgroundColor: '#DC2626' }]}
                      onPress={() => setAbortVisible(true)}
                    >
                      <Text style={styles.modalSubmitBtnText}>❌ Drop / Abort</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 6 }]} onPress={() => setSelectedEnquiry(null)}>
                <Text style={styles.modalCancelBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal: Close Deal Prompt */}
      {closeDealVisible && (
        <Modal visible={closeDealVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 380 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Close Deal for Enquiry</Text>
                <TouchableOpacity onPress={() => setCloseDealVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ gap: 8, paddingVertical: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>Property ID *</Text>
                <TextInput
                  style={[styles.formInput, { textTransform: 'uppercase' }]}
                  placeholder="e.g. PROP0001"
                  value={dealPropId}
                  onChangeText={setDealPropId}
                />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>Final Closed Amount (₹)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 25000"
                  keyboardType="numeric"
                  value={dealPrice}
                  onChangeText={setDealPrice}
                />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>Final Remarks</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Agreement signed, token received..."
                  value={dealRemarks}
                  onChangeText={setDealRemarks}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#059669', flex: 1 }]}
                  onPress={handleConfirmCloseDeal}
                  disabled={savingDeal}
                >
                  <Text style={styles.modalSubmitBtnText}>{savingDeal ? 'Saving...' : 'Confirm Deal Closed'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCloseDealVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal: Abort Enquiry Prompt */}
      {abortVisible && (
        <Modal visible={abortVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 300 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Drop / Abort Enquiry</Text>
                <TouchableOpacity onPress={() => setAbortVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ gap: 8, paddingVertical: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>Mandatory Abort Reason *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Client found elsewhere / Budget mismatch / Not reachable"
                  value={abortReason}
                  onChangeText={setAbortReason}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#DC2626', flex: 1 }]}
                  onPress={handleConfirmAbort}
                  disabled={savingAbort}
                >
                  <Text style={styles.modalSubmitBtnText}>{savingAbort ? 'Dropping...' : 'Confirm Abort'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAbortVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Real Customer Directory Sort Modal */}
      {sortModalVisible && (
        <Modal
          visible={sortModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setSortModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 440 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Sort Customer Directory</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Order customer leads and pipeline accounts
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8, marginVertical: 12 }}>
                {[
                  { id: 'newest', label: 'Newest Added First', icon: 'time-outline' },
                  { id: 'name_asc', label: 'Customer Name (A → Z)', icon: 'text-outline' },
                  { id: 'name_desc', label: 'Customer Name (Z → A)', icon: 'text-outline' },
                  { id: 'enquiries_desc', label: 'Most Active Enquiries', icon: 'document-text-outline' },
                  { id: 'oldest', label: 'Oldest Added First', icon: 'calendar-outline' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.sortOptionRow,
                      sortBy === s.id && styles.sortOptionRowActive,
                    ]}
                    onPress={() => {
                      setSortBy(s.id as any);
                      setSortModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name={s.icon as any}
                      size={16}
                      color={sortBy === s.id ? '#4F5278' : '#6B7280'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.sortOptionText, sortBy === s.id && styles.sortOptionTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
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
    backgroundColor: '#F7F8FC',
  },
  searchHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  sortBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#4F5278', // Stitch primary dark slate
    borderColor: '#4F5278',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  urgencyLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  urgencyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: themeTokens.colors.textSecondary,
    letterSpacing: 0.6,
  },
  hotPill: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9B1C1C',
  },
  warmPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warmPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  coldPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coldPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 8,
  },
  cardsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: '#292A3A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  customerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBEBF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F5278',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  hotBadge: {
    backgroundColor: '#FDE8E8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hotBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9B1C1C',
  },
  custMetaText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 1,
  },
  dotsBtn: {
    padding: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  whatsappDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },
  whatsappDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  whatsappText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  enquiriesSubheader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  enqCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F5278',
    letterSpacing: 0.6,
  },
  matchScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  nestedEnquiriesContainer: {
    gap: 8,
    marginBottom: 12,
  },
  enquiryItemBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  enquiryItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  enquiryIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F5278',
  },
  visitScheduledBadge: {
    backgroundColor: '#EBEBF7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  visitScheduledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F5278',
  },
  enquiryReqText: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  enquiryBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  enquiryBudgetText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  enquiryUpdatedText: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0F8', // Soft lavender
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    minHeight: 32,
  },
  actionPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  moreActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F5278',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#4F5278',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  fabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  duplicateBanner: {
    backgroundColor: '#FDE8E8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  duplicateTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9B1C1C',
  },
  duplicateDesc: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  duplicateActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  duplicateActionBtnActive: {
    backgroundColor: '#4F5278',
    borderColor: '#4F5278',
  },
  duplicateActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  duplicateActionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeadingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F5278',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
  },
  chipOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipOptionActive: {
    backgroundColor: '#4F5278',
    borderColor: '#4F5278',
  },
  chipOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  chipOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  priorityPillHotActive: {
    backgroundColor: '#FDE8E8',
    borderColor: '#EF4444',
  },
  priorityPillWarmActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  priorityPillColdActive: {
    backgroundColor: '#EEF0F8',
    borderColor: '#4F5278',
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textSecondary,
  },
  priorityPillTextActive: {
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dropdownSelectorText: {
    fontSize: 13,
    color: themeTokens.colors.textPrimary,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  segmentBtnActive: {
    backgroundColor: '#4F5278',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4F5278',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matchCandidateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  matchScoreBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchScoreBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#03543F',
  },
  matchTagPill: {
    backgroundColor: '#EEF0F8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F5278',
  },
  societyListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  societyItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  societyItemSub: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  detailSpecBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailSpecLabel: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
  },
  detailSpecVal: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeModalBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  checkDuplicateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  checkDuplicateHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  liveSuggestionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4F5278',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    maxHeight: 240,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  liveSuggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  liveSuggestionsHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  liveSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  liveSuggestionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  liveSuggestionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: 200,
  },
  liveSuggestionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  badgePillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sortOptionRowActive: {
    borderColor: '#4F5278',
    backgroundColor: '#EEF0F8',
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  sortOptionTextActive: {
    color: '#4F5278',
    fontWeight: '800',
  },
});
