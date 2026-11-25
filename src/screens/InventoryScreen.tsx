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
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { EmptyState } from '../components/ui/EmptyState';
import {
  mobileApi,
  MobileProperty,
  MobileSociety,
  MobileMasterOption,
  AutocompleteSuggestion,
  validateMobileNumber,
} from '../services/api';
import { AutocompleteIdInput } from '../components/AutocompleteIdInput';
import { PropertyDetailScreen } from './PropertyDetailScreen';
import { DateTimePickerField } from '../components/DateTimePickerModal';

interface InventoryScreenProps {
  onAddProperty?: () => void;
  onSelectProperty?: (propertyId: string) => void;
  initialAction?: string;
  onActionHandled?: () => void;
  targetPropertyId?: string;
  onClearTargetPropertyId?: () => void;
  onScheduleVisitForProperty?: (propertyId: string) => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  initialAction,
  onActionHandled,
  targetPropertyId,
  onClearTargetPropertyId,
  onScheduleVisitForProperty,
}) => {
  const [properties, setProperties] = useState<MobileProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Rented' | 'Sold' | 'Rent' | 'Sale'>('All');

  // Live Autocomplete Suggestions
  const [liveSuggestions, setLiveSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Filter & Sort Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [filterBhk, setFilterBhk] = useState<string>('All');
  const [filterPriceRange, setFilterPriceRange] = useState<string>('All');

  // Add Property Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [societies, setSocieties] = useState<MobileSociety[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<MobileMasterOption[]>([]);
  const [locations, setLocations] = useState<MobileMasterOption[]>([]);

  // Form State
  const [formTransaction, setFormTransaction] = useState<'rent' | 'sale'>('rent');
  const [formPropertyType, setFormPropertyType] = useState('3 BHK');
  const [formSocietyId, setFormSocietyId] = useState('');
  const [formSocietyName, setFormSocietyName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formNegotiable, setFormNegotiable] = useState(true);
  const [formMaintenanceMode, setFormMaintenanceMode] = useState<'included' | 'extra'>('extra');
  const [formMaintenanceAmount, setFormMaintenanceAmount] = useState('');
  const [formSecurityDeposit, setFormSecurityDeposit] = useState('');
  const [formTenantType, setFormTenantType] = useState('Family Only');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formOwnerPhone, setFormOwnerPhone] = useState('');
  const [formAgentName, setFormAgentName] = useState('');
  const [formAgentPhone, setFormAgentPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAvailableDate, setFormAvailableDate] = useState('');
  const [formAdditionalCharges, setFormAdditionalCharges] = useState<
    Array<{ name: string; amount: string; frequency: 'one_time' | 'monthly' }>
  >([]);
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [newChargeFrequency, setNewChargeFrequency] = useState<'one_time' | 'monthly'>('monthly');
  const [societyModalVisible, setSocietyModalVisible] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);

  // Detail Modal State
  const [detailProperty, setDetailProperty] = useState<MobileProperty | null>(null);

  useEffect(() => {
    if (targetPropertyId) {
      const targetUpper = targetPropertyId.trim().toUpperCase();
      const found = properties.find((p) => p.property_id.toUpperCase() === targetUpper || p.id === targetPropertyId);
      if (found) {
        setDetailProperty(found);
      } else {
        mobileApi.getProperty(targetPropertyId).then((p) => {
          if (p) setDetailProperty(p);
        }).catch((err) => {
          console.warn('Could not load target property:', err);
        });
      }
    }
  }, [targetPropertyId, properties]);

  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (text.trim().length >= 1) {
      setSearchLoading(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await mobileApi.getSuggestions(text.trim(), 'property', 6);
          setLiveSuggestions(res.suggestions || []);
          setIsSearchSuggestionsOpen((res.suggestions || []).length > 0);
        } catch {
          setLiveSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
        fetchPropertiesWithQuery(text.trim());
      }, 250);
    } else {
      setLiveSuggestions([]);
      setIsSearchSuggestionsOpen(false);
      setSearchLoading(false);
      searchDebounceRef.current = setTimeout(() => {
        fetchPropertiesWithQuery('');
      }, 250);
    }
  };

  const fetchPropertiesWithQuery = async (queryText?: string) => {
    try {
      const q = queryText !== undefined ? queryText : searchQuery;
      const typeFilter = statusFilter === 'Rent' ? 'rent' : statusFilter === 'Sale' ? 'sale' : undefined;
      const res = await mobileApi.getProperties(q.trim() || undefined, typeFilter);
      let items = res.items || [];
      if (statusFilter === 'Available') items = items.filter((p) => p.status === 'available');
      if (statusFilter === 'Rented') items = items.filter((p) => p.status === 'rented');
      if (statusFilter === 'Sold') items = items.filter((p) => p.status === 'sold');

      // Extended filters
      if (filterBhk !== 'All') {
        items = items.filter((p) => (p.property_type || '').toLowerCase().includes(filterBhk.toLowerCase()));
      }
      if (filterPriceRange === 'under_25k') {
        items = items.filter((p) => (p.expected_amount || 0) < 25000);
      } else if (filterPriceRange === '25k_50k') {
        items = items.filter((p) => (p.expected_amount || 0) >= 25000 && (p.expected_amount || 0) <= 50000);
      } else if (filterPriceRange === '50k_1l') {
        items = items.filter((p) => (p.expected_amount || 0) > 50000 && (p.expected_amount || 0) <= 100000);
      } else if (filterPriceRange === 'above_1l') {
        items = items.filter((p) => (p.expected_amount || 0) > 100000);
      }

      // Sort
      if (sortBy === 'price_asc') {
        items.sort((a, b) => (a.expected_amount || 0) - (b.expected_amount || 0));
      } else if (sortBy === 'price_desc') {
        items.sort((a, b) => (b.expected_amount || 0) - (a.expected_amount || 0));
      } else if (sortBy === 'newest') {
        items.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      }

      setProperties(items);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProperties = () => fetchPropertiesWithQuery();

  const fetchDropdowns = async () => {
    try {
      const [socRes, ptRes, locRes] = await Promise.all([
        mobileApi.getSocieties(),
        mobileApi.getMasterData('property_type'),
        mobileApi.getMasterData('location'),
      ]);
      setSocieties(socRes);
      if (socRes.length > 0) {
        setFormSocietyId(socRes[0].society_id || socRes[0].id);
        setFormSocietyName(socRes[0].name);
      }
      setPropertyTypes(ptRes);
      if (ptRes.length > 0) setFormPropertyType(ptRes[0].value);
      setLocations(locRes);
      if (locRes.length > 0) setFormLocation(locRes[0].value);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchDropdowns();
  }, [statusFilter, filterBhk, filterPriceRange, sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProperties();
  };

  const handleShareWhatsApp = (item: MobileProperty) => {
    const priceStr =
      item.transaction_type === 'rent'
        ? `₹${item.expected_amount.toLocaleString('en-IN')}/month`
        : `₹${(item.expected_amount / 10000000).toFixed(2)} Cr`;
    const text =
      `*Property Ref #${item.property_id}*\n` +
      `*Type:* ${item.property_type} (${item.transaction_type.toUpperCase()})\n` +
      `*Society:* ${item.society_name}, ${item.location}\n` +
      `*Expected Price:* ${priceStr}\n` +
      `*Tenant Preference:* ${item.tenant_type || 'Family / Bachelors'}\n\n` +
      `_Shared via G² Brothers CRM_`;

    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('Notice', 'WhatsApp is not installed on this device.');
    });
  };

  const handleAddChargeItem = () => {
    if (!newChargeName.trim() || !newChargeAmount.trim()) {
      Alert.alert('Charge Details', 'Please enter charge name and amount.');
      return;
    }
    setFormAdditionalCharges([
      ...formAdditionalCharges,
      {
        name: newChargeName.trim(),
        amount: newChargeAmount.trim(),
        frequency: newChargeFrequency,
      },
    ]);
    setNewChargeName('');
    setNewChargeAmount('');
    setShowAddChargeModal(false);
  };

  const handleRemoveChargeItem = (index: number) => {
    setFormAdditionalCharges(formAdditionalCharges.filter((_, idx) => idx !== index));
  };

  const handleCreateProperty = async () => {
    const cleanPrice = formPrice.trim();
    const cleanOwnerName = formOwnerName.trim();
    const cleanOwnerPhone = formOwnerPhone.trim();

    if (!cleanPrice) {
      Alert.alert('Required Field', 'Please fill expected price/rent amount.');
      return;
    }

    if (!cleanOwnerName || cleanOwnerName.length < 2) {
      Alert.alert('Required Field', 'Property Owner Name is compulsory (min 2 characters).');
      return;
    }

    const ownerPhoneVal = validateMobileNumber(cleanOwnerPhone, 'Property Owner Mobile Number');
    if (!ownerPhoneVal.valid) {
      Alert.alert('Compulsory Mobile Number', ownerPhoneVal.error);
      return;
    }

    if (formAgentPhone.trim()) {
      const agentPhoneVal = validateMobileNumber(formAgentPhone.trim(), 'Agent Mobile Number');
      if (!agentPhoneVal.valid) {
        Alert.alert('Invalid Agent Phone', agentPhoneVal.error);
        return;
      }
    }

    setSavingProperty(true);
    try {
      let finalNotes = formNotes.trim();
      if (formAvailableDate) {
        const availStr = new Date(formAvailableDate).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        finalNotes = finalNotes ? `${finalNotes} | Available From: ${availStr}` : `Available From: ${availStr}`;
      }

      const payload: any = {
        transaction_type: formTransaction,
        property_type: formPropertyType,
        society_id: formSocietyId || (societies[0]?.society_id || 'SOC0001'),
        location: formLocation,
        expected_amount: parseFloat(cleanPrice),
        negotiable: formNegotiable,
        maintenance_mode: formMaintenanceMode,
        owner_name: cleanOwnerName,
        owner_phone: cleanOwnerPhone,
        tenant_type: formTenantType,
        notes: finalNotes || undefined,
      };

      if (formAvailableDate) {
        payload.possession_date = formAvailableDate;
      }

      if (formTransaction === 'rent') {
        if (formMaintenanceMode === 'extra' && formMaintenanceAmount) {
          payload.maintenance_amount = parseFloat(formMaintenanceAmount);
        }
        if (formSecurityDeposit) {
          payload.security_deposit = parseFloat(formSecurityDeposit);
        }
      }

      if (formAgentName.trim()) payload.agent_name = formAgentName.trim();
      if (formAgentPhone.trim()) payload.agent_phone = formAgentPhone.trim();

      if (formAdditionalCharges.length > 0) {
        payload.additional_charges = formAdditionalCharges.map((c) => ({
          name: c.name,
          amount: parseFloat(c.amount) || 0,
          frequency: c.frequency,
        }));
      }

      await mobileApi.createProperty(payload);
      Alert.alert('Success', 'Property successfully added to enterprise inventory.');
      setAddModalVisible(false);
      setFormPrice('');
      setFormOwnerName('');
      setFormOwnerPhone('');
      setFormAgentName('');
      setFormAgentPhone('');
      setFormMaintenanceAmount('');
      setFormSecurityDeposit('');
      setFormAdditionalCharges([]);
      setFormAvailableDate('');
      setFormNotes('');
      fetchProperties();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create property.');
    } finally {
      setSavingProperty(false);
    }
  };

  const formatPrice = (p: MobileProperty) => {
    if (p.transaction_type === 'rent') {
      return `₹${p.expected_amount.toLocaleString('en-IN')}`;
    }
    if (p.expected_amount >= 10000000) {
      return `₹${(p.expected_amount / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(p.expected_amount / 100000).toFixed(2)} L`;
  };

  // Pipeline total calculation
  const totalPipelineValue = properties.reduce((acc, p) => acc + (p.expected_amount || 0), 0);
  const pipelineStr =
    totalPipelineValue >= 10000000
      ? `₹${(totalPipelineValue / 10000000).toFixed(2)} Cr`
      : `₹${(totalPipelineValue / 100000).toFixed(2)} L`;

  return (
    <View style={styles.container}>
      {/* Search & Action Row with Live Keystroke Autocomplete */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputBox}>
          <Ionicons name="search" size={16} color={themeTokens.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID, Society, Unit (2-3 chars)..."
            value={searchQuery}
            onChangeText={handleSearchTextChange}
            onSubmitEditing={fetchProperties}
            placeholderTextColor="#9CA3AF"
          />
          {searchLoading && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchTextChange('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, (filterBhk !== 'All' || filterPriceRange !== 'All') && { backgroundColor: '#EFF6FF', borderColor: '#1D4ED8' }]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filterBhk !== 'All' || filterPriceRange !== 'All' ? '#1D4ED8' : themeTokens.colors.textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, sortBy !== 'newest' && { backgroundColor: '#EFF6FF', borderColor: '#1D4ED8' }]}
          onPress={() => setSortModalVisible(true)}
        >
          <Ionicons
            name="swap-vertical"
            size={18}
            color={sortBy !== 'newest' ? '#1D4ED8' : themeTokens.colors.textPrimary}
          />
        </TouchableOpacity>
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
              key={sug.id}
              style={styles.liveSuggestionRow}
              onPress={() => {
                setSearchQuery(sug.id);
                setIsSearchSuggestionsOpen(false);
                const matched = properties.find((p) => p.property_id === sug.id);
                if (matched) {
                  setDetailProperty(matched);
                } else {
                  fetchPropertiesWithQuery(sug.id);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.liveSuggestionIconBox}>
                <Ionicons name="home" size={14} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.liveSuggestionTitle} numberOfLines={1}>
                    {sug.title}
                  </Text>
                  <View
                    style={[
                      styles.badgePillSmall,
                      { backgroundColor: sug.badge.toUpperCase() === 'AVAILABLE' ? '#DEF7EC' : '#FDE8E8' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: sug.badge.toUpperCase() === 'AVAILABLE' ? '#03543F' : '#9B1C1C',
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

      {/* Filter Chips Bar matching Stitch Image 1 */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'All', label: `All (${properties.length})` },
            { id: 'Available', label: 'Available' },
            { id: 'Rented', label: 'Rented' },
            { id: 'Sold', label: 'Sold' },
            { id: 'Rent', label: 'For Rent' },
            { id: 'Sale', label: 'For Sale' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[styles.filterChip, statusFilter === chip.id && styles.filterChipActive]}
              onPress={() => setStatusFilter(chip.id as any)}
            >
              <Text style={[styles.filterChipText, statusFilter === chip.id && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Portfolio Subheader matching Stitch Image 1 */}
      <View style={styles.subHeaderRow}>
        <Text style={styles.subHeaderLeft}>
          <Text style={{ color: themeTokens.colors.primaryDark }}>●</Text> Portfolio: {properties.length} Properties
        </Text>
        <Text style={styles.subHeaderRight}>Active Pipeline: {pipelineStr}</Text>
      </View>

      {/* Property Cards List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeTokens.colors.primaryDark} />
          <Text style={styles.loadingText}>Loading inventory portfolio...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.cardsScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {properties.length === 0 ? (
            <EmptyState
              title="No Properties Found"
              description="No properties match your active filter. Use the Add Property button to register a unit."
              actionLabel="Add Property"
              onAction={() => setAddModalVisible(true)}
              iconName="home-outline"
            />
          ) : (
            properties.map((item) => (
              <TouchableOpacity
                key={item.property_id}
                style={styles.propertyCard}
                onPress={() => setDetailProperty(item)}
                activeOpacity={0.88}
              >
                {/* Header Pills Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.propIdBox}>
                    <Text style={styles.propIdText}>#{item.property_id}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === 'available' ? '#DEF7EC' : item.status === 'rented' ? '#EBEBF7' : '#FDE8E8',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            item.status === 'available' ? '#03543F' : item.status === 'rented' ? '#1D4ED8' : '#9B1C1C',
                        },
                      ]}
                    >
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.transactionBadge}>
                    <Text style={styles.transactionBadgeText}>
                      {item.transaction_type === 'rent' ? 'For Rent' : 'For Sale'}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.propertyTitle}>
                  {item.property_type} Apartment {item.notes ? `• ${item.notes.slice(0, 30)}` : ''}
                </Text>

                {/* Location */}
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={themeTokens.colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.society_name} ({item.society_id}), {item.location}
                  </Text>
                </View>

                {/* Pricing Details Row */}
                <View style={styles.pricingRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={styles.priceValue}>{formatPrice(item)}</Text>
                    {item.transaction_type === 'rent' && <Text style={styles.pricePeriod}>/ month</Text>}
                  </View>
                  {item.transaction_type === 'rent' ? (
                    <Text style={styles.maintText}>
                      Maint: {item.maintenance_mode === 'included' ? 'Included' : `₹${item.maintenance_amount || 0} Extra/mo`}
                    </Text>
                  ) : (
                    <Text style={styles.maintText}>Freehold Clear Title</Text>
                  )}
                </View>

                {/* Sub-details (Deposit, Tenant type, Owner) */}
                <View style={styles.detailsRow}>
                  {item.security_deposit ? (
                    <Text style={styles.detailItemText}>
                      🔒 Deposit: ₹{(item.security_deposit / 100000).toFixed(2)}L •{' '}
                    </Text>
                  ) : null}
                  <Text style={styles.detailItemText}>👥 {item.tenant_type || 'Family Only'} • </Text>
                  <Text style={styles.detailItemText}>👤 Owner: {item.owner_name}</Text>
                </View>

                {/* Card Actions Row matching Stitch Image 1 */}
                <View style={styles.cardActionsRow}>
                  {/* View Details Primary Button */}
                  <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() => setDetailProperty(item)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="eye-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.viewDetailsBtnText}>View Details</Text>
                  </TouchableOpacity>

                  {/* Share on WhatsApp button */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleShareWhatsApp(item)}
                  >
                    <Ionicons name="share-social-outline" size={16} color={themeTokens.colors.primaryDark} />
                  </TouchableOpacity>

                  {/* 3-dots Menu button */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => setDetailProperty(item)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={themeTokens.colors.primaryDark} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Action Button: + Add Property matching Stitch Image 1 */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.fabBtnText}>Add Property</Text>
      </TouchableOpacity>

      {/* Full-Screen Property Detail Dossier */}
      {detailProperty && (
        <Modal
          visible={Boolean(detailProperty)}
          animationType="slide"
          onRequestClose={() => setDetailProperty(null)}
        >
          <PropertyDetailScreen
            propertyId={detailProperty.property_id}
            initialProperty={detailProperty}
            onClose={() => {
              setDetailProperty(null);
              if (onClearTargetPropertyId) onClearTargetPropertyId();
            }}
            onScheduleVisit={(propId) => {
              setDetailProperty(null);
              if (onScheduleVisitForProperty) {
                onScheduleVisitForProperty(propId);
              }
            }}
            onPropertyUpdated={(updated) => {
              setProperties((prev) =>
                prev.map((p) => (p.property_id === updated.property_id ? updated : p))
              );
              setDetailProperty(updated);
            }}
          />
        </Modal>
      )}

      {/* Modal 2: Add Property Modal matching Web Super Admin Console (Image media_1795160289257_d0eb551f.png) */}
      {addModalVisible && (
        <Modal visible={addModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Add Property Inventory</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Direct unit provisioning into active portfolio
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* SECTION 1: Property Specifications */}
                <Text style={styles.sectionHeadingText}>1. Property Specifications</Text>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Transaction Type *</Text>
                  <View style={styles.segmentRow}>
                    <TouchableOpacity
                      style={[styles.segmentBtn, formTransaction === 'rent' && styles.segmentBtnActive]}
                      onPress={() => setFormTransaction('rent')}
                    >
                      <Text style={[styles.segmentBtnText, formTransaction === 'rent' && styles.segmentBtnTextActive]}>
                        For Rent
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segmentBtn, formTransaction === 'sale' && styles.segmentBtnActive]}
                      onPress={() => setFormTransaction('sale')}
                    >
                      <Text style={[styles.segmentBtnText, formTransaction === 'sale' && styles.segmentBtnTextActive]}>
                        For Sale
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Configuration / BHK Chips */}
                <Text style={styles.formLabel}>Property Type (BHK) *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', 'Villa', 'Studio', 'Penthouse', 'Office Space'].map((bhk) => (
                      <TouchableOpacity
                        key={bhk}
                        style={[
                          styles.chipOption,
                          formPropertyType === bhk && styles.chipOptionActive,
                        ]}
                        onPress={() => setFormPropertyType(bhk)}
                      >
                        <Text
                          style={[
                            styles.chipOptionText,
                            formPropertyType === bhk && styles.chipOptionTextActive,
                          ]}
                        >
                          {bhk}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Society Selector matching Web */}
                <Text style={styles.formLabel}>Society *</Text>
                <TouchableOpacity
                  style={styles.dropdownSelectorBtn}
                  onPress={() => setSocietyModalVisible(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="business-outline" size={16} color="#1D4ED8" />
                    <Text style={styles.dropdownSelectorText}>
                      {formSocietyName || formSocietyId || 'Select Society from Master List'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Area / Location */}
                <Text style={styles.formLabel}>Area / Location *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Sector 62 Gurgaon"
                  value={formLocation}
                  onChangeText={setFormLocation}
                  placeholderTextColor="#9CA3AF"
                />

                {/* SECTION 2: Pricing & Maintenance */}
                <Text style={[styles.sectionHeadingText, { marginTop: 16 }]}>2. Pricing & Maintenance</Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>
                      {formTransaction === 'rent' ? 'Expected Rent (Monthly) (₹) *' : 'Expected Sale Price (₹) *'}
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder={formTransaction === 'rent' ? 'e.g. 65000' : 'e.g. 28500000'}
                      value={formPrice}
                      onChangeText={setFormPrice}
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {formTransaction === 'rent' && (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Security Deposit (₹)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. 130000"
                        value={formSecurityDeposit}
                        onChangeText={setFormSecurityDeposit}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  )}
                </View>

                {/* Maintenance Mode for Rent */}
                {formTransaction === 'rent' && (
                  <>
                    <Text style={styles.formLabel}>Maintenance *</Text>
                    <View style={styles.segmentRow}>
                      <TouchableOpacity
                        style={[styles.segmentBtn, formMaintenanceMode === 'included' && styles.segmentBtnActive]}
                        onPress={() => setFormMaintenanceMode('included')}
                      >
                        <Text style={[styles.segmentBtnText, formMaintenanceMode === 'included' && styles.segmentBtnTextActive]}>
                          Included in Rent
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.segmentBtn, formMaintenanceMode === 'extra' && styles.segmentBtnActive]}
                        onPress={() => setFormMaintenanceMode('extra')}
                      >
                        <Text style={[styles.segmentBtnText, formMaintenanceMode === 'extra' && styles.segmentBtnTextActive]}>
                          Extra Monthly
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {formMaintenanceMode === 'extra' && (
                      <TextInput
                        style={[styles.formInput, { marginTop: 8 }]}
                        placeholder="Monthly maintenance amount (₹) e.g. 5200"
                        value={formMaintenanceAmount}
                        onChangeText={setFormMaintenanceAmount}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    )}
                  </>
                )}

                {/* Negotiable Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setFormNegotiable(!formNegotiable)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={formNegotiable ? 'checkbox' : 'square-outline'}
                    size={18}
                    color="#1D4ED8"
                  />
                  <Text style={styles.checkboxLabel}>Price is Negotiable</Text>
                </TouchableOpacity>

                {/* Additional Charges (Dynamic Manager) */}
                <View style={styles.additionalChargesHeaderRow}>
                  <Text style={styles.formLabel}>Additional Charges (Optional)</Text>
                  <TouchableOpacity
                    style={styles.addChargeSmallBtn}
                    onPress={() => setShowAddChargeModal(true)}
                  >
                    <Ionicons name="add" size={14} color="#1D4ED8" />
                    <Text style={styles.addChargeSmallBtnText}>Add Charge</Text>
                  </TouchableOpacity>
                </View>

                {formAdditionalCharges.length > 0 && (
                  <View style={{ gap: 6, marginBottom: 10 }}>
                    {formAdditionalCharges.map((ch, idx) => (
                      <View key={idx} style={styles.chargeItemCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chargeItemName}>{ch.name}</Text>
                          <Text style={styles.chargeItemSub}>
                            ₹{parseFloat(ch.amount).toLocaleString('en-IN')} • {ch.frequency === 'one_time' ? 'One-time' : 'Monthly'}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveChargeItem(idx)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* SECTION 3: Owner & Contact Details */}
                <Text style={[styles.sectionHeadingText, { marginTop: 16 }]}>3. Owner & Contact Details</Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Owner Name *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Rajiv Khanna"
                      value={formOwnerName}
                      onChangeText={setFormOwnerName}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Owner Phone *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="+91 98111 22334"
                      value={formOwnerPhone}
                      onChangeText={setFormOwnerPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Channel Partner / Agent Details */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Agent / CP Name</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Deepak Realties"
                      value={formAgentName}
                      onChangeText={setFormAgentName}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Agent Phone</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="+91 98222 33445"
                      value={formAgentPhone}
                      onChangeText={setFormAgentPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Tenant Policy Chips */}
                <Text style={styles.formLabel}>Tenant Policy / Preference</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['Family Only', 'Bachelors OK', 'Company Lease', 'Any'].map((pol) => (
                    <TouchableOpacity
                      key={pol}
                      style={[
                        styles.chipOption,
                        formTenantType === pol && styles.chipOptionActive,
                      ]}
                      onPress={() => setFormTenantType(pol)}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          formTenantType === pol && styles.chipOptionTextActive,
                        ]}
                      >
                        {pol}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ marginTop: 6, marginBottom: 10 }}>
                  <DateTimePickerField
                    mode="date"
                    label="Available / Possession Date (Optional)"
                    value={formAvailableDate}
                    onChangeValue={setFormAvailableDate}
                    placeholder="Select possession date from calendar..."
                  />
                </View>

                <Text style={styles.formLabel}>Internal Notes / Features</Text>
                <TextInput
                  style={[styles.formInput, { height: 60 }]}
                  placeholder="Corner unit, morning sunlight, key with security gate..."
                  value={formNotes}
                  onChangeText={setFormNotes}
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
                  style={[styles.modalSubmitBtn, savingProperty && { opacity: 0.8 }]}
                  onPress={handleCreateProperty}
                  disabled={savingProperty}
                >
                  {savingProperty ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText} numberOfLines={1}>Add Property Unit</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal 3: Society Selector Modal */}
      {societyModalVisible && (
        <Modal visible={societyModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 400 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Society</Text>
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
                        setFormSocietyId(soc.society_id || soc.id);
                        setFormSocietyName(soc.name);
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

      {/* Modal 4: Add Additional Charge Mini-Modal */}
      {showAddChargeModal && (
        <Modal visible={showAddChargeModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { width: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Additional Charge</Text>
                <TouchableOpacity onPress={() => setShowAddChargeModal(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Charge Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Club Membership, Car Parking"
                value={newChargeName}
                onChangeText={setNewChargeName}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>Charge Amount (₹) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 1500"
                value={newChargeAmount}
                onChangeText={setNewChargeAmount}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>Frequency</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentBtn, newChargeFrequency === 'monthly' && styles.segmentBtnActive]}
                  onPress={() => setNewChargeFrequency('monthly')}
                >
                  <Text style={[styles.segmentBtnText, newChargeFrequency === 'monthly' && styles.segmentBtnTextActive]}>
                    Monthly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, newChargeFrequency === 'one_time' && styles.segmentBtnActive]}
                  onPress={() => setNewChargeFrequency('one_time')}
                >
                  <Text style={[styles.segmentBtnText, newChargeFrequency === 'one_time' && styles.segmentBtnTextActive]}>
                    One-Time
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddChargeModal(false)}
                >
                  <Text style={styles.modalCancelBtnText} numberOfLines={1}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleAddChargeItem}
                >
                  <Text style={styles.modalSubmitBtnText} numberOfLines={1}>Add Charge</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Real Filter Modal */}
      {filterModalVisible && (
        <Modal visible={filterModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { width: '90%', maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Filter Inventory</Text>
                  <Text style={{ fontSize: 11, color: themeTokens.colors.textSecondary }}>
                    Refine property pipeline by BHK, Price & Status
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {/* 1. BHK / Property Type */}
                <Text style={styles.formLabel}>Property Type / Configuration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {['All', '1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa', 'Commercial'].map((bhk) => (
                    <TouchableOpacity
                      key={bhk}
                      style={[
                        styles.filterModalChip,
                        filterBhk === bhk && styles.filterModalChipActive,
                      ]}
                      onPress={() => setFilterBhk(bhk)}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          filterBhk === bhk && styles.filterModalChipTextActive,
                        ]}
                      >
                        {bhk}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 2. Budget / Expected Price Range */}
                <Text style={styles.formLabel}>Budget / Price Range</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[
                    { id: 'All', label: 'All Budgets' },
                    { id: 'under_25k', label: '< ₹25,000' },
                    { id: '25k_50k', label: '₹25k - ₹50k' },
                    { id: '50k_1l', label: '₹50k - ₹1 Lakh' },
                    { id: 'above_1l', label: '> ₹1 Lakh' },
                  ].map((pr) => (
                    <TouchableOpacity
                      key={pr.id}
                      style={[
                        styles.filterModalChip,
                        filterPriceRange === pr.id && styles.filterModalChipActive,
                      ]}
                      onPress={() => setFilterPriceRange(pr.id)}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          filterPriceRange === pr.id && styles.filterModalChipTextActive,
                        ]}
                      >
                        {pr.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 3. Transaction Type */}
                <Text style={styles.formLabel}>Transaction Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['All', 'Rent', 'Sale'].map((tt) => (
                    <TouchableOpacity
                      key={tt}
                      style={[
                        styles.filterModalChip,
                        (tt === 'All' ? (statusFilter !== 'Rent' && statusFilter !== 'Sale') : statusFilter === tt) && styles.filterModalChipActive,
                      ]}
                      onPress={() => setStatusFilter(tt as any)}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          (tt === 'All' ? (statusFilter !== 'Rent' && statusFilter !== 'Sale') : statusFilter === tt) && styles.filterModalChipTextActive,
                        ]}
                      >
                        {tt === 'All' ? 'All (Rent & Sale)' : tt === 'Rent' ? 'Rental Units' : 'Outright Sale'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { flex: 1 }]}
                  onPress={() => {
                    setFilterBhk('All');
                    setFilterPriceRange('All');
                    setStatusFilter('All');
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.modalCancelBtnText} numberOfLines={1}>Reset All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { flex: 1.5 }]}
                  onPress={() => {
                    setFilterModalVisible(false);
                    fetchProperties();
                  }}
                >
                  <Text style={styles.modalSubmitBtnText} numberOfLines={1}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Real Sort Modal */}
      {sortModalVisible && (
        <Modal visible={sortModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { width: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sort Properties</Text>
                <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                  <Ionicons name="close" size={20} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8, marginVertical: 10 }}>
                {[
                  { id: 'newest', label: 'Newest Added First', icon: 'time-outline' },
                  { id: 'price_asc', label: 'Price: Low to High', icon: 'arrow-up-outline' },
                  { id: 'price_desc', label: 'Price: High to Low', icon: 'arrow-down-outline' },
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
                    <Ionicons name={s.icon as any} size={16} color={sortBy === s.id ? '#1D4ED8' : '#6B7280'} style={{ marginRight: 8 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInputBox: {
    flex: 1,
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#1D4ED8', // Stitch primary
    borderColor: '#1D4ED8',
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
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  subHeaderLeft: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  subHeaderRight: {
    fontSize: 11,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
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
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  propIdBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  propIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeTokens.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  transactionBadge: {
    marginLeft: 'auto',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transactionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    flex: 1,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  pricePeriod: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  maintText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailItemText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  viewDetailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8', // Stitch primary dark slate
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF', // Soft lavender
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 0,
    elevation: 0,
  },
  fabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
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
  ownerContactContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeModalBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  formRow: {
    marginBottom: 10,
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
    backgroundColor: '#1D4ED8',
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
    gap: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1.6,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sectionHeadingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
  },
  additionalChargesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  addChargeSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  addChargeSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  chargeItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chargeItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  chargeItemSub: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
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
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    elevation: 0,
    alignSelf: 'center',
  },
  liveSuggestionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    maxHeight: 240,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 0,
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
  filterModalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterModalChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  filterModalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterModalChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
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
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  sortOptionTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
});
