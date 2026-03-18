'use client';

import { MenuItem, AppSettings, Language } from './types';

const STORAGE_KEY = 'talktree_menus';
const SETTINGS_KEY = 'talktree_settings';

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
    attachedMenuIds: ['ex-rate', 'path-param-test']
  },
  { 
    id: 'ex-rate', 
    parentId: null, 
    name: 'Exchange Rates', 
    nameAm: 'የምንዛሬ ተመኖች',
    responseType: 'api',
    order: 1,
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
        errorFallback: 'Could not retrieve exchange rates. Ensure "base" parameter is mapped.',
        timeoutMessage: 'Request timed out.',
        authRequiredMessage: 'Login required.'
      }
    }
  },
  {
    id: 'path-param-test',
    parentId: null,
    name: 'Profile Lookup (Path Param)',
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
          order: 0
        }
      ],
      requestParameters: [],
      responseMapping: {
        type: 'message',
        template: 'Found Profile: {{response.data.full_name}} (Email: {{response.data.email}}). Status: {{response.data.kyc_status}}.',
        templateAm: 'መገለጫ ተገኝቷል: {{response.data.full_name}} (ኢሜል: {{response.data.email}})',
        errorFallback: 'Profile not found. Please check the ID and try again.',
        timeoutMessage: 'Timeout.',
        authRequiredMessage: 'Auth Required.'
      }
    }
  },
  {
    id: 'multi-param-test',
    parentId: null,
    name: 'Transactions (Multi-Param)',
    nameAm: 'ግብይቶች',
    responseType: 'api',
    order: 4,
    apiConfig: {
      name: 'Multi-Parameter API',
      endpoint: '/api/test/transactions',
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
          id: 'kyc-hist-acc',
          name: 'account_id',
          prompt: 'Enter Account ID for history lookup (try: 88991122)',
          promptAm: 'ለግብይት ታሪክ የሂሳብ ቁጥርዎን ያስገቡ',
          type: 'text',
          order: 0
        }
      ],
      requestParameters: [
        { apiKey: 'account_id', sourceType: 'kyc', sourceValue: 'account_id' },
        { apiKey: 'limit', sourceType: 'static', sourceValue: '3' }
      ],
      responseMapping: {
        type: 'table',
        template: 'Recent transactions for {{response.meta.account_id}}:',
        tableColumns: [
          { header: 'Date', headerAm: 'ቀን', key: 'date' },
          { header: 'Type', headerAm: 'ዓይነት', key: 'type' },
          { header: 'Amount', headerAm: 'መጠን', key: 'amount' },
          { header: 'Status', headerAm: 'ሁኔታ', key: 'status' }
        ],
        errorFallback: 'Could not fetch history.',
        timeoutMessage: 'Timeout.',
        authRequiredMessage: 'Auth Required.'
      }
    }
  },
  {
    id: 'secure-multi-kyc',
    parentId: null,
    name: 'Secure Account Access',
    nameAm: 'ደህንነቱ የተጠበቀ መዳረሻ',
    responseType: 'api',
    order: 5,
    apiConfig: {
      name: 'Multi-KYC Header Construction',
      endpoint: '/api/test/multi-kyc',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      retry: 0,
      loginRequired: true,
      authConfig: {
        type: 'bearer',
        bearer: { header: 'Authorization', template: 'Bearer {{user_token}}.{{account}}.{{code}}' }
      },
      kycFields: [
        {
          id: 'kyc-secure-acc',
          name: 'account',
          prompt: 'Enter Account Number (try: 12345)',
          promptAm: 'የሂሳብ ቁጥርዎን ያስገቡ (ለምሳሌ: 12345)',
          type: 'text',
          order: 0
        },
        {
          id: 'kyc-secure-code',
          name: 'code',
          prompt: 'Enter Verification Code (try: 9988)',
          promptAm: 'የማረጋገጫ ኮድዎን ያስገቡ (ለምሳሌ: 9988)',
          type: 'password',
          order: 1
        }
      ],
      requestParameters: [],
      responseMapping: {
        type: 'message',
        template: 'Access Granted! Balance: {{response.data.current_balance}}. Status: {{response.data.account_status}}.',
        templateAm: 'መዳረሻ ተፈቅዷል! ቀሪ ሂሳብ: {{response.data.current_balance}}',
        errorFallback: 'Security check failed. Please verify your account and code.',
        timeoutMessage: 'Security Gateway timeout.',
        authRequiredMessage: 'Secure Auth Required.'
      }
    }
  }
];

export function getStoredMenus(): MenuItem[] {
  if (typeof window === 'undefined') return defaultMenus;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultMenus;
}

export function saveMenus(menus: MenuItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
}

export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return { supportedLanguages: defaultLanguages };
  const stored = localStorage.getItem(SETTINGS_KEY);
  return stored ? JSON.parse(stored) : { supportedLanguages: defaultLanguages };
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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
