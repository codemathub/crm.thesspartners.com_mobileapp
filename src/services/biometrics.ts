import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY_TOKEN = 'g2brothers_biometric_jwt_token';
const STORAGE_KEY_USER = 'g2brothers_biometric_user_profile';
const STORAGE_KEY_ENABLED = 'g2brothers_biometric_enabled';
const STORAGE_KEY_TIMESTAMP = 'g2brothers_biometric_timestamp';

// 7-day JWT expiration policy
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface BiometricCapabilities {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: 'FaceID' | 'Fingerprint' | 'Iris' | 'Biometrics' | 'None';
  biometricLabel: string;
}

export interface SavedSession {
  token: string;
  user: any;
  savedAt: number;
}

// Fallback in-memory store for environments where SecureStore is unavailable
const inMemoryFallback: Record<string, string> = {};

async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const legacyKey = key.replace('g2brothers_', 'estatecrm_');
      return (typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || localStorage.getItem(legacyKey)) : null) || inMemoryFallback[key] || inMemoryFallback[legacyKey] || null;
    }
    const val = await SecureStore.getItemAsync(key);
    if (val) return val;
    const legacyVal = await SecureStore.getItemAsync(key.replace('g2brothers_', 'estatecrm_')).catch(() => null);
    return legacyVal || inMemoryFallback[key] || null;
  } catch (err) {
    console.warn(`[Biometrics] SecureStore.getItemAsync failed for ${key}:`, err);
    return inMemoryFallback[key] || null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    inMemoryFallback[key] = value;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`[Biometrics] SecureStore.setItemAsync failed for ${key}:`, err);
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    delete inMemoryFallback[key];
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`[Biometrics] SecureStore.deleteItemAsync failed for ${key}:`, err);
  }
}

/**
 * Inspect device hardware and enrollment for biometric/screen lock authentication
 */
export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
    let isEnrolled = false;
    let enrolledLevel = LocalAuthentication.SecurityLevel.NONE;

    try {
      isEnrolled = await LocalAuthentication.isEnrolledAsync();
    } catch {
      isEnrolled = false;
    }

    try {
      enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    } catch {
      enrolledLevel = LocalAuthentication.SecurityLevel.NONE;
    }

    let supportedTypes: LocalAuthentication.AuthenticationType[] = [];
    try {
      supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch {
      supportedTypes = [];
    }

    let biometricType: BiometricCapabilities['biometricType'] = 'Biometrics';
    let biometricLabel = 'Biometric Unlock';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'FaceID';
      biometricLabel = Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'Fingerprint';
      biometricLabel = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'Iris';
      biometricLabel = 'Iris Scanner';
    } else if (enrolledLevel === LocalAuthentication.SecurityLevel.SECRET) {
      biometricType = 'Biometrics';
      biometricLabel = 'Device PIN / Passcode';
    }

    // A device supports authentication if hardware exists, enrolled level is secret or biometric,
    // or if types are reported. Fallback to true so LocalAuthentication prompt can handle device PIN.
    const isAvailable = hasHardware || enrolledLevel > 0 || supportedTypes.length > 0 || Platform.OS !== 'web';
    const canAuthenticate = isEnrolled || enrolledLevel > 0 || hasHardware;

    return {
      isAvailable,
      isEnrolled: canAuthenticate,
      biometricType,
      biometricLabel,
    };
  } catch (err) {
    console.warn('[Biometrics] Error inspecting biometric capabilities:', err);
    return {
      isAvailable: true,
      isEnrolled: true,
      biometricType: 'Biometrics',
      biometricLabel: 'Biometric / Screen Lock',
    };
  }
}

/**
 * Securely saves JWT token and user profile for biometric quick unlock
 */
export async function saveBiometricSession(token: string, user: any): Promise<void> {
  if (!token || !user) return;
  const now = Date.now().toString();
  await Promise.all([
    secureSet(STORAGE_KEY_TOKEN, token),
    secureSet(STORAGE_KEY_USER, JSON.stringify(user)),
    secureSet(STORAGE_KEY_TIMESTAMP, now),
    secureSet(STORAGE_KEY_ENABLED, 'true'),
  ]);
}

/**
 * Checks whether user has enabled biometric unlock (defaults to true if session exists)
 */
export async function isBiometricsEnabled(): Promise<boolean> {
  const enabledStr = await secureGet(STORAGE_KEY_ENABLED);
  return enabledStr !== 'false';
}

/**
 * Toggles biometric unlock feature preference
 */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await secureSet(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Retrieves valid saved session adhering to the 7-day expiration policy
 */
export async function getSavedBiometricSession(): Promise<SavedSession | null> {
  try {
    const isEnabled = await isBiometricsEnabled();
    if (!isEnabled) {
      return null;
    }

    const token = await secureGet(STORAGE_KEY_TOKEN);
    const userJson = await secureGet(STORAGE_KEY_USER);
    const timestampStr = await secureGet(STORAGE_KEY_TIMESTAMP);

    if (!token || !userJson) {
      return null;
    }

    const savedAt = timestampStr ? parseInt(timestampStr, 10) : 0;
    const now = Date.now();

    // Enforce 7-day expiration policy
    if (now - savedAt > SEVEN_DAYS_MS) {
      console.log('[Biometrics] Saved 7-day session expired, clearing credentials');
      await clearBiometricSession();
      return null;
    }

    const user = JSON.parse(userJson);
    return { token, user, savedAt };
  } catch (err) {
    console.warn('[Biometrics] Error reading saved session:', err);
    return null;
  }
}

/**
 * Prompt device biometric authentication (Face ID / Fingerprint / Device PIN)
 */
export async function authenticateWithBiometrics(
  reason = 'Scan Face / Fingerprint to securely unlock G² Brothers CRM'
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use Device Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    if (result.error === 'user_cancel' || result.error === 'app_cancel') {
      return { success: false, error: 'Authentication cancelled' };
    }

    if (result.error === 'not_enrolled') {
      return {
        success: false,
        error: 'No biometric or screen lock enrolled. Please set a PIN, password, or biometric in device Settings.',
      };
    }

    return {
      success: false,
      error: result.error || 'Authentication could not be completed. Please enter your password.',
    };
  } catch (err: any) {
    console.warn('[Biometrics] authenticateAsync exception:', err);
    return { success: false, error: err.message || 'Biometric authentication error.' };
  }
}

/**
 * Completely clears stored biometric credentials upon explicit logout or account switch
 */
export async function clearBiometricSession(): Promise<void> {
  await Promise.all([
    secureDelete(STORAGE_KEY_TOKEN),
    secureDelete(STORAGE_KEY_USER),
    secureDelete(STORAGE_KEY_TIMESTAMP),
    secureDelete(STORAGE_KEY_ENABLED),
  ]);
}
