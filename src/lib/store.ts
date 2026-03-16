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
    id: '2', 
    parentId: null, 
    name: 'Check Balance', 
    nameAm: 'ሂሳብ ይፈትሹ',
    responseType: 'api',
    order: 1,
    apiConfig: {
      name: 'Balance Inquiry',
      endpoint: 'https://api.example.com/v1/balance',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      retry: 1,
      loginRequired: true,
      requiredKYC: ['phone', 'id_number'],
      kycFields: [
        {
          id: 'phone',
          name: 'phone',
          prompt: 'Please enter your phone number.',
          promptAm: 'እባክዎን ስልክ ቁጥርዎን ያስገቡ።',
          type: 'tel',
          order: 1
        },
        {
          id: 'id_number',
          name: 'id_number',
          prompt: 'Please enter your ID number.',
          promptAm: 'እባክዎን የመታወቂያ ቁጥርዎን ያስገቡ።',
          type: 'text',
          order: 2
        }
      ],
      requestMapping: {
        'msisdn': 'user.phone',
        'national_id': 'user.kyc.id_number'
      },
      responseMapping: {
        type: 'message',
        template: 'Your current balance is {{response.balance}} {{response.currency}}.',
        errorFallback: 'We could not retrieve your balance at this time.',
        timeoutMessage: 'The request timed out. Please try again.',
        authRequiredMessage: 'Please log in to check your balance.'
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
