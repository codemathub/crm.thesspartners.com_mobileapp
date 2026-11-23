import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
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

/**
 * Registers device for remote push notifications.
 * Works even when the app is completely closed or killed by OS.
 * The token is sent to the backend and stored in MongoDB Atlas.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'EstateCRM Operational Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F5278',
        sound: 'default',
      });
    } catch {
      // Silently fall back on Expo Go or emulators where native channel manager is null
    }
  }

  await setupNotificationCategoriesAsync();

  if (Device.isDevice) {
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

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;

      // Register with EstateCRM backend
      if (token) {
        await mobileApi.registerPushToken(token);
        console.log('Push token successfully registered with EstateCRM backend:', token);
      }
    } catch (error) {
      console.warn('Failed to obtain Expo push token:', error);
    }
  } else {
    console.log('Notice: Physical device required for native remote push notifications.');
  }

  return token;
}
