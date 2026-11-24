import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  Share,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, MobileProperty } from '../services/api';
import { DateTimePickerField } from '../components/DateTimePickerModal';
import { formatDateTime } from '../utils/dateUtils';

interface PropertyDetailScreenProps {
  propertyId: string;
  initialProperty?: MobileProperty;
  onClose: () => void;
  onScheduleVisit?: (propertyId: string) => void;
  onPropertyUpdated?: (updated: MobileProperty) => void;
}

export const PropertyDetailScreen: React.FC<PropertyDetailScreenProps> = ({
  propertyId,
  initialProperty,
  onClose,
  onScheduleVisit,
  onPropertyUpdated,
}) => {
  const [property, setProperty] = useState<MobileProperty | null>(initialProperty || null);
  const [loading, setLoading] = useState(!initialProperty);
  const [copiedId, setCopiedId] = useState(false);

  // Status Change State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Log Owner Note / Follow-up State
  const [ownerNoteModalVisible, setOwnerNoteModalVisible] = useState(false);
  const [ownerNoteText, setOwnerNoteText] = useState('');
  const [ownerNoteCategory, setOwnerNoteCategory] = useState('📞 Owner Call');
  const [ownerNextCallDate, setOwnerNextCallDate] = useState('');
  const [savingOwnerNote, setSavingOwnerNote] = useState(false);

  const fetchPropertyData = async () => {
    try {
      setLoading(true);
      const res = await mobileApi.getProperty(propertyId);
      setProperty(res);
      if (onPropertyUpdated) onPropertyUpdated(res);
    } catch (err: any) {
      Alert.alert('Load Error', err.message || 'Could not load property details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPropertyData();
  }, [propertyId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!property) return;
    try {
      setUpdatingStatus(true);
      const updated = await mobileApi.updateProperty(property.property_id, { status: newStatus as any });
      setProperty(updated);
      if (onPropertyUpdated) onPropertyUpdated(updated);
      setStatusModalVisible(false);
      setStatusMessage(`Status changed to ${newStatus.replace('_', ' ').toUpperCase()}`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyId = () => {
    if (!property) return;
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    Alert.alert('Copied', `Property ID #${property.property_id} copied to clipboard.`);
  };

  const handleShareBrochure = async () => {
    if (!property) return;
    const formattedPrice = `₹${(property.expected_amount ?? 0).toLocaleString('en-IN')}${property.transaction_type === 'rent' ? '/month' : ''}`;
    const message =
      `🏢 *EstateCRM Property Listing: ${property.property_id}*\n` +
      `• *Configuration:* ${property.property_type} (${property.transaction_type.toUpperCase()})\n` +
      `• *Society:* ${property.society_name}\n` +
      `• *Location:* ${property.location}\n` +
      `• *Price / Rent:* ${formattedPrice} (${property.negotiable ? 'Negotiable' : 'Fixed'})\n` +
      (property.security_deposit ? `• *Security Deposit:* ₹${property.security_deposit.toLocaleString('en-IN')}\n` : '') +
      `• *Maintenance:* ${property.maintenance_mode === 'included' ? 'Included' : `₹${property.maintenance_amount || 0}/mo extra`}\n` +
      (property.tenant_type ? `• *Tenant Preference:* ${property.tenant_type}\n` : '') +
      (property.notes ? `• *Key Highlights:* ${property.notes}\n` : '') +
      `\nFor showings and inquiries, contact EstateCRM Authorized Operations.`;

    try {
      await Share.share({ message });
    } catch {
      // ignore
    }
  };

  const handleWhatsAppShare = () => {
    if (!property) return;
    const formattedPrice = `₹${(property.expected_amount ?? 0).toLocaleString('en-IN')}${property.transaction_type === 'rent' ? '/month' : ''}`;
    const text =
      `🏢 *EstateCRM Property Listing: ${property.property_id}*\n` +
      `• *Type:* ${property.property_type} (${property.transaction_type.toUpperCase()})\n` +
      `• *Society:* ${property.society_name}\n` +
      `• *Location:* ${property.location}\n` +
      `• *Price:* ${formattedPrice}\n\n` +
      `Direct Showing & Key Custody managed by EstateCRM.`;

    const targetPhone = property.owner_phone ? property.owner_phone.replace(/\D/g, '') : '';
    const url = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Could not open WhatsApp.');
    });
  };

  const handleCallOwner = () => {
    if (!property?.owner_phone) {
      Alert.alert('Notice', 'No owner phone number provided.');
      return;
    }
    Linking.openURL(`tel:${property.owner_phone}`).catch(() => {
      Alert.alert('Notice', 'Could not open phone dialer.');
    });
  };

  const handleCallAgent = () => {
    if (!property?.agent_phone) {
      Alert.alert('Notice', 'No agent/broker phone number provided.');
      return;
    }
    Linking.openURL(`tel:${property.agent_phone}`).catch(() => {
      Alert.alert('Notice', 'Could not open phone dialer.');
    });
  };

  const handleSaveOwnerNote = async () => {
    if (!property) return;
    if (!ownerNoteText.trim()) {
      Alert.alert('Note Required', 'Please enter owner conversation notes or remarks.');
      return;
    }
    setSavingOwnerNote(true);
    try {
      const updated = await mobileApi.addPropertyNote(property.property_id, {
        notes: ownerNoteText.trim(),
        category: ownerNoteCategory,
        scheduled_call_at: ownerNextCallDate || undefined,
      });
      setProperty(updated);
      if (onPropertyUpdated) onPropertyUpdated(updated);
      setOwnerNoteModalVisible(false);
      setOwnerNoteText('');
      setOwnerNextCallDate('');
      Alert.alert(
        'Success',
        ownerNextCallDate
          ? 'Owner note recorded & callback added to your Daily Schedule!'
          : 'Owner conversation note recorded.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save owner note.');
    } finally {
      setSavingOwnerNote(false);
    }
  };

  if (loading && !property) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Loading Property Dossier #{propertyId}...</Text>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={styles.errorTitle}>Property Not Found</Text>
        <Text style={styles.errorDesc}>Record #{propertyId} could not be retrieved from database.</Text>
        <TouchableOpacity style={styles.backBtnError} onPress={onClose}>
          <Text style={styles.backBtnErrorText}>Back to Inventory</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusColor =
    property.status === 'available'
      ? '#16A34A'
      : property.status === 'rented'
      ? '#2563EB'
      : property.status === 'sold'
      ? '#4F46E5'
      : property.status === 'under_negotiation'
      ? '#D97706'
      : '#6B7280';

  const statusBg =
    property.status === 'available'
      ? '#DCFCE7'
      : property.status === 'rented'
      ? '#DBEAFE'
      : property.status === 'sold'
      ? '#E0E7FF'
      : property.status === 'under_negotiation'
      ? '#FEF3C7'
      : '#F3F4F6';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
          <Text style={styles.backBtnLabel}>Inventory</Text>
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Property Dossier</Text>
          <Text style={styles.topBarSubtitle}>#{property.property_id}</Text>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={handleShareBrochure}>
            <Ionicons name="share-social-outline" size={18} color="#1D4ED8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#4B5563" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Status Update Banner */}
        {statusMessage && (
          <View style={styles.statusToastBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.statusToastText}>{statusMessage}</Text>
          </View>
        )}

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRowTop}>
            <TouchableOpacity style={styles.idBadgeBox} onPress={handleCopyId} activeOpacity={0.8}>
              <Text style={styles.idBadgeText}>#{property.property_id}</Text>
              <Ionicons
                name={copiedId ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={copiedId ? '#16A34A' : '#1D4ED8'}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {/* Interactive Status Changer Pill */}
            <TouchableOpacity
              style={[styles.statusPillBtn, { backgroundColor: statusBg }]}
              onPress={() => setStatusModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {property.status.replace('_', ' ').toUpperCase()}
              </Text>
              <Ionicons name="chevron-down" size={12} color={statusColor} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>

          {/* Creation Date & Time Stamp */}
          {property.created_at ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginBottom: 8 }}>
              <Ionicons name="time-outline" size={12} color="#64748B" />
              <Text style={{ fontSize: 11, color: '#64748B' }}>
                Added: {formatDateTime(property.created_at)}
                {property.created_by_name ? ` by ${property.created_by_name}` : ''}
              </Text>
            </View>
          ) : null}

          {/* Pricing Row */}
          <View style={styles.pricingSection}>
            <View>
              <Text style={styles.priceSubLabel}>
                {property.transaction_type === 'rent' ? 'MONTHLY ASKING RENT' : 'EXPECTED SALE PRICE'}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceValue}>
                  ₹{(property.expected_amount ?? 0).toLocaleString('en-IN')}
                </Text>
                {property.transaction_type === 'rent' && <Text style={styles.priceUnit}>/ month</Text>}
                <View style={[styles.negBadge, { backgroundColor: property.negotiable ? '#FEF3C7' : '#F3F4F6' }]}>
                  <Text style={[styles.negBadgeText, { color: property.negotiable ? '#92400E' : '#4B5563' }]}>
                    {property.negotiable ? 'Negotiable' : 'Fixed Price'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.transTypeBox}>
              <Text style={styles.transTypeText}>{property.transaction_type.toUpperCase()}</Text>
            </View>
          </View>

          {/* Society & Location */}
          <View style={styles.locationContainer}>
            <View style={styles.locationIconCircle}>
              <Ionicons name="business" size={16} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.societyName}>{property.society_name}</Text>
              <Text style={styles.locationAddress}>{property.location}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: PHYSICAL SPECIFICATIONS */}
        <View style={styles.tabContentCard}>
          <Text style={styles.sectionHeading}>PHYSICAL SPECIFICATIONS</Text>
            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Ionicons name="home-outline" size={16} color="#1D4ED8" />
                <View>
                  <Text style={styles.specLabel}>Configuration</Text>
                  <Text style={styles.specValue}>{property.property_type}</Text>
                </View>
              </View>

              <View style={styles.specItem}>
                <Ionicons name="layers-outline" size={16} color="#1D4ED8" />
                <View>
                  <Text style={styles.specLabel}>BHK Type</Text>
                  <Text style={styles.specValue}>{property.bhk || property.property_type}</Text>
                </View>
              </View>

              {property.additional_rooms && property.additional_rooms.length > 0 && (
                <View style={styles.specItem}>
                  <Ionicons name="add-circle-outline" size={16} color="#1D4ED8" />
                  <View>
                    <Text style={styles.specLabel}>Extra Rooms</Text>
                    <Text style={styles.specValue}>{property.additional_rooms.join(', ')}</Text>
                  </View>
                </View>
              )}

              <View style={styles.specItem}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#1D4ED8" />
                <View>
                  <Text style={styles.specLabel}>Listing Status</Text>
                  <Text style={[styles.specValue, { color: statusColor, textTransform: 'capitalize' }]}>
                    {property.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tenant Preferences & Notes */}
            <View style={styles.notesSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
                <Text style={styles.notesSectionTitle}>Showing & Tenant Guidelines</Text>
              </View>
              <Text style={styles.notesBody}>
                {property.notes || 'Standard operational showing guidelines apply. Confirm showing 2 hours prior with branch executive.'}
              </Text>
            </View>
          </View>

        {/* SECTION 2: FINANCIAL BREAKDOWN & EXTRA CHARGES */}
        <View style={styles.tabContentCard}>
          <Text style={styles.sectionHeading}>FINANCIAL BREAKDOWN & CHARGES</Text>
          <View style={styles.financialList}>
            <View style={styles.financialRow}>
              <Text style={styles.finLabel}>Asking Rate / Price</Text>
              <Text style={styles.finValBold}>
                ₹{(property.expected_amount ?? 0).toLocaleString('en-IN')}{property.transaction_type === 'rent' ? ' / mo' : ''}
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.finLabel}>Society Maintenance</Text>
              <Text style={styles.finVal}>
                {property.maintenance_mode === 'included'
                  ? 'Included in Rate'
                  : `₹${(property.maintenance_amount || 0).toLocaleString('en-IN')}/mo Extra`}
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.finLabel}>Security Deposit</Text>
              <Text style={styles.finVal}>
                {property.security_deposit
                  ? `₹${property.security_deposit.toLocaleString('en-IN')}`
                  : 'Not specified'}
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.finLabel}>Price Negotiation</Text>
              <Text style={[styles.finVal, { color: property.negotiable ? '#D97706' : '#4B5563' }]}>
                {property.negotiable ? 'Open to Negotiation' : 'Fixed Price Policy'}
              </Text>
            </View>

            {property.additional_charges && property.additional_charges.length > 0 && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={[styles.sectionHeading, { marginBottom: 8 }]}>ADDITIONAL / AMENITY CHARGES</Text>
                {property.additional_charges.map((chg, idx) => (
                  <View key={idx} style={styles.chargeRow}>
                    <Text style={styles.chargeName}>{chg.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>
                        {chg.frequency === 'monthly' ? 'Monthly' : 'One-time'}
                      </Text>
                      <Text style={styles.chargeAmount}>₹{(chg.amount ?? 0).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* SECTION 3: OWNER & BROKER INFORMATION */}
        <View style={styles.tabContentCard}>
          <Text style={styles.sectionHeading}>OWNER INFORMATION</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactHeaderRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {property.owner_name ? property.owner_name.charAt(0).toUpperCase() : 'O'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{property.owner_name}</Text>
                <Text style={styles.contactPhone}>{property.owner_phone}</Text>
              </View>
            </View>

            <View style={styles.contactActionsRow}>
              <TouchableOpacity style={styles.callContactBtn} onPress={handleCallOwner}>
                <Ionicons name="call" size={14} color="#059669" />
                <Text style={styles.callContactBtnText}>Call Owner</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.waContactBtn} onPress={handleWhatsAppShare}>
                <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
                <Text style={styles.waContactBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {/* Log Owner Note / Follow-up Button */}
            <TouchableOpacity
              style={styles.logOwnerNoteBtn}
              onPress={() => setOwnerNoteModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={15} color="#1D4ED8" style={{ marginRight: 6 }} />
              <Text style={styles.logOwnerNoteBtnText}>Log Owner Note / Follow-up</Text>
            </TouchableOpacity>
          </View>

          {/* Owner Conversation & Key Highlights */}
          {property.notes ? (
            <View style={styles.ownerNotesHistoryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="document-text" size={14} color="#1D4ED8" />
                  <Text style={styles.ownerNotesHistoryTitle}>Owner Remarks & History</Text>
                </View>
                <TouchableOpacity onPress={() => setOwnerNoteModalVisible(true)}>
                  <Text style={styles.addOwnerNoteLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ownerNotesHistoryText}>{property.notes}</Text>
            </View>
          ) : null}

          {property.agent_name ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeading}>BROKER / AGENT INFORMATION</Text>
              <View style={styles.contactCard}>
                <View style={styles.contactHeaderRow}>
                  <View style={[styles.contactAvatar, { backgroundColor: '#F3E8FF' }]}>
                    <Text style={[styles.contactAvatarText, { color: '#7C3AED' }]}>
                      {property.agent_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{property.agent_name}</Text>
                    <Text style={styles.contactPhone}>{property.agent_phone || 'No phone provided'}</Text>
                  </View>
                </View>

                {property.agent_phone && (
                  <View style={styles.contactActionsRow}>
                    <TouchableOpacity style={styles.callContactBtn} onPress={handleCallAgent}>
                      <Ionicons name="call" size={14} color="#059669" />
                      <Text style={styles.callContactBtnText}>Call Agent</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomScheduleBtn}
          onPress={() => {
            if (onScheduleVisit) {
              onClose();
              onScheduleVisit(property.property_id);
            }
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.bottomScheduleBtnText}>Schedule Visit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomWaBtn} onPress={handleWhatsAppShare} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.bottomWaBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Status Changer Modal */}
      {statusModalVisible && (
        <Modal visible={statusModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Property Status</Text>
                <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Select new live status for Property #{property.property_id}:
              </Text>

              <View style={{ gap: 8 }}>
                {[
                  { id: 'available', label: 'Available (Live in Inventory)', color: '#16A34A', bg: '#DCFCE7' },
                  { id: 'under_negotiation', label: 'Under Negotiation', color: '#D97706', bg: '#FEF3C7' },
                  { id: 'reserved', label: 'Reserved (Token Received)', color: '#7C3AED', bg: '#F3E8FF' },
                  { id: 'rented', label: 'Rented Out', color: '#2563EB', bg: '#DBEAFE' },
                  { id: 'sold', label: 'Closed / Sold', color: '#4F46E5', bg: '#E0E7FF' },
                  { id: 'archived', label: 'Archived (Withdrawn)', color: '#6B7280', bg: '#F3F4F6' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.statusOptionRow,
                      property.status === s.id && { borderColor: s.color, borderWidth: 1.5, backgroundColor: s.bg },
                    ]}
                    disabled={updatingStatus}
                    onPress={() => handleStatusChange(s.id)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.statusOptionText, property.status === s.id && { fontWeight: '800', color: s.color }]}>
                      {s.label}
                    </Text>
                    {property.status === s.id && (
                      <Ionicons name="checkmark-circle" size={16} color={s.color} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {updatingStatus && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                  <ActivityIndicator size="small" color="#1D4ED8" />
                  <Text style={{ fontSize: 12, color: '#1D4ED8' }}>Saving status change...</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
      {/* Modal: Log Owner Conversation & Follow-up */}
      {ownerNoteModalVisible && (
        <Modal visible={ownerNoteModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Log Owner Follow-up</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary, marginTop: 2 }}>
                    Unit #{property.property_id} • Owner: {property.owner_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setOwnerNoteModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Category Chips */}
                <Text style={styles.formLabel}>Conversation Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {[
                    '📞 Owner Call',
                    '💰 Rent / Price Talk',
                    '🔑 Key / Access',
                    '📅 Availability Update',
                    '🛠️ Repair / Inspection',
                  ].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        ownerNoteCategory === cat && styles.catChipActive,
                      ]}
                      onPress={() => setOwnerNoteCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          ownerNoteCategory === cat && styles.catChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Note Remarks Textarea */}
                <Text style={styles.formLabel}>Conversation Notes / Agreement *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="e.g. Owner agreed to negotiate rent down to ₹62k for families. Keys with Gate 2 guard."
                  placeholderTextColor={themeTokens.colors.textSecondary}
                  multiline
                  value={ownerNoteText}
                  onChangeText={setOwnerNoteText}
                />

                {/* Schedule Next Call with Owner */}
                <View style={{ marginVertical: 10 }}>
                  <DateTimePickerField
                    label="Schedule Next Owner Call (Optional)"
                    value={ownerNextCallDate}
                    onChangeValue={setOwnerNextCallDate}
                    placeholder="Pick date & time from calendar & clock..."
                    helperText="If set, this will appear in your Daily Schedule as an owner callback."
                  />
                </View>
              </ScrollView>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setOwnerNoteModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, savingOwnerNote && { opacity: 0.7 }]}
                  onPress={handleSaveOwnerNote}
                  disabled={savingOwnerNote}
                >
                  {savingOwnerNote ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>Save Owner Note</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingTop: STATUSBAR_HEIGHT,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  backBtnError: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  backBtnErrorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  topBarCenter: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  topBarSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
    padding: 16,
  },
  statusToastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  statusToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
  },
  heroRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  idBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  statusPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pricingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  priceSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
  },
  priceUnit: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  negBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  negBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  transTypeBox: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  transTypeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  societyName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  locationAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  tabButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  tabContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  specItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  specLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  specValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 1,
  },
  notesSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notesSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  notesBody: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  financialList: {
    gap: 10,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  finLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  finVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  finValBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    marginBottom: 4,
  },
  chargeName: {
    fontSize: 12,
    color: '#4B5563',
  },
  chargeAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  contactCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  contactPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  contactActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingVertical: 8,
    borderRadius: 6,
  },
  callContactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  waContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 8,
    borderRadius: 6,
  },
  waContactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyMatchesBox: {
    alignItems: 'center',
    padding: 24,
  },
  emptyMatchesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
    marginTop: 8,
  },
  emptyMatchesSub: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  matchItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  matchCustomerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  matchEnquiryId: {
    fontSize: 10,
    color: '#64748B',
  },
  matchBudgetPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  matchBudgetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  matchLookingFor: {
    fontSize: 11.5,
    color: '#4B5563',
    marginBottom: 10,
  },
  matchActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scheduleShowingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1D4ED8',
    paddingVertical: 7,
    borderRadius: 6,
  },
  scheduleShowingBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  callMatchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callMatchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 0,
  },
  bottomScheduleBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    borderRadius: 8,
  },
  bottomScheduleBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomWaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 8,
  },
  bottomWaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    elevation: 0,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  statusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  statusOptionText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
  },
  logOwnerNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
  },
  logOwnerNoteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  ownerNotesHistoryCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  ownerNotesHistoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  addOwnerNoteLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  ownerNotesHistoryText: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 18,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
    color: '#1E293B',
    marginBottom: 10,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
