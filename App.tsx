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
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const ANDROID_STATUSBAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(RNStatusBar.currentHeight || 0, (Constants as any)?.statusBarHeight || 0, 38)
  : 0;
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
  setNotificationResponseHandler,
} from './src/services/notifications';
import { mobileApi } from './src/services/api';

export type TabType = 'Home' | 'Inventory' | 'Enquiries' | 'Schedule' | 'Visits' | 'More';

// Global notification deduplication cache across screen transitions
const globalSeenNotifIds = new Set<string>();
let globalInitialSyncDone = false;

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
  const [inAppToast, setInAppToast] = useState<{
    id: string;
    title: string;
    body: string;
    entity_type?: string;
    entity_id?: string;
    notification_type?: string;
  } | null>(null);

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

  /**
   * Unified notification click navigator:
   * Directs user to the exact target screen, visit, client, property, or task
   */
  const navigateToNotificationTarget = React.useCallback(
    (payload: {
      entity_type?: string;
      entity_id?: string;
      notification_type?: string;
      type?: string;
      id?: string;
      phone?: string;
      location?: string;
      title?: string;
      body?: string;
    }) => {
      // Dismiss any open popups or toasts
      setNotifModalVisible(false);
      setSearchModalVisible(false);
      setInAppToast(null);

      const rawEntity = String(payload.entity_type || payload.type || '').toLowerCase().trim();
      const rawNotifType = String(payload.notification_type || '').toLowerCase().trim();
      const cleanId = String(payload.entity_id || payload.id || '').trim();
      const textHint = `${payload.title || ''} ${payload.body || ''}`.toLowerCase();

      // 1. Visits / Showings / Follow-ups / Callbacks
      if (
        rawEntity === 'visit' ||
        rawEntity === 'followup' ||
        rawEntity === 'showing' ||
        rawEntity === 'touchpoint' ||
        rawNotifType.includes('visit') ||
        rawNotifType.includes('followup') ||
        textHint.includes('visit') ||
        textHint.includes('showing') ||
        textHint.includes('callback')
      ) {
        if (rawEntity === 'followup' || rawNotifType.includes('followup') || textHint.includes('callback')) {
          handleNavigateTab('Schedule', 'followups');
        } else if (rawNotifType.includes('claim')) {
          handleNavigateTab('Schedule', 'claim');
        } else {
          handleNavigateTab('Schedule', 'today');
        }
        return;
      }

      // 2. Property / Inventory Unit
      if (
        rawEntity === 'property' ||
        rawEntity === 'inventory' ||
        rawEntity === 'unit' ||
        rawNotifType.includes('property') ||
        textHint.includes('property') ||
        textHint.includes('inventory') ||
        textHint.includes('unit')
      ) {
        if (cleanId) {
          setTargetPropertyId(cleanId);
        }
        setActiveTab('Inventory');
        return;
      }

      // 3. Customer / Client Profile
      if (
        rawEntity === 'customer' ||
        rawEntity === 'client' ||
        rawEntity === 'profile' ||
        rawNotifType.includes('customer') ||
        rawNotifType.includes('client') ||
        textHint.includes('customer') ||
        textHint.includes('client')
      ) {
        if (cleanId) {
          setTargetCustomerId(cleanId);
        }
        setActiveTab('Enquiries');
        return;
      }

      // 4. Enquiry / Lead / Deal
      if (
        rawEntity === 'enquiry' ||
        rawEntity === 'lead' ||
        rawEntity === 'deal' ||
        rawNotifType.includes('lead') ||
        rawNotifType.includes('enquiry') ||
        rawNotifType.includes('deal') ||
        textHint.includes('enquiry') ||
        textHint.includes('lead') ||
        textHint.includes('deal')
      ) {
        if (cleanId) {
          setTargetEnquiryId(cleanId);
        }
        setActiveTab('Enquiries');
        return;
      }

      // 5. Tasks / Operational Directives / Announcements
      if (
        rawEntity === 'task' ||
        rawEntity === 'directive' ||
        rawEntity === 'announcement' ||
        rawNotifType.includes('task') ||
        rawNotifType.includes('announcement') ||
        textHint.includes('task') ||
        textHint.includes('directive') ||
        textHint.includes('announcement')
      ) {
        setTasksModalVisible(true);
        return;
      }

      // Fallback: Open home screen
      setActiveTab('Home');
    },
    []
  );

  // Native notification response listener (when tapping OS status bar / lockscreen banners)
  React.useEffect(() => {
    setNotificationResponseHandler((payload) => {
      navigateToNotificationTarget(payload);
    });

    // Check cold-start notification click
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          const data = (response.notification.request.content.data || {}) as any;
          navigateToNotificationTarget({
            ...data,
            title: response.notification.request.content.title || undefined,
            body: response.notification.request.content.body || undefined,
          });
        }
      })
      .catch(() => {});

    return () => {
      setNotificationResponseHandler(null);
    };
  }, [navigateToNotificationTarget]);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    ensureNotificationChannelAsync().catch(() => {});
    registerForPushNotificationsAsync().catch(() => {});

    const syncNotifications = async () => {
      try {
        const res = await mobileApi.getNotifications(true);
        const unreadItems = res.items || [];
        setUnreadNotifCount(unreadItems.length);

        if (!globalInitialSyncDone) {
          unreadItems.forEach((n) => {
            const notifId = String(n.id || (n as any)._id || '');
            if (notifId) globalSeenNotifIds.add(notifId);
          });
          globalInitialSyncDone = true;
          return;
        }

        const newItems = unreadItems.filter((n) => {
          const notifId = String(n.id || (n as any)._id || '');
          return notifId && !globalSeenNotifIds.has(notifId);
        });

        if (newItems.length > 0) {
          newItems.forEach((n) => {
            const notifId = String(n.id || (n as any)._id || '');
            if (notifId) globalSeenNotifIds.add(notifId);
          });

          // Pop up native phone notification bar alert & vibration
          const latest = newItems[0];
          await displayLocalNotification(latest.title, latest.body, {
            id: latest.id,
            entity_type: latest.entity_type,
            entity_id: latest.entity_id,
            notification_type: latest.notification_type,
            title: latest.title,
            body: latest.body,
          });

          // In-app floating popup banner
          setInAppToast({
            id: latest.id,
            title: latest.title,
            body: latest.body,
            entity_type: latest.entity_type,
            entity_id: latest.entity_id,
            notification_type: latest.notification_type,
          });
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
          activeOpacity={0.92}
          onPress={() => {
            const toast = inAppToast;
            setInAppToast(null);
            navigateToNotificationTarget(toast);
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

      {/* Top Header matching G² Brothers Reference */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/g2-tile.png')}
            style={styles.brandTileImg}
            resizeMode="contain"
          />
          <View style={styles.brandDivider} />
          <View style={styles.brandTextColumn}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleText}>G</Text>
              <Text style={styles.brandSuperscriptText}>2</Text>
              <Text style={styles.brandTitleText}> BROTHERS</Text>
            </View>
            <Text style={styles.brandTaglineText}>BUILDING VALUE | CREATING LEGACY</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setSearchModalVisible(true)}
            activeOpacity={0.88}
            accessibilityLabel="Search properties and customers"
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={17} color={themeTokens.colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.88}
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
            activeOpacity={0.88}
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
          activeOpacity={0.88}
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
          activeOpacity={0.88}
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
          activeOpacity={0.88}
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
          activeOpacity={0.88}
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
          activeOpacity={0.88}
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
        onUpdateUnreadCount={(count) => setUnreadNotifCount(count)}
        onOpenTasksScreen={() => {
          setNotifModalVisible(false);
          setTasksModalVisible(true);
        }}
        onOpenEnquiries={(enqId) => {
          setNotifModalVisible(false);
          if (enqId) setTargetEnquiryId(enqId);
          setActiveTab('Enquiries');
        }}
        onOpenCustomer={(custId) => {
          setNotifModalVisible(false);
          if (custId) setTargetCustomerId(custId);
          setActiveTab('Enquiries');
        }}
        onOpenProperty={(propId) => {
          setNotifModalVisible(false);
          if (propId) setTargetPropertyId(propId);
          setActiveTab('Inventory');
        }}
        onOpenSchedule={(subTab) => {
          setNotifModalVisible(false);
          handleNavigateTab('Schedule', subTab);
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
    paddingTop: ANDROID_STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTileImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  brandDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  brandTextColumn: {
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  brandTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A192F',
    letterSpacing: 0.8,
    lineHeight: 19,
  },
  brandSuperscriptText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A192F',
    lineHeight: 14,
    marginTop: -1,
  },
  brandTaglineText: {
    fontSize: 7.8,
    fontWeight: '800',
    color: '#D49B28',
    letterSpacing: 0.8,
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
    top: ANDROID_STATUSBAR_HEIGHT + 55,
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
