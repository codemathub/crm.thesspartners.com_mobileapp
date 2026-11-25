import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, MobileCustomer } from '../services/api';

interface DuplicateCheckModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenCustomer: (customerId: string) => void;
  onAddEnquiryToExisting: (customer: any) => void;
}

export const DuplicateCheckModal: React.FC<DuplicateCheckModalProps> = ({
  visible,
  onClose,
  onOpenCustomer,
  onAddEnquiryToExisting,
}) => {
  const [phoneQuery, setPhoneQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<{
    has_duplicate: boolean;
    matches: any[];
  } | null>(null);

  const handleSearch = async () => {
    const clean = phoneQuery.trim();
    if (!clean || clean.length < 4) return;
    setChecking(true);
    setHasSearched(true);
    try {
      const res = await mobileApi.checkDuplicatePhone(clean);
      setDuplicateResult(res);
    } catch {
      setDuplicateResult({ has_duplicate: false, matches: [] });
    } finally {
      setChecking(false);
    }
  };

  const handleReset = () => {
    setPhoneQuery('');
    setHasSearched(false);
    setDuplicateResult(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={themeTokens.colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.headerTitle}>Duplicate Lead & Phone Checker</Text>
            <Text style={styles.headerSubtitle}>
              Check phone numbers against the master customer directory
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Search Box */}
          <View style={styles.searchCard}>
            <Text style={styles.inputLabel}>Enter Phone Number to Verify</Text>
            <View style={styles.searchRow}>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={18} color={themeTokens.colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 9811223344 or +91..."
                  placeholderTextColor={themeTokens.colors.textSecondary}
                  keyboardType="phone-pad"
                  value={phoneQuery}
                  onChangeText={(text) => {
                    setPhoneQuery(text);
                    if (hasSearched) setHasSearched(false);
                  }}
                  onSubmitEditing={handleSearch}
                />
                {phoneQuery.length > 0 && (
                  <TouchableOpacity onPress={handleReset}>
                    <Ionicons name="close-circle" size={18} color={themeTokens.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.checkBtn, checking && { opacity: 0.7 }]}
                onPress={handleSearch}
                disabled={checking || phoneQuery.trim().length < 4}
              >
                {checking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.checkBtnText}>Check</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.hintText}>
              System checks primary, alternate, and WhatsApp numbers in normalized E.164 formats.
            </Text>
          </View>

          {/* Results Area */}
          {hasSearched && duplicateResult && (
            <View style={{ marginTop: 16 }}>
              {duplicateResult.has_duplicate ? (
                <View>
                  <View style={styles.duplicateAlertBanner}>
                    <Ionicons name="alert-circle" size={22} color="#DC2626" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.duplicateAlertTitle}>DUPLICATE PROFILES DETECTED</Text>
                      <Text style={styles.duplicateAlertDesc}>
                        Found {duplicateResult.matches.length} existing profile(s) linked to this phone.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.matchesHeading}>Matching Profiles in Directory</Text>

                  {duplicateResult.matches.map((cust: any, index: number) => (
                    <View key={cust.customer_id || index} style={styles.matchCard}>
                      <View style={styles.matchCardHeader}>
                        <View style={styles.avatarPill}>
                          <Text style={styles.avatarText}>
                            {(cust.name || 'C').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.matchCustName}>{cust.name}</Text>
                          <Text style={styles.matchCustId}>ID: #{cust.customer_id}</Text>
                        </View>
                        <View style={[styles.priorityPill, cust.priority === 'hot' ? styles.hotPill : styles.warmPill]}>
                          <Text style={styles.priorityText}>{(cust.priority || 'NORMAL').toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={styles.matchDetailsRow}>
                        <View style={styles.detailCol}>
                          <Text style={styles.detailLabel}>Primary Phone:</Text>
                          <Text style={styles.detailVal}>{cust.primary_phone}</Text>
                        </View>
                        {cust.alternate_phone && (
                          <View style={styles.detailCol}>
                            <Text style={styles.detailLabel}>Alternate:</Text>
                            <Text style={styles.detailVal}>{cust.alternate_phone}</Text>
                          </View>
                        )}
                        <View style={styles.detailCol}>
                          <Text style={styles.detailLabel}>Customer Type:</Text>
                          <Text style={styles.detailVal}>{(cust.customer_type || 'Tenant').toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.open360Btn}
                          onPress={() => {
                            onClose();
                            onOpenCustomer(cust.customer_id);
                          }}
                        >
                          <Ionicons name="person-circle-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.open360BtnText} numberOfLines={1}>View Details</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.addEnqBtn}
                          onPress={() => {
                            onClose();
                            onAddEnquiryToExisting(cust);
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={16} color={themeTokens.colors.primaryDark} />
                          <Text style={styles.addEnqBtnText}>Add Enquiry</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.cleanBanner}>
                  <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
                  <Text style={styles.cleanTitle}>✓ Clean Number - No Duplicates</Text>
                  <Text style={styles.cleanDesc}>
                    Phone number &quot;{phoneQuery}&quot; is unique and not registered to any profile. You can safely create a brand new client.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Policy Information Box */}
          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>G² Brothers CRM Anti-Duplicate Policy (PRD 5.8)</Text>
            <Text style={styles.policyText}>
              • Client Profile: Each client maintains one single contact profile with all their property searches linked together.
            </Text>
            <Text style={styles.policyText}>
              • Shared Phones: If family members or brokers share a phone number, select &apos;Create Separate Profile&apos; and record the explicit shared phone reason.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: themeTokens.colors.border,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: themeTokens.colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeTokens.colors.softSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: themeTokens.colors.textPrimary,
  },
  checkBtn: {
    backgroundColor: themeTokens.colors.primaryDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  hintText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 8,
  },
  duplicateAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  duplicateAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  duplicateAlertDesc: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  matchesHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: themeTokens.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  matchCustName: {
    fontSize: 14,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  matchCustId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: themeTokens.colors.textSecondary,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  hotPill: {
    backgroundColor: '#FEE2E2',
  },
  warmPill: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  matchDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: themeTokens.colors.softSurface,
  },
  detailCol: {
    minWidth: '40%',
  },
  detailLabel: {
    fontSize: 10,
    color: themeTokens.colors.textSecondary,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: themeTokens.colors.textPrimary,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  open360Btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.primaryDark,
    paddingVertical: 8,
    borderRadius: 6,
  },
  open360BtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  addEnqBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: themeTokens.colors.softSurface,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addEnqBtnText: {
    color: themeTokens.colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  cleanBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  cleanTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
    marginTop: 8,
  },
  cleanDesc: {
    fontSize: 12,
    color: '#15803D',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    padding: 14,
    marginTop: 20,
    marginBottom: 40,
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
    marginBottom: 6,
  },
  policyText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
});
