import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  Platform,
  Image,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from './src/theme/tokens';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { EnquiriesScreen } from './src/screens/EnquiriesScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { SearchModal } from './src/components/SearchModal';
import { NotificationModal } from './src/components/NotificationModal';
import {
  registerForPushNotificationsAsync,
  ensureNotificationChannelAsync,
  displayLocalNotification,
} from './src/services/notifications';
import { mobileApi } from './src/services/api';

export type TabType = 'Home' | 'Inventory' | 'Enquiries' | 'Schedule' | 'Visits' | 'More';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Home');
  const [visitsInitialTab, setVisitsInitialTab] = useState<'today' | 'followups' | 'claim' | 'all'>('today');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [tasksModalVisible, setTasksModalVisible] = useState(false);
  const [inventoryAction, setInventoryAction] = useState<string | null>(null);
  const [enquiryAction, setEnquiryAction] = useState<string | null>(null);
  const [visitAction, setVisitAction] = useState<string | null>(null);
  const [targetPropertyId, setTargetPropertyId] = useState<string | null>(null);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetEnquiryId, setTargetEnquiryId] = useState<string | null>(null);
  const [targetVisitEnquiryId, setTargetVisitEnquiryId] = useState<string | null>(null);
  const [targetVisitPropertyId, setTargetVisitPropertyId] = useState<string | null>(null);

  // Live Notification Synchronization & Heads-up Pop-up
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [inAppToast, setInAppToast] = useState<{ id: string; title: string; body: string } | null>(null);
  const seenNotifIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialSyncRef = React.useRef(true);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    ensureNotificationChannelAsync().catch(() => {});
    registerForPushNotificationsAsync().catch(() => {});

    const syncNotifications = async () => {
      try {
        const res = await mobileApi.getNotifications(true);
        const unreadItems = res.items || [];
        setUnreadNotifCount(unreadItems.length);

        if (isInitialSyncRef.current) {
          unreadItems.forEach((n) => seenNotifIdsRef.current.add(n.id));
          isInitialSyncRef.current = false;
          return;
        }

        const newItems = unreadItems.filter((n) => !seenNotifIdsRef.current.has(n.id));
        if (newItems.length > 0) {
          newItems.forEach((n) => seenNotifIdsRef.current.add(n.id));

          // Pop up native phone notification bar alert & vibration
          const latest = newItems[0];
          await displayLocalNotification(latest.title, latest.body, {
            id: latest.id,
            entity_type: latest.entity_type,
            entity_id: latest.entity_id,
          });

          // In-app floating popup banner
          setInAppToast({ id: latest.id, title: latest.title, body: latest.body });
        }
      } catch {
        // silent on network error
      }
    };

    syncNotifications();
    const interval = setInterval(syncNotifications, 10000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  React.useEffect(() => {
    if (inAppToast) {
      const timer = setTimeout(() => {
        setInAppToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [inAppToast]);

  const handleNavigateTab = (tab: TabType, subTab?: string) => {
    const target = (tab === 'Visits' || tab === 'Schedule') ? 'Schedule' : tab;
    if (tab === 'Visits' || tab === 'Schedule') {
      if (subTab === 'followups' || subTab === 'callbacks') {
        setVisitsInitialTab('followups');
      } else if (subTab === 'claim') {
        setVisitsInitialTab('claim');
      } else if (subTab === 'all') {
        setVisitsInitialTab('all');
      } else {
        setVisitsInitialTab('today');
      }
    }
    setActiveTab(target);
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setActiveTab('Home');
    registerForPushNotificationsAsync().catch((err) =>
      console.log('Push registration caught:', err)
    );
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'ADD_PROPERTY':
        setInventoryAction('ADD_PROPERTY');
        setActiveTab('Inventory');
        break;
      case 'ADD_ENQUIRY':
        setEnquiryAction('ADD_ENQUIRY');
        setActiveTab('Enquiries');
        break;
      case 'SCHEDULE_VISIT':
        setVisitAction('SCHEDULE_VISIT');
        setVisitsInitialTab('today');
        setActiveTab('Visits');
        break;
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'Home':
        return (
          <HomeScreen
            currentUser={currentUser}
            onNavigateTab={handleNavigateTab}
            onOpenQuickAction={handleQuickAction}
          />
        );
      case 'Inventory':
        return (
          <InventoryScreen
            initialAction={inventoryAction || undefined}
            onActionHandled={() => setInventoryAction(null)}
            targetPropertyId={targetPropertyId || undefined}
            onClearTargetPropertyId={() => setTargetPropertyId(null)}
            onScheduleVisitForProperty={(propId) => {
              setTargetVisitPropertyId(propId);
              setVisitsInitialTab('today');
              setVisitAction('SCHEDULE_VISIT');
              setActiveTab('Visits');
            }}
          />
        );
      case 'Enquiries':
        return (
          <EnquiriesScreen
            initialAction={enquiryAction || undefined}
            onActionHandled={() => setEnquiryAction(null)}
            targetCustomerId={targetCustomerId || undefined}
            onClearTargetCustomerId={() => setTargetCustomerId(null)}
            targetEnquiryId={targetEnquiryId || undefined}
            onClearTargetEnquiryId={() => setTargetEnquiryId(null)}
            onSelectEnquiry={(enqId, propId) => {
              setTargetVisitEnquiryId(enqId);
              if (propId) setTargetVisitPropertyId(propId);
              setVisitsInitialTab('today');
              setVisitAction('SCHEDULE_VISIT');
              setActiveTab('Visits');
            }}
          />
        );
      case 'Schedule':
      case 'Visits':
        return (
          <VisitsScreen
            initialTab={visitsInitialTab}
            initialAction={visitAction || undefined}
            onActionHandled={() => {
              setVisitAction(null);
              setTargetVisitEnquiryId(null);
              setTargetVisitPropertyId(null);
            }}
            initialEnquiryId={targetVisitEnquiryId || undefined}
            initialPropertyId={targetVisitPropertyId || undefined}
          />
        );
      case 'More':
        return (
          <MoreScreen
            currentUser={currentUser}
            onNavigateTab={handleNavigateTab}
            onLogout={handleLogout}
            onOpenTasks={() => setTasksModalVisible(true)}
            onOpenNotifications={() => setNotifModalVisible(true)}
            onOpenQuickAction={handleQuickAction}
          />
        );
    }
  };

  const initials = (currentUser?.full_name || 'Admin')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Floating In-App Heads-Up Notification Banner */}
      {inAppToast && (
        <TouchableOpacity
          style={styles.toastBanner}
          activeOpacity={0.9}
          onPress={() => {
            setInAppToast(null);
            setNotifModalVisible(true);
          }}
        >
          <View style={styles.toastIconBox}>
            <Ionicons name="notifications" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.toastContent}>
            <Text style={styles.toastTitle} numberOfLines={1}>{inAppToast.title}</Text>
            <Text style={styles.toastBody} numberOfLines={2}>{inAppToast.body}</Text>
          </View>
          <TouchableOpacity
            style={styles.toastCloseBtn}
            onPress={() => setInAppToast(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Top Header matching G² Brothers Luxury Reference */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/g2-tile.png')}
            style={styles.brandTileImg}
            resizeMode="cover"
          />
          <View style={styles.brandDivider} />
          <View style={styles.brandTextColumn}>
            <Text style={styles.brandTitleText}>G² BROTHERS</Text>
            <Text style={styles.brandTaglineText}>BUILDING VALUE | CREATING LEGACY</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setSearchModalVisible(true)}
            accessibilityLabel="Search properties and customers"
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={17} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setNotifModalVisible(true)}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            {unreadNotifCount > 0 && <View style={styles.badgeDot} />}
            <Ionicons name="notifications-outline" size={17} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>

          {/* Profile Circle triggering More tab */}
          <TouchableOpacity
            style={styles.profileCircleBtn}
            onPress={() => setActiveTab('More')}
            accessibilityLabel="User profile"
            accessibilityRole="button"
          >
            <Ionicons name="person" size={15} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={styles.body}>{renderActiveScreen()}</View>

      {/* Bottom Tab Bar matching Stitch Visual Theme */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('Home')}
          accessibilityRole="tab"
        >
          <View style={[styles.navIconPill, activeTab === 'Home' && styles.navIconPillActive]}>
            <Ionicons
              name={activeTab === 'Home' ? 'home' : 'home-outline'}
              size={19}
              color={activeTab === 'Home' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'Home' && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('Inventory')}
          accessibilityRole="tab"
        >
          <View style={[styles.navIconPill, activeTab === 'Inventory' && styles.navIconPillActive]}>
            <Ionicons
              name={activeTab === 'Inventory' ? 'business' : 'business-outline'}
              size={19}
              color={activeTab === 'Inventory' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'Inventory' && styles.navLabelActive]}>Inventory</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('Enquiries')}
          accessibilityRole="tab"
        >
          <View style={[styles.navIconPill, activeTab === 'Enquiries' && styles.navIconPillActive]}>
            <Ionicons
              name={activeTab === 'Enquiries' ? 'people' : 'people-outline'}
              size={19}
              color={activeTab === 'Enquiries' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'Enquiries' && styles.navLabelActive]}>Enquiries</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('Schedule')}
          accessibilityRole="tab"
        >
          <View style={[styles.navIconPill, (activeTab === 'Schedule' || activeTab === 'Visits') && styles.navIconPillActive]}>
            <Ionicons
              name={(activeTab === 'Schedule' || activeTab === 'Visits') ? 'calendar' : 'calendar-outline'}
              size={19}
              color={(activeTab === 'Schedule' || activeTab === 'Visits') ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
          </View>
          <Text style={[styles.navLabel, (activeTab === 'Schedule' || activeTab === 'Visits') && styles.navLabelActive]}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('More')}
          accessibilityRole="tab"
        >
          <View style={[styles.navIconPill, activeTab === 'More' && styles.navIconPillActive]}>
            <Ionicons
              name="menu-outline"
              size={19}
              color={activeTab === 'More' ? themeTokens.colors.primaryDark : themeTokens.colors.textSecondary}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'More' && styles.navLabelActive]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Global Search and Notification Modals */}
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelectResult={(type, id) => {
          setSearchModalVisible(false);
          const normType = String(type || '').toLowerCase();
          const cleanId = String(id || '').trim();
          if (!cleanId) return;
          if (normType === 'property') {
            setTargetPropertyId(cleanId);
            setActiveTab('Inventory');
          } else if (normType === 'customer') {
            setTargetCustomerId(cleanId);
            setActiveTab('Enquiries');
          } else if (normType === 'enquiry') {
            setTargetEnquiryId(cleanId);
            setActiveTab('Enquiries');
          }
        }}
      />

      <NotificationModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onOpenTasksScreen={() => {
          setNotifModalVisible(false);
          setTasksModalVisible(true);
        }}
        onOpenEnquiries={() => {
          setNotifModalVisible(false);
          setActiveTab('Enquiries');
        }}
      />

      {/* Operational Directives & Assigned Tasks Screen matching Stitch Image 8 */}
      <Modal visible={tasksModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <TasksScreen
            onClose={() => setTasksModalVisible(false)}
            onNavigateTab={(tab) => {
              setTasksModalVisible(false);
              setActiveTab(tab as TabType);
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTileImg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#020912',
  },
  brandDivider: {
    width: 1.5,
    height: 26,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 9,
  },
  brandTextColumn: {
    justifyContent: 'center',
  },
  brandTitleText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
    lineHeight: 18,
  },
  brandTaglineText: {
    fontSize: 7.2,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.7,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF', // Sapphire soft tint
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
  profileCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    paddingBottom: 8,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 2,
  },
  navIconPillActive: {
    backgroundColor: '#EFF6FF', // Sapphire soft tint indicator
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: themeTokens.colors.textSecondary,
  },
  navLabelActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  toastBanner: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 55,
    left: 12,
    right: 12,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 9999,
    elevation: 0,
    shadowOpacity: 0,
  },
  toastIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toastBody: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  toastCloseBtn: {
    padding: 4,
  },
});
