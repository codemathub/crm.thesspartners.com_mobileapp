import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import {
  mobileApi,
  MobileUser,
} from '../services/api';
import {
  getBiometricCapabilities,
  isBiometricsEnabled,
  setBiometricsEnabled,
  clearBiometricSession,
  authenticateWithBiometrics,
  BiometricCapabilities,
} from '../services/biometrics';
import { QuickActionFAB } from '../components/QuickActionFAB';

interface MoreScreenProps {
  currentUser?: any;
  onNavigateTab: (tab: 'Inventory' | 'Enquiries' | 'Schedule' | 'Visits' | 'More', subTab?: string) => void;
  onLogout: () => void;
  onOpenTasks?: () => void;
  onOpenNotifications?: () => void;
  onOpenQuickAction?: (action: string) => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  currentUser,
  onNavigateTab,
  onLogout,
  onOpenTasks,
  onOpenNotifications,
  onOpenQuickAction,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const userName = currentUser?.full_name || 'Staff User';
  const userRole = (currentUser?.role || 'executive').toLowerCase();
  const userEmail = currentUser?.email || '';
  const isSuperOrAdmin = userRole === 'super_admin' || userRole === 'admin';

  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ---------------------------------------------------------------------------
  // User Management State
  // ---------------------------------------------------------------------------
  const [usersList, setUsersList] = useState<MobileUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'executive' | 'admin'>('executive');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Live Tasks & Notifications in fallback modal
  const [liveTasks, setLiveTasks] = useState<any[]>([]);
  const [liveNotices, setLiveNotices] = useState<any[]>([]);
  const [liveNotifs, setLiveNotifs] = useState<any[]>([]);
  const [loadingDirectives, setLoadingDirectives] = useState(false);

  // Biometrics State (Field Executive 7-day FaceID / Fingerprint)
  const [biometrics, setBiometrics] = useState<BiometricCapabilities>({
    isAvailable: false,
    isEnrolled: false,
    biometricType: 'None',
    biometricLabel: 'Biometric Unlock',
  });
  const [bioEnabled, setBioEnabled] = useState(true);

  useEffect(() => {
    loadBiometricSettings();
  }, []);

  const loadBiometricSettings = async () => {
    try {
      const caps = await getBiometricCapabilities();
      setBiometrics(caps);
      const enabled = await isBiometricsEnabled();
      setBioEnabled(enabled);
    } catch (err) {
      console.warn('Biometric settings load error:', err);
    }
  };

  const handleToggleBiometrics = async (val: boolean) => {
    setBioEnabled(val);
    await setBiometricsEnabled(val);
    if (!val) {
      Alert.alert('Biometrics Disabled', 'Face ID / Fingerprint fast unlock has been disabled.');
    } else {
      Alert.alert(
        'Biometrics Enabled',
        `${biometrics.biometricLabel} is now active for 7-day quick unlocks on site visits.`
      );
    }
  };

  const handleResetBiometrics = async () => {
    Alert.alert(
      'Reset Biometric Session',
      'This will clear stored biometric credentials from this device. You will need to log in with your password next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Credentials',
          style: 'destructive',
          onPress: async () => {
            await clearBiometricSession();
            setBioEnabled(false);
            Alert.alert('Session Cleared', 'Stored biometric credentials removed.');
          },
        },
      ]
    );
  };

  const handleTestBiometrics = async () => {
    try {
      const res = await authenticateWithBiometrics(
        `Testing ${biometrics.biometricLabel} hardware response`
      );
      if (res.success) {
        Alert.alert(
          'Verification Successful',
          `Your device ${biometrics.biometricLabel} is configured correctly and ready for 7-day instant field unlocks.`
        );
      } else if (res.error && res.error !== 'Authentication cancelled') {
        Alert.alert('Authentication Test Result', res.error);
      }
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Could not trigger biometric test.');
    }
  };

  const fetchLiveDirectives = async () => {
    setLoadingDirectives(true);
    try {
      const [tRes, aRes, nRes] = await Promise.all([
        mobileApi.getTasks().catch(() => ({ items: [] })),
        mobileApi.getAnnouncements().catch(() => []),
        mobileApi.getNotifications().catch(() => ({ items: [] })),
      ]);
      setLiveTasks(tRes.items || []);
      setLiveNotices(aRes || []);
      setLiveNotifs(nRes.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingDirectives(false);
    }
  };

  // Load appropriate data when a modal is opened
  useEffect(() => {
    if (activeModal === 'USER_MGMT') {
      fetchUsers();
    } else if (activeModal === 'TASKS' || activeModal === 'NOTIFICATIONS') {
      fetchLiveDirectives();
    }
  }, [activeModal]);

  // Refetch when filters change
  useEffect(() => {
    if (activeModal === 'USER_MGMT') {
      fetchUsers();
    }
  }, [userRoleFilter]);

  const fetchUsers = async () => {
    if (!isSuperOrAdmin) return;
    setLoadingUsers(true);
    setUserMsg(null);
    try {
      const data = await mobileApi.getUsers(userRoleFilter);
      setUsersList(data);
    } catch (err: any) {
      setUserMsg({ type: 'err', text: err.message || 'Failed to load staff list' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async () => {
    setUserMsg(null);
    if (!newFullName.trim() || !newEmail.trim() || !newMobile.trim() || !newPassword.trim()) {
      setUserMsg({ type: 'err', text: 'All fields including temporary password are required.' });
      return;
    }
    setCreatingUser(true);
    try {
      const assignedRole = userRole === 'super_admin' ? newRole : 'executive';
      await mobileApi.createUser({
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        mobile: newMobile.trim(),
        role: assignedRole,
        password: newPassword.trim(),
      });
      setUserMsg({
        type: 'ok',
        text: `${assignedRole === 'admin' ? 'Branch Admin' : 'Field Executive'} account for ${newFullName.trim()} successfully provisioned!`,
      });
      setNewFullName('');
      setNewEmail('');
      setNewMobile('');
      setNewPassword('');
      setNewRole('executive');
      setShowAddUserForm(false);
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'err', text: err.message || 'Failed to create user account' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeactivate = async (u: MobileUser) => {
    Alert.alert(
      'Deactivate Account',
      `Revoke workspace access for ${u.full_name} (${u.email})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.deactivateUser(u.id);
              fetchUsers();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to deactivate account');
            }
          },
        },
      ]
    );
  };

  const handleReactivate = async (u: MobileUser) => {
    try {
      await mobileApi.reactivateUser(u.id);
      fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reactivate account');
    }
  };

  const handleDeleteUser = async (u: MobileUser) => {
    Alert.alert(
      'Permanently Delete Account',
      `Are you sure you want to delete ${u.full_name} (${u.email})? All active sessions and credentials will be removed permanently. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.deleteUser(u.id);
              fetchUsers();
              Alert.alert('Deleted', `Account ${u.email} permanently removed.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
      {/* Identity Card */}
      <View style={styles.identityCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={24} color="#1D4ED8" />
          </View>
          <View style={styles.onlineBadge} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.profileName}>{userName}</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>{userRole.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.branchRow}>
            <Ionicons name="business-outline" size={12} color={themeTokens.colors.textSecondary} />
            <Text style={styles.branchText}>Authorized Operations Workspace</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.idBadgeBtn} onPress={() => setActiveModal('ID_CARD')}>
          <Ionicons name="id-card-outline" size={20} color={themeTokens.colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Session Status Banner */}
      <View style={styles.sessionStatusBanner}>
        <Ionicons name="shield-checkmark" size={15} color={themeTokens.colors.primaryDark} />
        <Text style={styles.sessionStatusText}>
          Session Status: <Text style={{ fontWeight: '800' }}>Active</Text>
        </Text>
        <Text style={styles.sessionExpiryText}>Authenticated</Text>
      </View>

      {/* FIELD BIOMETRICS & ACCESS Group */}
      <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.sectionTitle}>FIELD BIOMETRICS</Text>
          <View style={styles.bioPolicyBadge}>
            <Text style={styles.bioPolicyBadgeText}>7-Day Policy</Text>
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>Quick Site Access</Text>
      </View>

      <View style={styles.menuGroupCard}>
        {/* Biometrics Toggle Row */}
        <TouchableOpacity
          style={styles.menuItemRow}
          onPress={() => handleToggleBiometrics(!bioEnabled)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#DEF7EC' }]}>
            <Ionicons
              name={biometrics.biometricType === 'FaceID' ? 'scan-outline' : 'finger-print-outline'}
              size={18}
              color="#03543F"
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuTitle}>{biometrics.biometricLabel} Unlock</Text>
              <View style={[styles.activePill, !bioEnabled && { backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.activePillText, !bioEnabled && { color: '#6B7280' }]}>
                  {bioEnabled ? 'Active' : 'Disabled'}
                </Text>
              </View>
            </View>
            <Text style={styles.menuSubtitle}>
              {bioEnabled
                ? 'Active for instant Face/Fingerprint unlock on site visits'
                : 'Turn on to unlock G² Brothers CRM with Face ID without typing password'}
            </Text>
          </View>
          <Switch
            value={bioEnabled}
            onValueChange={handleToggleBiometrics}
            trackColor={{ false: '#D1D5DB', true: '#1D4ED8' }}
            thumbColor="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Test Biometrics Scanner Row */}
        <TouchableOpacity
          style={styles.menuItemRow}
          onPress={handleTestBiometrics}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="hardware-chip-outline" size={16} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Test {biometrics.biometricLabel} Scanner</Text>
            <Text style={styles.menuSubtitle}>Tap to prompt device Face ID / Fingerprint / Passcode now</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Clear / Reset Biometrics Row */}
        {bioEnabled && (
          <TouchableOpacity
            style={[styles.menuItemRow, { borderBottomWidth: 0 }]}
            onPress={handleResetBiometrics}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="refresh-outline" size={16} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: '#B91C1C' }]}>Reset Biometric Session</Text>
              <Text style={styles.menuSubtitle}>Clears device-stored keys and prompts fresh password sign-in</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* CORE OPERATIONS Group */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>CORE OPERATIONS</Text>
        <Text style={styles.sectionSubtitle}>Daily Cadence</Text>
      </View>

      <View style={styles.menuGroupCard}>
        {/* Item 1: Follow-ups */}
        <TouchableOpacity
          style={styles.menuItemRow}
          onPress={() => onNavigateTab('Schedule', 'followups')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="call" size={18} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuTitle}>Client Callbacks & Agenda</Text>
              <View style={styles.pendingPill}>
                <Text style={styles.pendingPillText}>Active Calls</Text>
              </View>
            </View>
            <Text style={styles.menuSubtitle}>Buyer touches, post-visit calls, scheduled agenda</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Item 2: Assigned Tasks & Directives */}
        <TouchableOpacity
          style={styles.menuItemRow}
          onPress={() => {
            if (onOpenTasks) onOpenTasks();
            else setActiveModal('TASKS');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="megaphone" size={18} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.menuTitle}>Assigned Tasks & Notices</Text>
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>Live Directives</Text>
              </View>
            </View>
            <Text style={styles.menuSubtitle}>Branch alerts, desk notes & custody rosters</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Item 3: Notification Center */}
        <TouchableOpacity
          style={[styles.menuItemRow, { borderBottomWidth: 0 }]}
          onPress={() => {
            if (onOpenNotifications) onOpenNotifications();
            else setActiveModal('NOTIFICATIONS');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="notifications" size={18} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Notification Center</Text>
            <Text style={styles.menuSubtitle}>Lead assignment pings, SLA breached alerts</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* ADMINISTRATION Group - Strictly for Admins */}
      {isSuperOrAdmin && (
        <>
          <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>ADMINISTRATION</Text>
              <View style={styles.adminOnlyBadge}>
                <Text style={styles.adminOnlyBadgeText}>Admin Only</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Control Center</Text>
          </View>

          <View style={styles.menuGroupCard}>
            {/* Item 1: User Management */}
            <TouchableOpacity
              style={[styles.menuItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setActiveModal('USER_MGMT')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people" size={18} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.menuTitle}>User Management</Text>
                  <View style={styles.managePill}>
                    <Text style={styles.managePillText}>Field Staff</Text>
                  </View>
                </View>
                <Text style={styles.menuSubtitle}>Provision field executives and manage access</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => {
          Alert.alert('Sign Out', 'Are you sure you want to log out of this workspace?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: () => {
                mobileApi.logout();
                onLogout();
              },
            },
          ]);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={18} color="#B91C1C" style={{ marginRight: 6 }} />
        <Text style={styles.signOutBtnText}>Sign Out of Workspace</Text>
      </TouchableOpacity>

      {/* =========================================================================
          OPERATIONAL SUBMODULE MODALS (REAL WORKING DATA & LIVE ACTIONS)
      ========================================================================= */}
      {activeModal && (
        <Modal visible={Boolean(activeModal)} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activeModal === 'TASKS'
                    ? 'Assigned Tasks & Directives'
                    : activeModal === 'NOTIFICATIONS'
                    ? 'Notification Center'
                    : activeModal === 'USER_MGMT'
                    ? 'User Management'
                    : 'Staff Profile'}
                </Text>
                <TouchableOpacity onPress={() => setActiveModal(null)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={themeTokens.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
                {/* -------------------------------------------------------------------
                    1. USER MANAGEMENT SUBMODULE
                ------------------------------------------------------------------- */}
                {activeModal === 'USER_MGMT' && (
                  <View style={{ gap: 12 }}>
                    {userMsg && (
                      <View
                        style={[
                          styles.feedbackBox,
                          userMsg.type === 'ok' ? styles.feedbackBoxOk : styles.feedbackBoxErr,
                        ]}
                      >
                        <Ionicons
                          name={userMsg.type === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                          size={16}
                          color={userMsg.type === 'ok' ? '#03543F' : '#9B1C1C'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.feedbackText,
                            userMsg.type === 'ok' ? styles.feedbackTextOk : styles.feedbackTextErr,
                          ]}
                        >
                          {userMsg.text}
                        </Text>
                      </View>
                    )}

                    {!isSuperOrAdmin ? (
                      <View style={styles.taskDirectiveCard}>
                        <Text style={styles.taskKicker}>FIELD EXECUTIVE ACCESS</Text>
                        <Text style={styles.taskHeadline}>{userName}</Text>
                        <Text style={styles.taskBody}>
                          Role: Executive{'\n'}
                          Email: {userEmail}{'\n'}
                          Staff administration and user provisioning requires Admin or Super Admin privileges.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {/* Top Action Bar */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {['All', 'Executive', 'Admin'].map((r) => (
                              <TouchableOpacity
                                key={r}
                                onPress={() => setUserRoleFilter(r)}
                                style={[
                                  styles.filterChip,
                                  userRoleFilter.toLowerCase() === r.toLowerCase() && styles.filterChipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.filterChipText,
                                    userRoleFilter.toLowerCase() === r.toLowerCase() && styles.filterChipTextActive,
                                  ]}
                                >
                                  {r}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <TouchableOpacity
                            style={styles.actionPillBtn}
                            onPress={() => setShowAddUserForm(!showAddUserForm)}
                          >
                            <Ionicons
                              name={showAddUserForm ? 'remove' : 'add'}
                              size={14}
                              color="#FFFFFF"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.actionPillBtnText}>
                              {showAddUserForm ? 'Close' : '+ Add Executive'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Inline Add User Form */}
                        {showAddUserForm && (
                          <View style={styles.formCard}>
                            <Text style={styles.formTitle}>
                              Provision Field Executive Account
                            </Text>

                            <TextInput
                              style={styles.modalInput}
                              placeholder="Full Name (e.g. Rahul Sharma)"
                              value={newFullName}
                              onChangeText={setNewFullName}
                              placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                              style={styles.modalInput}
                              placeholder="Corporate Email (e.g. rahul@g2brothers.com)"
                              value={newEmail}
                              onChangeText={setNewEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                              style={styles.modalInput}
                              placeholder="Mobile Contact Number"
                              value={newMobile}
                              onChangeText={setNewMobile}
                              keyboardType="phone-pad"
                              placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                              style={styles.modalInput}
                              placeholder="Initial Temporary Password"
                              value={newPassword}
                              onChangeText={setNewPassword}
                              secureTextEntry
                              placeholderTextColor="#9CA3AF"
                            />

                            {userRole === 'super_admin' ? (
                              <View style={{ marginVertical: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#4B5563', marginBottom: 4 }}>
                                  Select Role to Provision:
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity
                                    style={[
                                      styles.roleOption,
                                      newRole === 'executive' && styles.roleOptionActive,
                                      { flex: 1, paddingVertical: 8, alignItems: 'center' },
                                    ]}
                                    onPress={() => setNewRole('executive')}
                                  >
                                    <Text style={newRole === 'executive' ? styles.roleOptionTextActive : styles.roleOptionText}>
                                      Field Executive
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.roleOption,
                                      newRole === 'admin' && styles.roleOptionActive,
                                      { flex: 1, paddingVertical: 8, alignItems: 'center' },
                                    ]}
                                    onPress={() => setNewRole('admin')}
                                  >
                                    <Text style={newRole === 'admin' ? styles.roleOptionTextActive : styles.roleOptionText}>
                                      Branch Admin
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <View style={[styles.roleOption, styles.roleOptionActive, { marginVertical: 4, width: '100%' }]}>
                                <Text style={styles.roleOptionTextActive}>
                                  Role: Field Executive (Branch Admin can only create Executive accounts)
                                </Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={[styles.primaryActionBtn, creatingUser && { opacity: 0.7 }]}
                              onPress={handleCreateUser}
                              disabled={creatingUser}
                            >
                              {creatingUser ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.primaryActionBtnText}>
                                  {userRole === 'super_admin' && newRole === 'admin'
                                    ? 'Create Branch Admin'
                                    : 'Create Field Executive'}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* User List */}
                        {loadingUsers ? (
                          <ActivityIndicator size="small" color="#1D4ED8" style={{ marginVertical: 20 }} />
                        ) : usersList.length === 0 ? (
                          <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 20 }}>
                            No users found for this filter.
                          </Text>
                        ) : (
                          usersList.map((u) => {
                            const uInit = u.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2);
                            const roleColor =
                              u.role === 'super_admin'
                                ? '#1D4ED8'
                                : u.role === 'admin'
                                ? '#1C64F2'
                                : '#057A55';
                            const roleBg =
                              u.role === 'super_admin'
                                ? '#EFF6FF'
                                : u.role === 'admin'
                                ? '#E1EFFE'
                                : '#DEF7EC';

                            return (
                              <View key={u.id} style={styles.userItemCard}>
                                <View style={styles.userItemRow}>
                                  <View style={[styles.avatarCircle, { width: 36, height: 36, borderRadius: 18 }]}>
                                    <Text style={[styles.avatarText, { fontSize: 13 }]}>{uInit}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <Text style={styles.userItemName}>{u.full_name}</Text>
                                      <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                                        <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                                          {u.role.replace('_', ' ').toUpperCase()}
                                        </Text>
                                      </View>
                                    </View>
                                    <Text style={styles.userItemSub}>{u.email} • {u.mobile || 'No phone'}</Text>
                                  </View>

                                  <View
                                    style={[
                                      styles.statusPill,
                                      u.account_status === 'active' ? styles.statusPillActive : styles.statusPillInactive,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusPillText,
                                        u.account_status === 'active' ? styles.statusPillTextActive : styles.statusPillTextInactive,
                                      ]}
                                    >
                                      {u.account_status}
                                    </Text>
                                  </View>
                                </View>

                                {userRole === 'super_admin' && u.role !== 'super_admin' ? (
                                  <View style={[styles.userActionRow, { gap: 6 }]}>
                                    {u.account_status === 'active' ? (
                                      <TouchableOpacity
                                        onPress={() => handleDeactivate(u)}
                                        style={styles.userMiniBtn}
                                      >
                                        <Ionicons name="ban-outline" size={12} color="#DC2626" style={{ marginRight: 3 }} />
                                        <Text style={[styles.userMiniBtnText, { color: '#DC2626' }]}>Deactivate</Text>
                                      </TouchableOpacity>
                                    ) : (
                                      <TouchableOpacity
                                        onPress={() => handleReactivate(u)}
                                        style={[styles.userMiniBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                                      >
                                        <Ionicons name="checkmark-circle-outline" size={12} color="#059669" style={{ marginRight: 3 }} />
                                        <Text style={[styles.userMiniBtnText, { color: '#059669' }]}>Reactivate</Text>
                                      </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                      onPress={() => handleDeleteUser(u)}
                                      style={[styles.userMiniBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                                    >
                                      <Ionicons name="trash-outline" size={12} color="#DC2626" style={{ marginRight: 3 }} />
                                      <Text style={[styles.userMiniBtnText, { color: '#DC2626' }]}>Delete</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Tasks & Announcements */}
                {activeModal === 'TASKS' && (
                  <View style={{ gap: 10 }}>
                    {loadingDirectives ? (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#1D4ED8" />
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Fetching directives from MongoDB Atlas...</Text>
                      </View>
                    ) : liveTasks.length === 0 && liveNotices.length === 0 ? (
                      <View style={styles.taskDirectiveCard}>
                        <Text style={styles.taskKicker}>ALL CLEAR • Today</Text>
                        <Text style={styles.taskHeadline}>No Pending Tasks</Text>
                        <Text style={styles.taskBody}>All operational directives and lead assignment SLAs are up to date.</Text>
                      </View>
                    ) : (
                      <>
                        {liveNotices.map((n: any) => (
                          <View key={n.id || n._id} style={styles.taskDirectiveCard}>
                            <Text style={styles.taskKicker}>BRANCH NOTICE • {n.priority ? n.priority.toUpperCase() : 'NORMAL'}</Text>
                            <Text style={styles.taskHeadline}>{n.title}</Text>
                            <Text style={styles.taskBody}>{n.body}</Text>
                          </View>
                        ))}
                        {liveTasks.map((t: any) => (
                          <View key={t.task_id} style={styles.taskDirectiveCard}>
                            <Text style={styles.taskKicker}>TASK DIRECTIVE • {t.status ? t.status.toUpperCase() : 'PENDING'}</Text>
                            <Text style={styles.taskHeadline}>{t.title}</Text>
                            <Text style={styles.taskBody}>{t.instructions || 'Direct task instructions recorded in system.'}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}

                {/* Notifications */}
                {activeModal === 'NOTIFICATIONS' && (
                  <View style={{ gap: 8 }}>
                    {loadingDirectives ? (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#1D4ED8" />
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Loading notification center...</Text>
                      </View>
                    ) : liveNotifs.length === 0 ? (
                      <View style={styles.taskDirectiveCard}>
                        <Text style={styles.taskKicker}>NOTIFICATION CENTER • Live</Text>
                        <Text style={styles.taskHeadline}>No Unread Notifications</Text>
                        <Text style={styles.taskBody}>You are completely caught up with lead alerts and scheduling updates.</Text>
                      </View>
                    ) : (
                      liveNotifs.map((n: any) => (
                        <View key={n.id} style={styles.taskDirectiveCard}>
                          <Text style={styles.taskKicker}>{n.notification_type ? n.notification_type.toUpperCase() : 'SYSTEM ALERT'}</Text>
                          <Text style={styles.taskHeadline}>{n.title}</Text>
                          <Text style={styles.taskBody}>{n.body}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* ID Card */}
                {activeModal === 'ID_CARD' && (
                  <View style={{ gap: 10, alignItems: 'center', paddingVertical: 10 }}>
                    <View style={[styles.avatarCircle, { width: 60, height: 60, borderRadius: 30 }]}>
                      <Ionicons name="person" size={32} color="#1D4ED8" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: themeTokens.colors.textPrimary }}>
                      {userName}
                    </Text>
                    <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary }}>
                      {userEmail}
                    </Text>
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>{userRole.toUpperCase()}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => {
                  setActiveModal(null);
                  setShowAddUserForm(false);
                  setUserMsg(null);
                }}
              >
                <Text style={styles.closeModalBtnText}>Close Modal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      </ScrollView>

      {/* Floating Action Button (+ Property, + Enquiry, + Visit) */}
      <QuickActionFAB
        onOpenQuickAction={
          onOpenQuickAction ||
          ((act) => onNavigateTab(act === 'ADD_PROPERTY' ? 'Inventory' : act === 'ADD_ENQUIRY' ? 'Enquiries' : 'Schedule'))
        }
        bottomOffset={20}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  container: {
    padding: 16,
    paddingBottom: 80,
    backgroundColor: '#F7F8FC',
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
    marginBottom: 10,
    elevation: 0,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3F4462',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  adminBadge: {
    backgroundColor: '#EBEBF7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  branchText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  idBadgeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  sessionStatusBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  sessionStatusText: {
    fontSize: 11,
    color: themeTokens.colors.primaryDark,
  },
  sessionExpiryText: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginLeft: 'auto',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: themeTokens.colors.textSecondary,
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
  },
  adminOnlyBadge: {
    backgroundColor: '#EBEBF7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  bioPolicyBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  bioPolicyBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#03543F',
  },
  activePill: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#03543F',
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    elevation: 0,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    marginTop: 1,
  },
  pendingPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  newPill: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#03543F',
  },
  dealMtdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  managePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  managePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 20,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: themeTokens.colors.textPrimary,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  filterChipText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  formTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1F2937',
  },
  roleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  roleOptionActive: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  roleOptionText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  roleOptionTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  userItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  userItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  userItemSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: '#DEF7EC',
  },
  statusPillInactive: {
    backgroundColor: '#FDE8E8',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: '#03543F',
  },
  statusPillTextInactive: {
    color: '#9B1C1C',
  },
  userActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  userMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
  },
  userMiniBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabBtnActive: {
    borderBottomColor: '#1D4ED8',
  },
  subTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  subTabBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    paddingVertical: 0,
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  itemRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemRowSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  verifiedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DEF7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  taskDirectiveCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.6,
  },
  taskHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
    marginTop: 2,
  },
  taskBody: {
    fontSize: 11,
    color: themeTokens.colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackBoxOk: {
    backgroundColor: '#DEF7EC',
    borderColor: '#BCF0DA',
  },
  feedbackBoxErr: {
    backgroundColor: '#FDE8E8',
    borderColor: '#F8B4B4',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  feedbackTextOk: {
    color: '#03543F',
  },
  feedbackTextErr: {
    color: '#9B1C1C',
  },
  closeModalBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
});
