import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { mobileApi } from './api';
import { parseUtcDate } from '../utils/dateUtils';

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
      trigger: { channelId: 'default' },
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
 * Schedule local reminder notification for an upcoming visit or callback.
 * Fires 15 minutes before and at the exact showing/call time.
 * Fully deduplicated: will NEVER fire past visits or re-trigger on screen transitions.
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
    if (schedDate.getTime() <= now.getTime() + 60 * 1000) {
      return;
    }

    const reminderKey = `${type}_${id}_${schedDate.getTime()}`;
    if (scheduledRemindersCache.has(reminderKey)) {
      return;
    }

    await ensureNotificationChannelAsync();

    // Check existing scheduled notifications in OS to avoid duplicates
    let existingIds = new Set<string>();
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      existingIds = new Set(scheduled.map((n) => n.identifier));
    } catch {
      // fallback to in-memory check
    }

    // 15 minutes before the appointment
    const reminderTime = new Date(schedDate.getTime() - 15 * 60 * 1000);
    const reminderId = `${type}_reminder_${id}`;

    // Only schedule 15-min reminder if the reminder time is at least 2 minutes in the future
    if (reminderTime.getTime() > now.getTime() + 120 * 1000 && !existingIds.has(reminderId)) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminderId,
        content: {
          title: type === 'visit' ? `⏰ Upcoming Site Visit: ${clientName}` : `📞 Upcoming Callback: ${clientName}`,
          body: type === 'visit'
            ? `Site showing in 15 mins at ${details || 'property'}. Tap to review details.`
            : `Client callback due in 15 mins. Tap to prepare and call ${clientName}.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { type, id, phone: details },
        },
        trigger: {
          date: reminderTime,
          channelId: 'default',
        },
      });
    }

    // Exact time alert (at least 60s in future)
    const exactId = `${type}_exact_${id}`;
    if (schedDate.getTime() > now.getTime() + 60 * 1000 && !existingIds.has(exactId)) {
      await Notifications.scheduleNotificationAsync({
        identifier: exactId,
        content: {
          title: type === 'visit' ? `🚨 Site Visit Now: ${clientName}` : `🚨 Callback Due Now: ${clientName}`,
          body: type === 'visit'
            ? `Showing starting now for ${clientName} at ${details || 'property'}.`
            : `Time to call ${clientName} (${details || 'follow-up'}).`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 300, 200, 300],
          data: { type, id, phone: details },
        },
        trigger: {
          date: schedDate,
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
 * Cancel scheduled reminders when a visit or callback is completed or cancelled.
 */
export async function cancelActivityReminder(type: 'visit' | 'followup', id: string) {
  try {
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
