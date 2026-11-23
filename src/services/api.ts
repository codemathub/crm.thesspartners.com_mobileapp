import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Dynamic API Base URL Resolution & Runtime Server Discovery
// ---------------------------------------------------------------------------
// Allows the mobile app to connect seamlessly whether running on:
//   • Physical phone via Wi-Fi → default to verified LAN IP (192.168.1.5:8000)
//   • Android Emulator          → routes 10.0.2.2:8000
//   • iOS Simulator / Web       → routes localhost:8000
//   • Custom IP entered by user at runtime via the Login diagnostic UI
// ---------------------------------------------------------------------------

export const KNOWN_PC_LAN_IP = '192.168.1.5';
export const PROD_API_URL = 'https://api.crm.thesspartners.com/api/v1';
export const API_PORT = 8000;

let userConfiguredHost: string | null = null;

export function setUserConfiguredHost(host: string | null) {
  userConfiguredHost = host ? host.trim() : null;
}

export function getUserConfiguredHost(): string | null {
  return userConfiguredHost;
}

export function validateMobileNumber(phone: string, label = 'Mobile number'): { valid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { valid: false, error: `${label} is compulsory and cannot be left blank.` };
  }
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');
  let standardDigits = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    standardDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    standardDigits = digits.slice(1);
  }

  if (standardDigits.length < 10) {
    return { valid: false, error: `${label} must contain at least 10 digits (got '${clean}').` };
  }
  if (standardDigits.length > 15) {
    return { valid: false, error: `${label} cannot exceed 15 digits.` };
  }
  if (new Set(standardDigits).size <= 2) {
    return { valid: false, error: `${label} '${clean}' is not a valid real mobile number.` };
  }
  if (['1234567890', '0123456789', '9876543210', '0987654321'].includes(standardDigits)) {
    return { valid: false, error: `${label} cannot be a generic placeholder.` };
  }
  if (standardDigits.length === 10 && !/^[6-9]/.test(standardDigits)) {
    return { valid: false, error: `${label} must start with 6, 7, 8, or 9 for a valid 10-digit mobile number.` };
  }
  return { valid: true };
}

export function resolveApiBaseUrl(): string {
  // 0. Production environment variable (Expo standard)
  if (process.env.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
    return envUrl.endsWith('/api/v1') ? envUrl : `${envUrl}/api/v1`;
  }

  // 1. In release / standalone APK build, always use production API
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PROD_API_URL;
  }

  // 2. User manual override (if configured in app)
  if (userConfiguredHost) {
    let clean = userConfiguredHost.replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    if (!clean.includes(':8000') && !clean.includes(':80') && !clean.includes(':443')) {
      clean = `${clean}:${API_PORT}`;
    }
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  // 2. Try Expo host detection from multiple possible properties in Expo SDKs
  const c = Constants as any;
  const rawExpoHost =
    Constants.expoConfig?.hostUri ||
    c?.manifest?.debuggerHost ||
    c?.manifest2?.extra?.expoClient?.hostUri ||
    c?.manifest?.hostUri ||
    c?.experienceUrl;

  if (rawExpoHost && typeof rawExpoHost === 'string') {
    const withoutProto = rawExpoHost.replace(/^[a-zA-Z]+:\/\//, '');
    const lanIp = withoutProto.split(':')[0].split('/')[0];
    if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1' && !lanIp.startsWith('10.0.2.')) {
      return `http://${lanIp}:${API_PORT}/api/v1`;
    }
  }

  // 3. Fallback for physical devices vs emulators:
  // On physical Android/iOS phones, 10.0.2.2 and localhost never connect to the PC!
  const isPhysicalPhone = Constants.isDevice ?? true;
  if (isPhysicalPhone) {
    return `http://${KNOWN_PC_LAN_IP}:${API_PORT}/api/v1`;
  }

  // 4. Android emulator fallback (10.0.2.2 routes to PC localhost)
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}/api/v1`;
  }

  // 5. iOS Simulator & Web fallback
  return `http://localhost:${API_PORT}/api/v1`;
}

/** Returns the active API base URL */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

// ---------------------------------------------------------------------------
// Network timeout (8 seconds) — prevents infinite spinner on unreachable host
// ---------------------------------------------------------------------------
const REQUEST_TIMEOUT_MS = 8000;

let authToken: string | null = null;

export function setMobileAuthToken(token: string | null) {
  authToken = token;
}

export function getMobileAuthToken(): string | null {
  return authToken;
}

/** Fast diagnostic probe for backend & database health */
export async function pingServer(): Promise<{
  ok: boolean;
  status?: number;
  url: string;
  error?: string;
  database?: string;
  latencyMs?: number;
}> {
  const baseUrl = getApiBaseUrl();
  const testUrl = `${baseUrl}/health`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  const startTime = Date.now();

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, status: res.status, url: testUrl, database: data.database, latencyMs };
    }
    return { ok: false, status: res.status, url: testUrl, error: `HTTP ${res.status}`, latencyMs };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const msg =
      err.name === 'AbortError'
        ? 'Connection timed out (4s). Server not responding.'
        : err.message || 'Cannot reach server';
    return { ok: false, url: testUrl, error: msg, latencyMs };
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // 8-second AbortController timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(
        `Server unreachable — request to ${baseUrl}${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. ` +
        'Ensure the backend is running (run_backend.bat) on 0.0.0.0:8000 and your phone is on the same Wi-Fi network.'
      );
    }
    // Network failure (no Wi-Fi, DNS, refused connection, etc.)
    throw new Error(
      `Network error — could not reach server at ${baseUrl}. ` +
      'Check that run_backend.bat is running on your PC and your phone is connected to the same Wi-Fi network.'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(errorBody.detail || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export interface AdditionalCharge {
  name: string;
  amount: number;
  frequency: 'one_time' | 'monthly';
}

export interface MobileUser {
  id: string;
  full_name: string;
  email: string;
  mobile?: string;
  role: 'super_admin' | 'admin' | 'executive';
  account_status: 'active' | 'invited' | 'deactivated';
  created_at?: string;
  last_login_at?: string;
}

export interface MobileProperty {
  id: string;
  property_id: string;
  transaction_type: 'rent' | 'sale';
  property_type: string;
  bhk?: string;
  additional_rooms: string[];
  society_id: string;
  society_name: string;
  location: string;
  expected_amount: number;
  currency: string;
  negotiable: boolean;
  security_deposit?: number;
  maintenance_mode: 'included' | 'extra';
  maintenance_amount?: number;
  additional_charges: AdditionalCharge[];
  owner_name: string;
  owner_phone: string;
  agent_name?: string;
  agent_phone?: string;
  tenant_type?: string;
  status: 'available' | 'rented' | 'sold' | 'reserved' | 'under_negotiation' | 'archived' | 'on_hold';
  notes?: string;
  created_at: string;
}

export interface MobileSociety {
  id: string;
  society_id: string;
  name: string;
  is_active: boolean;
}

export interface MobileMasterOption {
  id: string;
  category: string;
  value: string;
  is_active: boolean;
}

export interface MobileCustomer {
  id: string;
  customer_id: string;
  name: string;
  primary_phone: string;
  primary_phone_normalized: string;
  alternate_phone?: string;
  whatsapp_phone?: string;
  customer_type: string;
  priority: string;
  enquiries_count: number;
  notes?: string;
  created_at?: string;
}

export interface MobileEnquiry {
  id: string;
  enquiry_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  transaction_type: 'rent' | 'sale';
  looking_for: string;
  preferred_locations: string[];
  preferred_societies: string[];
  budget_min: number;
  budget_max: number;
  status: string;
  priority: string;
  tenant_type?: string;
  notes?: string;
  created_at: string;
}

export interface AutocompleteSuggestion {
  id: string;
  entity_type: 'property' | 'enquiry' | 'customer';
  title: string;
  subtitle: string;
  badge: string;
  extra?: Record<string, any>;
}

export interface MobileSearchResultItem {
  type: 'property' | 'customer' | 'enquiry';
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  metadata?: Record<string, any>;
}

export interface MobilePropertyMatchItem {
  property_id: string;
  society_name: string;
  location: string;
  bhk?: string;
  expected_amount: number;
  currency: string;
  negotiable: boolean;
  status: string;
  match_score: number;
  match_reasons: string[];
  owner_name: string;
  owner_phone: string;
}

export interface MobileEnquiryMatchesResponse {
  enquiry_id: string;
  total_matches: number;
  matches: MobilePropertyMatchItem[];
}

export interface MobileVisit {
  id: string;
  visit_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  enquiry_id: string;
  property_id: string;
  property_society: string;
  property_bhk?: string;
  property_location: string;
  property_amount: number;
  property_transaction_type: string;
  scheduled_at: string;
  assigned_to?: string;
  assigned_name?: string;
  claim_status: 'direct_assigned' | 'unclaimed' | 'claimed';
  claimed_by?: string;
  claimed_by_name?: string;
  claimed_at?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'rescheduled' | 'cancelled';
  notes?: string;
  outcome?: string;
  remarks?: string;
  reschedule_reason?: string;
  cancellation_reason?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MobileFollowUp {
  id: string;
  followup_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  enquiry_id: string;
  enquiry_requirement?: string;
  scheduled_at: string;
  responsible_employee: string;
  responsible_name?: string;
  notes: string;
  status: 'scheduled' | 'due' | 'completed' | 'missed' | 'cancelled';
  outcome?: string;
  remarks?: string;
  completed_at?: string;
  reschedule_reason?: string;
  cancellation_reason?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MobileFollowUpsResponse {
  items: MobileFollowUp[];
  total: number;
  overdue_count: number;
  today_count: number;
  upcoming_count: number;
}

export interface MobileTask {
  id: string;
  task_id: string;
  title: string;
  task_type: string;
  assigned_to: string;
  assigned_name?: string;
  assigned_by: string;
  assigned_by_name?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled';
  target_client_name?: string;
  target_client_phone?: string;
  monthly_budget?: string;
  asset_preference?: string;
  property_id?: string;
  enquiry_id?: string;
  lockbox_tag?: string;
  sla_minutes: number;
  due_at?: string;
  instructions?: string;
  acknowledged_at?: string;
  completed_at?: string;
  completion_remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface MobileAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: string;
  priority: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  expires_at?: string;
}

export interface MobileNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export const mobileApi = {
  // Authentication
  login: async (email: string, password: string, device_id = 'mobile-device') => {
    const res = await request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_id, platform: 'android', device_name: 'Mobile App' }),
    });
    setMobileAuthToken(res.access_token);
    return res;
  },
  me: () => request<any>('/auth/me'),
  logout: () => {
    setMobileAuthToken(null);
  },
  requestAdminPasswordReset: (
    email: string,
    reason?: string,
    deviceModel?: string,
    osVersion?: string,
    appVersion?: string
  ) =>
    request<{ detail: string }>('/auth/request-admin-password-reset', {
      method: 'POST',
      body: JSON.stringify({
        email,
        reason,
        device_model: deviceModel,
        os_version: osVersion,
        app_version: appVersion,
      }),
    }),

  getProperties: (search?: string, transactionType?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (transactionType && transactionType !== 'All') params.append('transaction_type', transactionType.toLowerCase());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: MobileProperty[]; total: number }>(`/properties${qs}`);
  },
  getProperty: (id: string) => request<MobileProperty>(`/properties/${id}`),
  createProperty: (data: any) => request<MobileProperty>('/properties', { method: 'POST', body: JSON.stringify(data) }),
  updateProperty: (propertyId: string, data: any) =>
    request<MobileProperty>(`/properties/${propertyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  addPropertyNote: (
    propertyId: string,
    data: { notes: string; category?: string; scheduled_call_at?: string }
  ) =>
    request<MobileProperty>(`/properties/${encodeURIComponent(propertyId)}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  // Master Data & Societies
  getSocieties: () => request<MobileSociety[]>('/societies?is_active=true'),
  createSociety: (name: string, location?: string) =>
    request<MobileSociety>('/societies', { method: 'POST', body: JSON.stringify({ name, location }) }),
  getMasterData: (category?: string) =>
    request<MobileMasterOption[]>(`/master-data?is_active=true${category ? `&category=${category}` : ''}`),
  createMasterDataOption: (category: string, value: string) =>
    request<MobileMasterOption>('/master-data', { method: 'POST', body: JSON.stringify({ category, value }) }),

  // Users & Staff Management
  getUsers: (role?: string) => {
    const qs = role && role !== 'All' ? `?role=${role.toLowerCase()}` : '';
    return request<MobileUser[]>(`/users${qs}`);
  },
  createUser: (data: { full_name: string; email: string; mobile: string; role: string; password: string }) =>
    request<MobileUser>('/users/create', { method: 'POST', body: JSON.stringify(data) }),
  deactivateUser: (userId: string) =>
    request<{ detail: string }>(`/users/${userId}/deactivate`, { method: 'POST' }),
  reactivateUser: (userId: string) =>
    request<{ detail: string }>(`/users/${userId}/reactivate`, { method: 'POST' }),
  deleteUser: (userId: string) =>
    request<{ detail: string }>(`/users/${userId}`, { method: 'DELETE' }),
  resetUserPassword: (userId: string, newPassword: string) =>
    request<{ detail: string }>(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    }),

  // Reports KPIs
  getReportKPIs: () => request<any>('/reports/kpis'),

  // Customers
  checkDuplicatePhone: (phone: string) =>
    request<{ has_duplicate: boolean; matches: any[] }>(`/customers/check-phone?phone=${encodeURIComponent(phone)}`),
  getCustomers: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<{ items: MobileCustomer[]; total: number }>(`/customers${qs}`);
  },
  getCustomer360: (customerId: string) =>
    request<{
      customer: MobileCustomer;
      enquiries: MobileEnquiry[];
      visits: any[];
      followups: any[];
      matched_properties: any[];
      stats: {
        total_enquiries: number;
        active_enquiries: number;
        total_visits: number;
        pending_visits: number;
        total_followups: number;
        pending_followups: number;
        matched_properties_count: number;
      };
    }>(`/customers/${encodeURIComponent(customerId)}/360`),
  addCustomerFollowup: (
    customerId: string,
    data: { notes: string; scheduled_at?: string; enquiry_id?: string }
  ) =>
    request<any>(`/customers/${encodeURIComponent(customerId)}/followups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createCustomer: (data: any) => request<MobileCustomer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (customerId: string, data: Partial<MobileCustomer>) =>
    request<MobileCustomer>(`/customers/${customerId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Enquiries
  getEnquiries: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status && status !== 'All') params.append('status', status.toLowerCase().replace(' ', '_').replace('-', '_'));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: MobileEnquiry[]; total: number }>(`/enquiries${qs}`);
  },
  createEnquiry: (data: any) => request<MobileEnquiry>('/enquiries', { method: 'POST', body: JSON.stringify(data) }),
  changeEnquiryStatus: (id: string, newStatus: string, reason?: string) =>
    request<MobileEnquiry>(`/enquiries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus, reason }),
    }),

  // Global Search & Matching
  globalSearch: (query: string, scope?: string) => {
    const params = new URLSearchParams({ q: query });
    if (scope && scope !== 'all') {
      params.append('type', scope);
    }
    return request<{ query: string; total_results: number; results: MobileSearchResultItem[] }>(`/search?${params.toString()}`);
  },
  getSuggestions: (query: string, entity: 'all' | 'property' | 'customer' | 'enquiry' = 'all', limit: number = 8) => {
    const params = new URLSearchParams({ q: query, entity, limit: String(limit) });
    return request<{ query: string; total: number; suggestions: AutocompleteSuggestion[] }>(`/search/suggestions?${params.toString()}`);
  },
  getEnquiryMatches: (enquiryId: string) =>
    request<MobileEnquiryMatchesResponse>(`/search/matches/${enquiryId}`),
  getPropertyMatches: (propertyId: string) =>
    request<{
      property_id: string;
      society_name: string;
      property_type: string;
      expected_amount: number;
      total_matches: number;
      matches: Array<{
        enquiry_id: string;
        customer_name: string;
        customer_phone: string;
        looking_for: string;
        budget_min: number;
        budget_max: number;
        status: string;
        priority: string;
        tenant_type?: string;
        match_score: number;
        match_reasons: string[];
        created_at?: string;
      }>;
    }>(`/search/property-matches/${propertyId}`),

  // Visits & Schedule
  getVisits: (params: {
    status?: string;
    claim_status?: string;
    my_visits?: boolean;
    open_claims_only?: boolean;
    date?: string;
    search?: string;
    property_id?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    return request<{ items: MobileVisit[]; total: number; open_claims_count: number; today_visits_count: number }>(`/visits?${searchParams.toString()}`);
  },
  claimVisit: (visitId: string) => request<MobileVisit>(`/visits/${visitId}/claim`, { method: 'POST' }),
  completeVisit: (visitId: string, outcome?: string, remarks?: string) =>
    request<MobileVisit>(`/visits/${visitId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcome, remarks }),
    }),
  rescheduleVisit: (visitId: string, newDate: string, reason: string) =>
    request<MobileVisit>(`/visits/${visitId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ new_scheduled_at: newDate, reason }),
    }),
  createVisit: (data: { enquiry_id: string; property_id: string; scheduled_at: string; notes?: string }) =>
    request<MobileVisit>('/visits', { method: 'POST', body: JSON.stringify(data) }),

  // Follow-ups & Reminders (Phase 9)
  getFollowUps: (params: {
    range?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
    status?: string;
    enquiry_id?: string;
    customer_id?: string;
    search?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    return request<MobileFollowUpsResponse>(`/followups?${searchParams.toString()}`);
  },
  createFollowUp: (data: { enquiry_id: string; scheduled_at: string; notes: string }) =>
    request<MobileFollowUp>('/followups', { method: 'POST', body: JSON.stringify(data) }),
  completeFollowUp: (
    followupId: string,
    data: {
      outcome: string;
      remarks?: string;
      next_followup_at?: string;
      next_followup_notes?: string;
    }
  ) => request<MobileFollowUp>(`/followups/${followupId}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  rescheduleFollowUp: (followupId: string, newDate: string, reason: string) =>
    request<MobileFollowUp>(`/followups/${followupId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ new_scheduled_at: newDate, reason }),
    }),
  cancelFollowUp: (followupId: string, reason: string) =>
    request<MobileFollowUp>(`/followups/${followupId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  addFollowUpNote: (
    followupId: string,
    data: { notes: string; outcome?: string; remarks?: string }
  ) =>
    request<MobileFollowUp>(`/followups/${followupId}/note`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Tasks, Directives & Notifications (Phase 10)
  getTasks: (params: { status?: string; my_tasks?: boolean } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.my_tasks) searchParams.append('my_tasks', 'true');
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<{ items: MobileTask[]; total: number; pending_count: number; sla_breach_count: number }>(`/tasks${qs}`);
  },
  createTask: (data: any) =>
    request<MobileTask>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  acknowledgeTask: (taskId: string) =>
    request<MobileTask>(`/tasks/${taskId}/acknowledge`, { method: 'POST' }),
  completeTask: (taskId: string, remarks?: string) =>
    request<MobileTask>(`/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  getAnnouncements: () =>
    request<MobileAnnouncement[]>('/tasks/announcements/active'),
  getNotifications: (unreadOnly = false) => {
    const qs = unreadOnly ? '?unread_only=true' : '';
    return request<{ items: MobileNotification[]; total: number; unread_count: number }>(`/notifications${qs}`);
  },
  markNotificationRead: (id: string) =>
    request<{ detail: string }>(`/notifications/${id}/read`, { method: 'POST' }),
  registerPushToken: (pushToken: string) =>
    request<{ detail: string }>('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ push_token: pushToken }),
    }),

  // Deal Close & Abort Lifecycle (Phase 11)
  closeEnquiryDeal: (enquiryId: string, data: { property_id: string; deal_amount?: number; final_remarks?: string; visit_id?: string }) =>
    request<any>(`/enquiries/${enquiryId}/close-deal`, { method: 'POST', body: JSON.stringify(data) }),
  abortEnquiry: (enquiryId: string, data: { reason: string; final_remarks?: string; visit_id?: string }) =>
    request<any>(`/enquiries/${enquiryId}/abort`, { method: 'POST', body: JSON.stringify(data) }),
  closeVisitDeal: (visitId: string, data: { deal_amount?: number; final_remarks?: string } = {}) =>
    request<any>(`/visits/${visitId}/close-deal`, { method: 'POST', body: JSON.stringify(data) }),
  abortVisitDeal: (visitId: string, data: { reason: string; remarks?: string }) =>
    request<any>(`/visits/${visitId}/abort-deal`, { method: 'POST', body: JSON.stringify(data) }),

  // WhatsApp Integration (Phase 13 / PRD 5.20)
  logWhatsAppShare: (data: { property_id?: string; enquiry_id?: string; customer_phone?: string; share_channel?: string; message_excerpt?: string }) =>
    request<{ status: string; timestamp: string }>('/whatsapp/log-share', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getWhatsAppStatus: () =>
    request<{ is_configured: boolean; mode_a_manual_available: boolean; mode_b_direct_api_available: boolean; message: string }>('/whatsapp/status'),
};
