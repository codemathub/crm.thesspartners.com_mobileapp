import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal as RNModal,
  SafeAreaView,
  StatusBar as RNStatusBar,
  Image,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 38) : 0;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_CENTER_Y = Math.max(180, Math.round(SCREEN_HEIGHT * 0.30));

import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, setMobileAuthToken } from '../services/api';
import {
  getBiometricCapabilities,
  getSavedBiometricSession,
  authenticateWithBiometrics,
  saveBiometricSession,
  clearBiometricSession,
  BiometricCapabilities,
  SavedSession,
} from '../services/biometrics';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  initialSplash?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, initialSplash = true }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 2-Second Luxury Splash Screen & Navigation Animation State
  const [splashActive, setSplashActive] = useState(initialSplash);
  const logoTranslateY = useRef(new Animated.Value(initialSplash ? LOGO_CENTER_Y : 0)).current;
  const logoScale = useRef(new Animated.Value(initialSplash ? 1.15 : 1)).current;
  const logoOpacity = useRef(new Animated.Value(initialSplash ? 0 : 1)).current;
  const splashTextOpacity = useRef(new Animated.Value(initialSplash ? 0 : 0)).current;
  const splashBgOpacity = useRef(new Animated.Value(initialSplash ? 1 : 0)).current;
  const formOpacity = useRef(new Animated.Value(initialSplash ? 0 : 1)).current;
  const formTranslateY = useRef(new Animated.Value(initialSplash ? 50 : 0)).current;

  // Biometric Fast Unlock State
  const [biometrics, setBiometrics] = useState<BiometricCapabilities>({
    isAvailable: false,
    isEnrolled: false,
    biometricType: 'None',
    biometricLabel: 'Biometric Unlock',
  });
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  // Password Reset / Account Recovery State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetReason, setResetReason] = useState('Forgot password / locked out');
  const [resetNotes, setResetNotes] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [resetErrorMessage, setResetErrorMessage] = useState('');

  useEffect(() => {
    initBiometrics();

    if (!initialSplash) {
      setSplashActive(false);
      logoTranslateY.setValue(0);
      logoScale.setValue(1);
      logoOpacity.setValue(1);
      formOpacity.setValue(1);
      formTranslateY.setValue(0);
      splashBgOpacity.setValue(0);
      return;
    }

    // Step 1: Smoothly reveal centered logo & splash brand during first 400ms
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(splashTextOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();

    // Step 2: Exactly after 2 seconds (2000ms), animate logo UP and smoothly open login
    const splashTimer = setTimeout(() => {
      Animated.parallel([
        // Logo smoothly glides UP to top position
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 850,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        // Logo smoothly scales from 1.15 to standard 1.0
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 850,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        // Splash subtitle gently fades out
        Animated.timing(splashTextOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        // Dark splash background cross-fades to clean theme background
        Animated.timing(splashBgOpacity, {
          toValue: 0,
          duration: 800,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        // Login form glides UP and fades in
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 750,
          delay: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 750,
          delay: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSplashActive(false);
      });
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  const initBiometrics = async () => {
    try {
      const caps = await getBiometricCapabilities();
      setBiometrics(caps);
      // Retrieve saved 7-day session unconditionally so Quick Unlock card is active
      const session = await getSavedBiometricSession();
      if (session) {
        setSavedSession(session);
      }
    } catch (err) {
      console.warn('Biometrics check error:', err);
    }
  };

  const handleBiometricUnlock = async (sessionToUse?: SavedSession) => {
    const targetSession = sessionToUse || savedSession;
    if (!targetSession) return;

    setBiometricLoading(true);
    setErrorMessage('');

    try {
      const promptReason = `Scan ${biometrics.biometricLabel} to unlock G² Brothers CRM for ${targetSession.user.full_name || 'Executive'}`;
      const authResult = await authenticateWithBiometrics(promptReason);

      if (!authResult.success) {
        if (authResult.error && authResult.error !== 'Authentication cancelled') {
          setErrorMessage(authResult.error);
        }
        setBiometricLoading(false);
        return;
      }

      // Configure active session token in API client
      setMobileAuthToken(targetSession.token);

      // Verify token validity against MongoDB backend
      try {
        const meRes = await mobileApi.me();
        onLoginSuccess(meRes.user || meRes);
      } catch (apiErr: any) {
        const errStr = apiErr.message || '';
        if (errStr.includes('401') || errStr.includes('Unauthorized') || errStr.includes('expired')) {
          await clearBiometricSession();
          setSavedSession(null);
          setShowPasswordFallback(true);
          setErrorMessage('Your 7-day session has expired on the server. Please enter your password to renew.');
        } else {
          // In field situations with poor network, honor verified local 7-day session
          onLoginSuccess(targetSession.user);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Biometric authentication failed.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await clearBiometricSession();
    setSavedSession(null);
    setShowPasswordFallback(true);
    setEmail('');
    setPassword('');
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMessage('Please enter both your work email/username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await mobileApi.login(cleanEmail, cleanPass);
      // Automatically save session to enable instant biometric unlocks on future field visits
      await saveBiometricSession(res.access_token, res.user);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid username or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetRequest = async () => {
    setResetErrorMessage('');
    setResetSuccessMessage('');
    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setResetErrorMessage('Please enter your registered work email or username.');
      return;
    }

    setSubmittingReset(true);
    try {
      const fullReason = resetNotes.trim() ? `${resetReason} — ${resetNotes.trim()}` : resetReason;
      const deviceModel = Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';
      const osVersion = `${Platform.OS.toUpperCase()} ${Platform.Version || ''}`;
      const appVersion = 'v1.0.0';

      const res = await mobileApi.requestAdminPasswordReset(
        cleanEmail,
        fullReason,
        deviceModel,
        osVersion,
        appVersion
      );
      setResetSuccessMessage(
        res.detail || 'Password reset request submitted. Authorized administrator will process your credentials.'
      );
      setTimeout(() => {
        setResetModalOpen(false);
        setResetSuccessMessage('');
        setResetEmail('');
        setResetNotes('');
      }, 2500);
    } catch (err: any) {
      setResetErrorMessage(err.message || 'Failed to submit reset request. Please check network connection.');
    } finally {
      setSubmittingReset(false);
    }
  };

  const userInitial = savedSession?.user?.full_name
    ? savedSession.user.full_name
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'FE';

  const userRole = (savedSession?.user?.role || 'executive').replace('_', ' ').toUpperCase();

  return (
    <View style={styles.rootBackground}>
      <RNStatusBar
        barStyle={splashActive ? 'light-content' : 'dark-content'}
        animated
      />
      {/* Luxury Dark Background during Splash, smooth cross-fade to Light Theme */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#020912',
            opacity: splashBgOpacity,
            zIndex: 0,
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!splashActive}
            showsVerticalScrollIndicator={false}
          >
            {/* Navigating Logo Header: Centers on splash for 2s, then glides UP smoothly */}
            <Animated.View
              style={[
                styles.topBrandContainer,
                {
                  transform: [
                    { translateY: logoTranslateY },
                    { scale: logoScale },
                  ],
                  opacity: logoOpacity,
                  zIndex: 2,
                },
              ]}
            >
              <View style={styles.brandLogoCard}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.brandLogoImg}
                  resizeMode="contain"
                />
              </View>

              {/* Splash Tagline & Brand Details during 2-Second Splash */}
              {splashActive && (
                <Animated.View
                  style={[
                    styles.splashBrandColumn,
                    { opacity: splashTextOpacity },
                  ]}
                >
                  <View style={styles.splashBrandTitleRow}>
                    <Text style={styles.splashBrandTitle}>G</Text>
                    <Text style={styles.splashBrandSuperscript}>2</Text>
                    <Text style={styles.splashBrandTitle}> BROTHERS</Text>
                  </View>
                  <Text style={styles.splashTagline}>BUILDING VALUE  |  CREATING LEGACY</Text>
                  <View style={styles.splashBadge}>
                    <View style={styles.splashBadgeDot} />
                    <Text style={styles.splashBadgeText}>ENTERPRISE REALTY CRM</Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Login Card Container: Smoothly glides UP and opens as splash finishes */}
            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: formOpacity,
                  transform: [{ translateY: formTranslateY }],
                },
              ]}
              pointerEvents={splashActive ? 'none' : 'auto'}
            >
              {/* When a valid biometric session is present and not dismissed */}
              {savedSession && !showPasswordFallback ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Quick Unlock</Text>
                  <Text style={styles.cardSubtitle}>Field Executive Biometrics</Text>
                </View>
                <View style={styles.secureBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#057A55" style={{ marginRight: 4 }} />
                  <Text style={styles.secureBadgeText}>7-Day Active</Text>
                </View>
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#9B1C1C" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Profile Card Preview */}
              <View style={styles.bioProfileCard}>
                <View style={styles.bioAvatarCircle}>
                  <Text style={styles.bioAvatarText}>{userInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.bioProfileName}>{savedSession.user.full_name}</Text>
                    <View style={styles.bioRoleBadge}>
                      <Text style={styles.bioRoleBadgeText}>{userRole}</Text>
                    </View>
                  </View>
                  <Text style={styles.bioProfileEmail}>{savedSession.user.email}</Text>
                </View>
              </View>

              {/* Primary Biometric Unlock Button */}
              <TouchableOpacity
                style={[styles.bioUnlockBtn, biometricLoading && { opacity: 0.8 }]}
                onPress={() => handleBiometricUnlock()}
                disabled={biometricLoading}
                activeOpacity={0.85}
              >
                {biometricLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnInnerRow}>
                    <Ionicons
                      name={biometrics.biometricType === 'FaceID' ? 'scan-outline' : 'finger-print-outline'}
                      size={22}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.bioUnlockBtnText}>
                      Unlock with {biometrics.biometricLabel}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Secondary Options */}
              <View style={styles.bioSecondaryActionsRow}>
                <TouchableOpacity
                  style={styles.bioSubActionBtn}
                  onPress={() => setShowPasswordFallback(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="key-outline" size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
                  <Text style={styles.bioSubActionText}>Use Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bioSubActionBtn}
                  onPress={handleSwitchAccount}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                  <Text style={[styles.bioSubActionText, { color: '#6B7280' }]}>Switch Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Main Sign In Card (Standard Password Form) */
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Sign In</Text>
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#9B1C1C" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Return to Biometrics Pill (if saved session exists) */}
              {savedSession && (
                <TouchableOpacity
                  style={styles.returnToBioPill}
                  onPress={() => {
                    setShowPasswordFallback(false);
                    setErrorMessage('');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={biometrics.biometricType === 'FaceID' ? 'scan-outline' : 'finger-print-outline'}
                    size={16}
                    color="#1D4ED8"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.returnToBioPillText}>
                    Return to {biometrics.biometricLabel} Unlock
                  </Text>
                </TouchableOpacity>
              )}

              {/* Work Email / Username Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Work Email or Username</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={themeTokens.colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@company.com or username"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="key-outline"
                    size={18}
                    color={themeTokens.colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={themeTokens.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Sign In Button */}
              <TouchableOpacity
                style={[styles.loginBtn, loading && { opacity: 0.8 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnInnerRow}>
                    <Text style={styles.loginBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => {
                  setResetModalOpen(true);
                  setResetErrorMessage('');
                  setResetSuccessMessage('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotBtnText}>Forgot password? Request password reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

          {/* Account Recovery / Password Reset Modal */}
          <RNModal
            visible={resetModalOpen}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setResetModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitle}>Account Password Recovery</Text>
                  <TouchableOpacity onPress={() => setResetModalOpen(false)} style={styles.closeModalBtn}>
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalDesc}>
                  Enter your registered work email or username. An authorized system administrator will review and authorize your credential reset.
                </Text>

                {resetErrorMessage ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#9B1C1C" style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{resetErrorMessage}</Text>
                  </View>
                ) : null}

                {resetSuccessMessage ? (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={16} color="#03543F" style={{ marginRight: 6 }} />
                    <Text style={styles.successText}>{resetSuccessMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Registered Email or Username</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={themeTokens.colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="name@company.com or username"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      autoCapitalize="none"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Reason for Request</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {[
                      'Forgot password / locked out',
                      'Device upgrade / new handset',
                      'Session expired in field',
                      'Security incident',
                    ].map((r) => (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setResetReason(r)}
                        style={[
                          styles.reasonChip,
                          resetReason === r && styles.reasonChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonChipText,
                            resetReason === r && styles.reasonChipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Additional Notes (Optional)</Text>
                  <View style={[styles.inputWrapper, { height: 50, alignItems: 'flex-start', paddingTop: 6 }]}>
                    <TextInput
                      style={[styles.textInput, { height: 40 }]}
                      placeholder="e.g. Need urgent password reset"
                      value={resetNotes}
                      onChangeText={setResetNotes}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setResetModalOpen(false)}
                  >
                    <Text style={styles.modalCancelText} numberOfLines={1}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, submittingReset && { opacity: 0.7 }]}
                    onPress={handleSendResetRequest}
                    disabled={submittingReset}
                  >
                    {submittingReset ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitText} numberOfLines={1}>Submit Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </RNModal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
  );
};

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: STATUSBAR_HEIGHT,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  topBrandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  splashBrandColumn: {
    alignItems: 'center',
    marginTop: 18,
  },
  splashBrandTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  splashBrandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 2.2,
  },
  splashBrandSuperscript: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D4AF37',
    lineHeight: 18,
  },
  splashTagline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1.8,
    marginTop: 6,
  },
  splashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    marginTop: 14,
  },
  splashBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4AF37',
    marginRight: 6,
  },
  splashBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 1.2,
  },
  brandLogoCard: {
    width: 250,
    height: 125,
    backgroundColor: '#020912',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogoImg: {
    width: 235,
    height: 115,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  bioProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    gap: 12,
  },
  bioAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  bioProfileName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  bioRoleBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bioRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  bioProfileEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bioUnlockBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
    shadowOpacity: 0,
  },
  bioUnlockBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bioSecondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bioSubActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  bioSubActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  returnToBioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  returnToBioPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#03543F',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#9B1C1C',
    flex: 1,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1F2937',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  loginBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: 16,
    padding: 6,
  },
  forgotBtnText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  securityFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginBottom: 14,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  reasonChipText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  reasonChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    alignItems: 'center',
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalSubmitBtn: {
    flex: 1.5,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DEF7EC',
    borderWidth: 1,
    borderColor: '#BCF0DA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 12,
    color: '#03543F',
    flex: 1,
    fontWeight: '600',
  },
});
