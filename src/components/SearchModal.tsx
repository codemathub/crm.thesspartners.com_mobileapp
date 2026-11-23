import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal as RNModal,
  SafeAreaView,
  Linking,
  Alert,
  Share,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, MobileSearchResultItem } from '../services/api';

export interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectResult: (type: 'property' | 'customer' | 'enquiry', id: string) => void;
  onOpenNotifications?: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  onSelectResult,
  onOpenNotifications,
}) => {
  const [query, setQuery] = useState('');
  const [activeScope, setActiveScope] = useState<'all' | 'properties' | 'enquiries' | 'customers'>('all');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [results, setResults] = useState<MobileSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await mobileApi.globalSearch(trimmed, activeScope);
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, activeScope, visible]);

  const handleRemoveCriterion = (item: string) => {
    setCriteria((prev) => prev.filter((c) => c !== item));
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
  };

  const handleClearRecent = () => {
    setRecentQueries([]);
  };

  const handleCallClient = (phone?: string) => {
    if (!phone) {
      Alert.alert('Notice', 'No phone number available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Notice', 'Phone dialer could not be opened on this device.');
    });
  };

  const handleMessageClient = (phone?: string) => {
    if (!phone) {
      Alert.alert('Notice', 'No phone number available.');
      return;
    }
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`).catch(() => {
      Alert.alert('Notice', 'Messaging application could not be opened.');
    });
  };

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header matching Stitch Image */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconBox}>
              <Ionicons name="business" size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brandTitle}>EstateCRM</Text>
              <Text style={styles.brandSub}>GLOBAL SEARCH & MATCHER</Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => setFilterDrawerOpen((prev) => !prev)}
            >
              <Ionicons name="funnel-outline" size={16} color="#4F5278" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={onOpenNotifications || onClose}
            >
              <View style={styles.badgeDot} />
              <Ionicons name="notifications-outline" size={16} color="#4F5278" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.avatarCircle} onPress={onClose}>
              <Ionicons name="close" size={18} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Search Input Bar with Filter Button */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#4F5278" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search Property ID, customer, society..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearInputBtn}>
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.filterActionBtn, filterDrawerOpen && styles.filterActionBtnActive]}
              onPress={() => setFilterDrawerOpen((prev) => !prev)}
            >
              <Ionicons name="options-outline" size={18} color="#4F5278" />
            </TouchableOpacity>
          </View>

          {/* Scope Selector Pills */}
          <View style={styles.scopeRow}>
            <TouchableOpacity
              style={[styles.scopePill, activeScope === 'all' && styles.scopePillActive]}
              onPress={() => setActiveScope('all')}
            >
              <Text style={[styles.scopePillText, activeScope === 'all' && styles.scopePillTextActive]}>
                All{results.length > 0 ? <Text style={styles.scopeCount}> {results.length}</Text> : null}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopePill, activeScope === 'properties' && styles.scopePillActive]}
              onPress={() => setActiveScope('properties')}
            >
              <Text style={[styles.scopePillText, activeScope === 'properties' && styles.scopePillTextActive]}>
                Properties{results.length > 0 ? <Text style={styles.scopeCount}> {results.filter((r) => r.type === 'property').length}</Text> : null}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopePill, activeScope === 'enquiries' && styles.scopePillActive]}
              onPress={() => setActiveScope('enquiries')}
            >
              <Text style={[styles.scopePillText, activeScope === 'enquiries' && styles.scopePillTextActive]}>
                Enquiries{results.length > 0 ? <Text style={styles.scopeCount}> {results.filter((r) => r.type === 'enquiry').length}</Text> : null}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopePill, activeScope === 'customers' && styles.scopePillActive]}
              onPress={() => setActiveScope('customers')}
            >
              <Text style={[styles.scopePillText, activeScope === 'customers' && styles.scopePillTextActive]}>
                Customers{results.length > 0 ? <Text style={styles.scopeCount}> {results.filter((r) => r.type === 'customer').length}</Text> : null}
              </Text>
            </TouchableOpacity>
          </View>

          {/* CRITERIA Row */}
          {criteria.length > 0 && (
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaLabel}>CRITERIA:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {criteria.map((item) => (
                  <View key={item} style={styles.criteriaChip}>
                    <Text style={styles.criteriaChipText}>{item}</Text>
                    <TouchableOpacity onPress={() => handleRemoveCriterion(item)} style={{ paddingLeft: 4 }}>
                      <Ionicons name="close" size={13} color="#4F5278" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Recent Queries Cluster */}
          {recentQueries.length > 0 && (
            <View style={styles.recentQueriesBox}>
              <View style={styles.recentHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.recentTitle}>Recent Queries</Text>
                </View>
                <TouchableOpacity onPress={handleClearRecent}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.recentPillsRow}>
                {recentQueries.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={styles.recentPill}
                    onPress={() => handleSelectRecent(q)}
                  >
                    <Text style={styles.recentPillText}>{q}</Text>
                    <Ionicons name="arrow-up-outline" size={12} color="#6B7280" style={{ transform: [{ rotate: '45deg' }] }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Dynamic Search Results State */}
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#4F5278" />
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 10 }}>Searching MongoDB Atlas...</Text>
            </View>
          ) : results.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="search" size={15} color="#1F2937" />
                  <Text style={styles.sectionHeading}>Search Results ({results.length})</Text>
                </View>
                <Text style={styles.sectionSubBadge}>Live Database Records</Text>
              </View>

              {results.map((item) => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={styles.extraResultCard}
                  onPress={() => {
                    onSelectResult(item.type, item.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor:
                        item.type === 'property'
                          ? '#DBEAFE'
                          : item.type === 'customer'
                          ? '#DCFCE7'
                          : '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={
                        item.type === 'property'
                          ? 'business'
                          : item.type === 'customer'
                          ? 'person'
                          : 'document-text'
                      }
                      size={18}
                      color={
                        item.type === 'property'
                          ? '#2563EB'
                          : item.type === 'customer'
                          ? '#16A34A'
                          : '#D97706'
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.extraResultTitle}>{item.title}</Text>
                    <Text style={styles.extraResultSub}>{item.subtitle}</Text>
                  </View>
                  {item.badge && (
                    <View style={styles.extraResultBadge}>
                      <Text style={styles.extraResultBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          ) : query.trim().length >= 1 ? (
            <View style={styles.commercialFallbackBox}>
              <View style={styles.fallbackIconCircle}>
                <Ionicons name="search-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.fallbackTitle}>No records found</Text>
              <Text style={styles.fallbackDesc}>
                We found 0 records matching "{query}". Try searching by customer name, society, property ID, or phone number.
              </Text>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={44} color="#D1D5DB" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 12 }}>
                Global Search
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Type any letters or numbers to instantly search properties, customer leads, and pipeline records.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FD',
    paddingTop: STATUSBAR_HEIGHT,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F8',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#4F5278',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    lineHeight: 18,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    padding: 0,
  },
  clearInputBtn: {
    padding: 4,
  },
  filterActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E3F3',
  },
  filterActionBtnActive: {
    backgroundColor: '#4F5278',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  scopePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scopePillActive: {
    backgroundColor: '#4F5278',
    borderColor: '#4F5278',
  },
  scopePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  scopePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scopeCount: {
    fontSize: 11,
    opacity: 0.8,
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  criteriaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  criteriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF0F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8DBF0',
  },
  criteriaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F5278',
  },
  recentQueriesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F5278',
  },
  recentPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  recentPillText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  matcherBanner: {
    backgroundColor: '#EEF0F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDE0F4',
  },
  matcherTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F5278',
  },
  matcherDesc: {
    fontSize: 11,
    color: '#4F5278',
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  sectionSubBadge: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTagsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeTag: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rentTag: {
    backgroundColor: '#EEF0F8',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  rentTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F5278',
  },
  availablePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  availablePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  propertySub: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  pricingBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pricingLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  pricingVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  pricingUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  matchScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  attributeBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 14,
  },
  attrBadge: {
    backgroundColor: '#EEF0F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attrBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F5278',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  viewPropertyBtn: {
    flex: 1,
    backgroundColor: '#4F5278',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    height: 38,
  },
  viewPropertyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconCircleAction: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  leadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  leadAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F5278',
  },
  leadName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  leadCustBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leadCustBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },
  leadPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  leadPhoneText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  visitScheduledBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  visitScheduledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  leadDetailsGrid: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginBottom: 12,
  },
  leadDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadDetailLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  leadDetailValue: {
    fontSize: 11,
    color: '#1F2937',
    fontWeight: '700',
  },
  leadActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mapLeadBtn: {
    flex: 1,
    backgroundColor: '#EEF0F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    height: 38,
  },
  mapLeadBtnActive: {
    backgroundColor: '#4F5278',
  },
  mapLeadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F5278',
  },
  mapLeadBtnTextActive: {
    color: '#FFFFFF',
  },
  extraResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  extraResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  extraResultSub: {
    fontSize: 11,
    color: '#6B7280',
  },
  extraResultBadge: {
    backgroundColor: '#EEF0F8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  extraResultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F5278',
  },
  commercialFallbackBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fallbackIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  fallbackDesc: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
    maxWidth: 280,
  },
  resetFilterBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F5278',
  },
});
