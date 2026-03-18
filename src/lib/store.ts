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
    attachedMenuIds: ['3', '4']
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
      requiredKYC: [],
      kycFields: [],
      requestParameters: [],
      responseMapping: {
        type: 'table',
        template: 'Here are the current rates:',
        tableColumns: [
          { header: 'Currency', headerAm: 'ምንዛሬ', key: 'currency' },
          { header: 'Rate (vs USD)', headerAm: 'ተመን', key: 'rate' },
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
    name: 'Account Balance (Path Param)',
    nameAm: 'የሂሳብ ቀሪ ሂሳብ',
    responseType: 'api',
    order: 3,
    apiConfig: {
      name: 'KYC-Sourced Path Parameter',
      endpoint: '/api/test/balance?account_id={{account_id}}',
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
          id: 'kyc-balance-id',
          name: 'account_id',
          prompt: 'Please enter your Account ID (e.g. 88991122)',
          promptAm: 'እባክዎ የሂሳብ ቁጥርዎን ያስገቡ',
          type: 'text',
          order: 0
        }
      ],
      requestParameters: [],
      responseMapping: {
        type: 'message',
        template: 'Balance for {{response.data.account_id}}: {{response.data.balance}} {{response.data.currency}} ({{response.data.account_type}})',
        templateAm: 'ለሂሳብ ቁጥር {{response.data.account_id}} ያለው ቀሪ ሂሳብ: {{response.data.balance}} {{response.data.currency}}',
        errorFallback: 'Could not retrieve balance details.',
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
          prompt: 'Enter Account ID for history lookup (e.g. 88991122)',
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
    id: '3', 
    parentId: '1', 
    name: 'Web Development', 
    nameAm: 'የዌብ ልማት',
    responseType: 'static',
    content: '<h2>Web Development</h2><p>We build responsive and high-performance websites.</p>', 
    contentAm: '<h2>የዌብ ልማት</h2><p>ምላሽ ሰጪ እና ከፍተኛ አፈጻጸም ያላቸውን ድረ-ገጾች እንገነባለን።</p>',
    order: 0 
  },
  { 
    id: '4', 
    parentId: '1', 
    name: 'Mobile Apps', 
    nameAm: 'የሞባይል መተግበሪያዎች',
    responseType: 'static',
    content: '<h2>Mobile Apps</h2><p>Native and cross-platform mobile experiences.</p>', 
    contentAm: '<h2>የሞባይል መተግበሪያዎች</h2><p>ተወላጅ እና የመስቀል-ፕላትፎርም የሞባይል ተሞክሮዎች።</p>',
    order: 1 
  },
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
