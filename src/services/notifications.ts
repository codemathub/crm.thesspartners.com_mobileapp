import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { mobileApi } from './api';
import { parseUtcDate } from '../utils/dateUtils';

export type NotificationResponsePayload = {
  entity_type?: string;
  entity_id?: string;
  notification_type?: string;
  type?: string;
  id?: string;
  phone?: string;
  location?: string;
  title?: string;
  body?: string;
};

type NotificationResponseCallback = (payload: NotificationResponsePayload) => void;
let globalNotificationResponseHandler: NotificationResponseCallback | null = null;

export function setNotificationResponseHandler(handler: NotificationResponseCallback | null) {
  globalNotificationResponseHandler = handler;
}

// Configure notification presentation behavior when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure Android notification channels for Heads-Up (pop-up banner) & Status Bar.
 * Android 8.0+ requires importance: MAX for heads-up popup over screen.
 */
export async function ensureNotificationChannelAsync() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'G² Brothers CRM Operational Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F5278',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (err) {
      console.warn('Could not set notification channel:', err);
    }
  }
}

// Ensure channel is registered immediately on app boot
ensureNotificationChannelAsync().catch(() => {});

/**
 * Pop up an immediate heads-up banner and status bar notification directly on the device.
 * Used for real-time foreground & background alerts when directives, tasks, or leads arrive.
 */
export async function displayLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    await ensureNotificationChannelAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data: data || {},
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Could not display local notification:', err);
  }
}

/**
 * In-memory deduplication cache for scheduled reminders.
 * Prevents re-scheduling the same reminder multiple times during app lifecycle.
 */
const scheduledRemindersCache = new Set<string>();

/**
 * Clean up any legacy or stale scheduled reminders and dismiss existing tray alerts.
 */
export async function cleanUpLegacyRemindersAsync() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    scheduledRemindersCache.clear();
  } catch {
    // ignore
  }
}

// Immediately clean up legacy reminders on module load
cleanUpLegacyRemindersAsync().catch(() => {});

/**
 * Schedule local reminder notifications for an upcoming visit or callback:
 * 1) Reminder 1: 12 Hours Before appointment (fires ONLY if >= 2 mins in the future)
 * 2) Reminder 2: 30 Minutes Before appointment (fires ONLY if >= 60 secs in the future)
 * 
 * Strictly respects future date triggers: will NEVER fire immediately.
 */
export async function scheduleActivityReminder(
  type: 'visit' | 'followup',
  id: string,
  clientName: string,
  scheduledAt: string | Date,
  details?: string
) {
  try {
    if (!id || !scheduledAt) return;

    const schedDate = parseUtcDate(scheduledAt);
    const now = new Date();

    // Guard: Never schedule reminders for past appointments or appointments starting in < 60 seconds
    const secondsUntilEvent = Math.floor((schedDate.getTime() - now.getTime()) / 1000);
    if (secondsUntilEvent <= 60) {
      return;
    }

    const reminderKey = `${type}_${id}_${schedDate.getTime()}`;
    if (scheduledRemindersCache.has(reminderKey)) {
      return;
    }

    await ensureNotificationChannelAsync();

    // Cancel any previous reminder for this exact ID to guarantee clean state
    await cancelActivityReminder(type, id);

    // 1. REMINDER 1: 12 HOURS BEFORE (must be at least 2 minutes in the future)
    const seconds12h = secondsUntilEvent - 12 * 3600;
    if (seconds12h >= 120) {
      const date12h = new Date(schedDate.getTime() - 12 * 3600 * 1000);
      await Notifications.scheduleNotificationAsync({
        identifier: `${type}_12h_${id}`,
        content: {
          title: type === 'visit'
            ? `⏰ Upcoming Site Visit in 12h: ${clientName}`
            : `📞 Upcoming Client Callback in 12h: ${clientName}`,
          body: type === 'visit'
            ? `Site showing scheduled in 12 hours for ${clientName} at ${details || 'property'}. Tap to review.`
            : `Client callback due in 12 hours for ${clientName}. Tap to review details.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: {
            type,
            id,
            entity_type: type === 'visit' ? 'visit' : 'followup',
            entity_id: id,
            phone: details,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: date12h,
          channelId: 'default',
        },
      });
    }

    // 2. REMINDER 2: 30 MINUTES BEFORE (must be at least 60 seconds in the future)
    const seconds30m = secondsUntilEvent - 30 * 60;
    if (seconds30m >= 60) {
      const date30m = new Date(schedDate.getTime() - 30 * 60 * 1000);
      await Notifications.scheduleNotificationAsync({
        identifier: `${type}_30m_${id}`,
        content: {
          title: type === 'visit'
            ? `⏰ Upcoming Site Visit in 30 mins: ${clientName}`
            : `📞 Upcoming Callback in 30 mins: ${clientName}`,
          body: type === 'visit'
            ? `Site showing in 30 mins at ${details || 'property'}. Tap to review and navigate.`
            : `Client callback due in 30 mins for ${clientName}. Tap to prepare call.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: {
            type,
            id,
            entity_type: type === 'visit' ? 'visit' : 'followup',
            entity_id: id,
            phone: details,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: date30m,
          channelId: 'default',
        },
      });
    }

    scheduledRemindersCache.add(reminderKey);
  } catch (err) {
    console.warn(`Could not schedule ${type} reminder:`, err);
  }
}

/**
 * Cancel scheduled reminders when a visit or callback is completed, rescheduled, or cancelled.
 */
export async function cancelActivityReminder(type: 'visit' | 'followup', id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${type}_12h_${id}`);
    await Notifications.cancelScheduledNotificationAsync(`${type}_30m_${id}`);
    await Notifications.cancelScheduledNotificationAsync(`${type}_reminder_${id}`);
    await Notifications.cancelScheduledNotificationAsync(`${type}_exact_${id}`);
    // Clear any matching cached reminder keys
    for (const key of scheduledRemindersCache) {
      if (key.startsWith(`${type}_${id}_`)) {
        scheduledRemindersCache.delete(key);
      }
    }
  } catch (err) {
    // ignore
  }
}

/**
 * Configure interactive notification action buttons for Android Shade & iOS Lock screen.
 * Users can tap "Acknowledge", "Open Lead", "Call", "Navigate" directly from their notification tray.
 */
export async function setupNotificationCategoriesAsync() {
  try {
    await Notifications.setNotificationCategoryAsync('lead_assigned', [
      {
        identifier: 'acknowledge',
        buttonTitle: '✓ Acknowledge',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'open_lead',
        buttonTitle: '↗ Open Lead',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'snooze',
        buttonTitle: '🕒 Snooze 5m',
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('visit_upcoming', [
      {
        identifier: 'call',
        buttonTitle: '📞 Call Client',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'navigate',
        buttonTitle: '🚗 Navigate',
        options: { opensAppToForeground: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('announcement', [
      {
        identifier: 'mark_read',
        buttonTitle: '✓ Mark Read',
        options: { opensAppToForeground: false },
      },
    ]);

    // Handle background / interactive notification responses
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data as any;

      if (actionId === 'acknowledge' && data?.task_id) {
        try {
          await mobileApi.acknowledgeTask(data.task_id);
          console.log(`Silent ACK completed for Task #${data.task_id}`);
        } catch (err) {
          console.warn('Silent ACK failed:', err);
        }
      } else if (actionId === 'call' && data?.phone) {
        Linking.openURL(`tel:${data.phone}`).catch(() => {});
      } else if (actionId === 'navigate' && data?.location) {
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(data.location)}`).catch(() => {});
      } else if (actionId === 'mark_read' && data?.notification_id) {
        mobileApi.markNotificationRead(data.notification_id).catch(() => {});
      }

      // If user tapped the notification itself or an action that opens the app:
      if (
        actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
        !actionId ||
        actionId === 'navigate' ||
        actionId === 'acknowledge'
      ) {
        if (globalNotificationResponseHandler) {
          globalNotificationResponseHandler({
            ...data,
            title: response.notification.request.content.title || undefined,
            body: response.notification.request.content.body || undefined,
          });
        }
      }
    });
  } catch (err) {
    console.warn('Could not register notification categories:', err);
  }
}

// Pre-register categories
setupNotificationCategoriesAsync().catch(() => {});

/**
 * Registers device for remote push notifications.
 * Works even when the app is completely closed or killed by OS.
 * The token is sent to the backend and stored in MongoDB Atlas.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  await ensureNotificationChannelAsync();
  await setupNotificationCategoriesAsync();

  // Request runtime permissions (especially crucial on Android 13+)
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission denied by user.');
      return null;
    }
  } catch (permErr) {
    console.warn('Permission request error:', permErr);
  }

  if (Device.isDevice) {
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        '981d82a0-0a25-4082-bf5f-a1c77d0bb5fe';

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      ).catch(async () => {
        return await Notifications.getExpoPushTokenAsync();
      });

      token = tokenData?.data || null;

      // Register with G² Brothers CRM backend
      if (token) {
        await mobileApi.registerPushToken(token);
        console.log('Push token successfully registered with G² Brothers CRM backend:', token);
      }
    } catch (error) {
      console.warn('Failed to obtain Expo push token (remote push might be limited in simulator):', error);
    }
  } else {
    console.log('Notice: Physical device required for native remote push notifications.');
  }

  return token;
}
