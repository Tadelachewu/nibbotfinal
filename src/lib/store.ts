
'use client';

import { MenuItem } from './types';

const STORAGE_KEY = 'talktree_menus';

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
      requestMapping: {},
      responseMapping: {
        type: 'table',
        template: 'Here are the current rates:',
        tableDataKey: 'rates',
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
    id: 'balance-check', 
    parentId: null, 
    name: 'Check Balance', 
    nameAm: 'ሒሳብ ማረጋገጥ',
    responseType: 'api',
    order: 2,
    apiConfig: {
      name: 'Account Balance',
      endpoint: '/api/test/balance',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 0,
      loginRequired: true,
      requiredKYC: [],
      kycFields: [
        {
          id: 'kyc-acc-id',
          name: 'account_id',
          prompt: 'Please enter your account ID (Test IDs: 88991122, 11223344, 99887766)',
          promptAm: 'እባክዎን የሂሳብ መለያዎን ያስገቡ (88991122, 11223344, 99887766 ይሞክሩ)',
          type: 'text',
          order: 0
        }
      ],
      requestMapping: {
        'account_id': 'kyc.account_id'
      },
      responseMapping: {
        type: 'message',
        template: 'Your current balance is {{response.data.balance}} {{response.data.currency}}. Account Type: {{response.data.account_type}}.',
        errorFallback: 'Failed to retrieve balance. Account not found.',
        timeoutMessage: 'Server timed out.',
        authRequiredMessage: 'Please log in to view your balance.'
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
