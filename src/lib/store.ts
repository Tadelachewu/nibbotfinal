'use client';

import { MenuItem, AppSettings, Language, UserReport, ReportPriority } from './types';

const MENUS_KEY = 'talktree_menus';
const SETTINGS_KEY = 'talktree_settings';
const REPORTS_KEY = 'talktree_reports';

const defaultLanguages: Language[] = [
  { code: 'en', name: 'English', isDefault: true },
  { code: 'am', name: 'Amharic' }
];

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
    attachedMenuIds: ['ex-rate', 'path-param-test', 'fraud-report-test']
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
    apiConfig: {
      name: 'Fraud Report Collection',
      endpoint: '', 
      method: 'POST',
      headers: {},
      timeout: 0,
      retry: 0,
      loginRequired: true,
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
        errorFallback: 'Report submission failed.'
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
    apiConfig: {
      name: 'Daily Exchange Rates',
      endpoint: '/api/test/exchange-rate',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 1,
      loginRequired: false,
      kycFields: [],
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
    apiConfig: {
      name: 'Dynamic Path Parameter Lookup',
      endpoint: '/api/test/profile/{{account_id}}',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 0,
      loginRequired: true,
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

// Settings Store
export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return { supportedLanguages: defaultLanguages };
  const stored = localStorage.getItem(SETTINGS_KEY);
  return stored ? JSON.parse(stored) : { supportedLanguages: defaultLanguages };
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
  const newReport: UserReport = {
    ...reportData,
    id: 'rep_' + Math.random().toString(36).substr(2, 9),
    status: 'pending',
    priority: 'medium',
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
  const newItem = { ...menu, id: Math.random().toString(36).substr(2, 9), attachedMenuIds: [] } as MenuItem;
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
