'use client';

import { MenuItem, AppSettings, Language, UserReport, ReportPriority, ReportIdConfig } from './types';
import { generateReportId, getNextSequence } from './id-generator';

const MENUS_KEY = 'nib_menus';
const SETTINGS_KEY = 'nib_settings';
const REPORTS_KEY = 'nib_reports';
const CLICK_LOG_KEY = 'nib_click_history';

const defaultLanguages: Language[] = [
  { code: 'en', name: 'English', isDefault: true },
  { code: 'am', name: 'Amharic' }
];

export const defaultSystemTranslations: Record<string, Record<string, string>> = {
  ui_bank_name: { en: 'Nib International Bank', am: 'ንብ ኢንተርናሽናል ባንክ' },
  ui_online: { en: 'Online', am: 'አየር ላይ' },
  ui_offline: { en: 'Offline', am: 'ከመስመር ውጭ' },
  ui_checking: { en: 'Checking...', am: 'በመፈተሽ ላይ...' },
  ui_report_status_btn: { en: 'Check Report Status', am: 'የሪፖርት ሁኔታ አረጋግጥ' },
  ui_select_option: { en: 'Please select an option:', am: 'እባክዎ አማራጭ ይምረጡ፡' },
  ui_welcome_subtitle: { en: 'How can we assist you today?', am: 'ዛሬ እንዴት ልንረዳዎ እንችላለን?' },
  ui_enter_report_id: { en: 'Please enter your Report Reference ID:', am: 'እባክዎ የሪፖርት ቁጥርዎን ያስገቡ፡' },
  ui_prev: { en: 'Prev', am: 'ወደ ኋላ' },
  ui_next: { en: 'Next', am: 'ቀጣይ' },
  ui_related: { en: 'Related', am: 'ተዛማጅ' },
  ui_placeholder_report_id: { en: 'Enter reference ID...', am: 'የሪፖርት ቁጥር እዚህ ያስገቡ...' },
  ui_placeholder_input: { en: 'Enter requested information...', am: 'እዚህ ይጻፉ...' },
  ui_error_bool: { en: 'Please enter "true" or "false" only', am: 'እባክዎ "true" ወይም "false" ብቻ ያስገቡ' },
  ui_error_number: { en: 'Please enter a valid number', am: 'እባክዎ ቁጥር ብቻ ያስገቡ' },
  ui_error_phone: { en: 'Please enter a valid Ethiopian phone number (e.g., 0911... or +251...)', am: 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' },
  ui_error_email: { en: 'Please enter a valid email address', am: 'እባክዎ ትክክለኛ ኢሜል ያስገቡ' },
  ui_toast_required_title: { en: 'Required Field', am: 'የግዴታ መስክ' },
  ui_toast_required_desc: { en: 'Please provide this information to continue.', am: 'እባክዎ ይህንን መረጃ ያስገቡ' },
  ui_toast_invalid_title: { en: 'Invalid Input', am: 'ትክክል ያልሆነ ግብዓት' },
  ui_skip: { en: 'Skip', am: 'ዘለል' },
  ui_cancel: { en: 'Cancel', am: 'ሰርዝ' },
  ui_skipped: { en: '[Skipped]', am: '[ዘለል]' },
  ui_loading_submitting_report: { en: 'Submitting your report...', am: 'ሪፖርት እየላክን ነው...' },
  ui_loading_connecting: { en: 'Connecting to secure server...', am: 'ደህንነቱ ከተጠበቀ አገልጋይ ጋር በመገናኘት ላይ...' },
  ui_report_submit_success: { en: 'Your report has been submitted successfully. Thank you.', am: 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' },
  ui_report_submit_fail: { en: "Sorry, we couldn't submit your report.", am: 'ይቅርታ፣ ሪፖርትዎን ማስገባት አልቻልንም።' },
  ui_results_intro: { en: 'Here are the results:', am: 'የተገኙ ውጤቶች የሚከተሉት ናቸው' },
  ui_no_data: { en: 'No data found.', am: 'ምንም መረጃ አልተገኘም።' },
  ui_error_processing: { en: 'Sorry, an error occurred while processing your request.', am: 'ይቅርታ፣ ጥያቄዎን ለማካሄድ ስህተት ተከስቷል።' },
  ui_request_success: { en: 'Your request was processed successfully.', am: 'ጥያቄዎ በተሳካ ሁኔታ ተከናውኗል።' },
  ui_admin_feedback: { en: 'Admin Feedback', am: 'የአስተዳዳሪ ምላሽ' },
  ui_status_resolved: { en: 'Resolved', am: 'ተፈትቷል' },
  ui_status_reviewed: { en: 'Reviewed', am: 'በመመርመር ላይ' },
  ui_status_pending: { en: 'Pending', am: 'በጥበቃ ላይ' },
  ui_status_label: { en: 'Report Status', am: 'የሪፖርት ሁኔታ' },
  ui_original_request: { en: 'Original Request', am: 'የቀረበ ጥያቄ' },
  ui_error_fallback: { en: 'An error occurred.', am: 'ስህተት ተከስቷል።' },
  ui_welcome_am: { en: 'Welcome to Nib International Bank', am: 'እንኳን ወደ ንብ ኢንተርናሽናል ባንክ በደህና መጡ!' },
  ui_welcome_en: { en: 'Welcome to Nib International Bank', am: 'Welcome to Nib International Bank' },
  ui_back: { en: 'Back', am: 'ተመለስ' },
  ui_home: { en: 'Home', am: 'ዋና ገጽ' }
};

const defaultMenus: MenuItem[] = [
  {
    id: '1',
    parentId: null,
    name: 'Our Services',
    nameAm: 'የእኛ አገልግሎቶች',
    responseType: 'static',
    order: 0,
    content: '<p>Explore what we can do for you.</p>',
    contentAm: '<p>ለእርስዎ ምን ማድረግ እንደምንችል ይመርምሩ።</p>',
    attachedMenuIds: ['ex-rate', 'path-param-test', 'fraud-report-test'],
    trackClicks: true,
    clickCount: 15,
    sessionClickCount: 10
  },
  {
    id: 'fraud-report-test',
    parentId: null,
    name: 'Report Fraud',
    nameAm: 'ማጭበርበር ሪፖርት ያድርጉ',
    responseType: 'report',
    order: 1,
    content: '<p>Thank you for your report. Our security team has been notified and will review it shortly.</p>',
    contentAm: '<p>ለሪፖርትዎ እናመሰግናለን። የደህንነት ቡድናችን መረጃ ደርሶታል እና በቅርቡ ይመረምረዋል።</p>',
    trackClicks: true,
    clickCount: 8,
    sessionClickCount: 5,
    apiConfig: {
      name: 'Fraud Report Collection',
      endpoint: '',
      method: 'POST',
      headers: {},
      timeout: 0,
      retry: 0,
      loginRequired: true,
      defaultPriority: 'high',
      requiredKYC: [],
      kycFields: [
        {
          id: 'fraud-acc',
          name: 'account_number',
          prompt: 'Please enter the affected account number:',
          promptAm: 'እባክዎ የተጎዳውን የሂሳብ ቁጥር ያስገቡ፡',
          type: 'text',
          order: 0,
          required: true
        },
        {
          id: 'fraud-desc',
          name: 'description',
          prompt: 'Briefly describe the suspicious activity (Optional):',
          promptAm: 'እባክዎ አጠራጣሪ እንቅስቃሴውን በአጭሩ ይግለጹ (አማራጭ)፡',
          type: 'text',
          order: 1,
          required: false
        }
      ],
      requestParameters: [],
      responseMapping: {
        type: 'message',
        template: 'Report Submitted! Your Reference ID is {{response.id}}',
        errorFallback: 'Report submission failed.',
        timeoutMessage: 'Timeout.',
        authRequiredMessage: 'Auth Required.'
      }
    }
  },
  {
    id: 'ex-rate',
    parentId: null,
    name: 'Exchange Rates',
    nameAm: 'የምንዛሬ ተመኖች',
    responseType: 'api',
    order: 2,
    trackClicks: true,
    clickCount: 24,
    sessionClickCount: 18,
    apiConfig: {
      name: 'Daily Exchange Rates',
      endpoint: '/api/test/exchange-rate',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 1,
      loginRequired: false,
      kycFields: [],
      requiredKYC: [],
      requestParameters: [
        { apiKey: 'base', sourceType: 'static', sourceValue: 'USD' }
      ],
      authConfig: {
        type: 'apiKey',
        apiKey: { header: 'X-API-KEY', value: 'secret-123' }
      },
      responseMapping: {
        type: 'table',
        template: 'Here are the current rates for {{response.base}}:',
        tableColumns: [
          { header: 'Currency', headerAm: 'ምንዛሬ', key: 'currency' },
          { header: 'Rate', headerAm: 'ተመን', key: 'rate' },
          { header: 'Last Update', headerAm: 'መጨረሻ የዘመነው', key: 'updated' }
        ],
        errorFallback: 'Could not retrieve exchange rates.',
        timeoutMessage: 'Request timed out.',
        authRequiredMessage: 'Login required.'
      }
    }
  },
  {
    id: 'path-param-test',
    parentId: null,
    name: 'Profile Lookup',
    nameAm: 'የመገለጫ ፍለጋ',
    responseType: 'api',
    order: 3,
    trackClicks: false,
    clickCount: 0,
    sessionClickCount: 0,
    apiConfig: {
      name: 'Dynamic Path Parameter Lookup',
      endpoint: '/api/test/profile/{{account_id}}',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 0,
      loginRequired: true,
      requiredKYC: [],
      authConfig: {
        type: 'bearer',
        bearer: { header: 'Authorization', template: 'Bearer {{user_token}}' }
      },
      kycFields: [
        {
          id: 'kyc-profile-id',
          name: 'account_id',
          prompt: 'Please enter a User ID to lookup (try: user_123)',
          promptAm: 'እባክዎ መለያዎን ያስገቡ (ለምሳሌ: user_123)',
          type: 'text',
          order: 0,
          required: true
        }
      ],
      requestParameters: [],
      responseMapping: {
        type: 'message',
        template: 'Found Profile: {{response.data.full_name}} (Email: {{response.data.email}}). Status: {{response.data.kyc_status}}.',
        templateAm: 'መገለጫ ተገኝቷል: {{response.data.full_name}} (ኢሜል: {{response.data.email}})',
        errorFallback: 'Profile not found.',
        timeoutMessage: 'Timeout.',
        authRequiredMessage: 'Auth Required.'
      }
    }
  },
  {
    id: 'admin-default-example',
    parentId: null,
    name: 'API Key Example (Admin Defaults)',
    nameAm: 'API ቁልፍ ምሳሌ (አስተዳዳሪ ነባሪዎች)',
    responseType: 'api',
    order: 4,
    isActive: true,
    trackClicks: false,
    clickCount: 0,
    sessionClickCount: 0,
    apiConfig: {
      name: 'API Key with Admin Defaults',
      endpoint: '/api/test/orders',
      method: 'GET',
      rootKey: 'data',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 0,
      loginRequired: false,
      requiredKYC: [],
      authConfig: {
        type: 'apiKey',
        apiKey: { header: 'x-api-key', value: 'mysecretapikey123' }
      },
      kycFields: [
        {
          id: 'kyc-limit',
          name: 'limit',
          prompt: 'Enter limit (optional, defaults to 10)',
          promptAm: 'ድህረ መጨረሻ ያስገቡ (አማራጭ፣ ነባሪ 10 ነው)',
          type: 'number',
          order: 0,
          required: false
        }
      ],
      requestParameters: [
        {
          apiKey: 'limit',
          sourceType: 'admin_default',
          sourceValue: '10',
          isEnabled: true,
          isUserConfigurable: true
        },
        {
          apiKey: 'api_key',
          sourceType: 'admin_default',
          sourceValue: 'mysecretapikey123',
          isEnabled: true,
          isUserConfigurable: false
        }
      ],
      responseMapping: {
        type: 'table',
        template: 'Here are the orders:',
        tableDataKey: 'data',
        tableColumns: [
          { header: 'ID', key: 'id' },
          { header: 'Total', key: 'total' }
        ],
        errorFallback: 'Could not retrieve orders.',
        timeoutMessage: 'Request timed out.',
        authRequiredMessage: 'Authentication required.'
      }
    }
  }
];

// Menu Store
export function getStoredMenus(): MenuItem[] {
  if (typeof window === 'undefined') return defaultMenus;
  const stored = localStorage.getItem(MENUS_KEY);
  return stored ? JSON.parse(stored) : defaultMenus;
}

export function saveMenus(menus: MenuItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MENUS_KEY, JSON.stringify(menus));
}

export function incrementMenuClick(id: string, sessionId: string) {
  const menus = getStoredMenus();
  const menuIndex = menus.findIndex(m => m.id === id);
  if (menuIndex === -1 || !menus[menuIndex].trackClicks) return;

  const updatedMenus = [...menus];
  const menu = { ...updatedMenus[menuIndex] };

  // 1. Always increment total click count
  menu.clickCount = (menu.clickCount || 0) + 1;

  // 2. Increment session click count only if this session hasn't clicked this menu yet
  const clickHistoryJson = localStorage.getItem(CLICK_LOG_KEY);
  const clickHistory: Record<string, string[]> = clickHistoryJson ? JSON.parse(clickHistoryJson) : {};

  if (!clickHistory[id]) {
    clickHistory[id] = [];
  }

  if (!clickHistory[id].includes(sessionId)) {
    clickHistory[id].push(sessionId);
    menu.sessionClickCount = (menu.sessionClickCount || 0) + 1;
    localStorage.setItem(CLICK_LOG_KEY, JSON.stringify(clickHistory));
  }

  updatedMenus[menuIndex] = menu;
  saveMenus(updatedMenus);
}

// Settings Store
export const defaultReportIdConfig: ReportIdConfig = {
  prefix: 'NIB',
  yearEnabled: true,
  numberLength: 6,
  startValue: 100000,
  resetEveryYear: true
};

export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return {
    supportedLanguages: defaultLanguages,
    systemTranslations: defaultSystemTranslations,
    reportId: defaultReportIdConfig
  };
  const stored = localStorage.getItem(SETTINGS_KEY);
  const settings: AppSettings = stored ? JSON.parse(stored) : {
    supportedLanguages: defaultLanguages,
    systemTranslations: defaultSystemTranslations,
    reportId: defaultReportIdConfig
  };

  // Ensure systemTranslations exists and has default keys
  if (!settings.systemTranslations) {
    settings.systemTranslations = defaultSystemTranslations;
  } else {
    // Fill in missing default keys if any
    Object.keys(defaultSystemTranslations).forEach(key => {
      if (!settings.systemTranslations![key]) {
        settings.systemTranslations![key] = defaultSystemTranslations[key];
      }
    });
  }

  // Ensure reportId configuration exists
  if (!settings.reportId) {
    settings.reportId = defaultReportIdConfig;
  }

  return settings;
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Report Store (LocalStorage instead of Firestore)
export function getStoredReports(): UserReport[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(REPORTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveReports(reports: UserReport[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function addReport(reportData: Omit<UserReport, 'id' | 'status' | 'timestamp'>): UserReport {
  const reports = getStoredReports();
  const settings = getAppSettings();
  const config = settings.reportId || defaultReportIdConfig;

  const nextSequence = getNextSequence(config, reports);
  const newId = generateReportId(config, nextSequence);

  // Ensure uniqueness (safety check)
  let finalId = newId;
  let counter = 1;
  while (reports.some(r => r.id === finalId)) {
    finalId = `${newId}_${counter}`;
    counter++;
  }

  const newReport: UserReport = {
    ...reportData,
    id: finalId,
    status: 'pending',
    priority: reportData.priority || 'medium',
    timestamp: new Date().toISOString()
  };
  saveReports([newReport, ...reports]);
  return newReport;
}

export function updateReportStatus(id: string, status: UserReport['status']) {
  const reports = getStoredReports();
  const updated = reports.map(r => r.id === id ? { ...r, status } : r);
  saveReports(updated);
}

export function updateReportPriority(id: string, priority: ReportPriority) {
  const reports = getStoredReports();
  const updated = reports.map(r => r.id === id ? { ...r, priority } : r);
  saveReports(updated);
}

export function updateReportAdminResponse(id: string, adminResponse: string) {
  const reports = getStoredReports();
  const updated = reports.map(r => r.id === id ? { ...r, adminResponse } : r);
  saveReports(updated);
}

export function updateReportInternalNotes(id: string, internalNotes: string) {
  const reports = getStoredReports();
  const updated = reports.map(r => r.id === id ? { ...r, internalNotes } : r);
  saveReports(updated);
}

export function deleteReport(id: string) {
  const reports = getStoredReports();
  const filtered = reports.filter(r => r.id !== id);
  saveReports(filtered);
}

// Menu Actions
export function addMenu(menu: Omit<MenuItem, 'id'>): MenuItem {
  const menus = getStoredMenus();
  const newItem = {
    ...menu,
    id: Math.random().toString(36).substr(2, 9),
    attachedMenuIds: [],
    trackClicks: false,
    clickCount: 0,
    sessionClickCount: 0
  } as MenuItem;
  saveMenus([...menus, newItem]);
  return newItem;
}

export function updateMenu(id: string, updates: Partial<MenuItem>) {
  const menus = getStoredMenus();
  const updated = menus.map(m => m.id === id ? { ...m, ...updates } : m);
  saveMenus(updated);
}

export function deleteMenu(id: string) {
  const menus = getStoredMenus();
  const toDelete = new Set([id]);
  let size = 0;
  while (toDelete.size > size) {
    size = toDelete.size;
    menus.forEach(m => {
      if (m.parentId && toDelete.has(m.parentId)) {
        toDelete.add(m.id);
      }
    });
  }
  const filtered = menus.filter(m => !toDelete.has(m.id));
  saveMenus(filtered);
}

