import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { mobileApi } from './api';

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
        name: 'EstateCRM Operational Notifications',
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

      // Register with EstateCRM backend
      if (token) {
        await mobileApi.registerPushToken(token);
        console.log('Push token successfully registered with EstateCRM backend:', token);
      }
    } catch (error) {
      console.warn('Failed to obtain Expo push token (remote push might be limited in simulator):', error);
    }
  } else {
    console.log('Notice: Physical device required for native remote push notifications.');
  }

  return token;
}
