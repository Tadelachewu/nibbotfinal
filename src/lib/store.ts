'use client';

import { MenuItem } from './types';

const STORAGE_KEY = 'talktree_menus';

const defaultMenus: MenuItem[] = [
  { 
    id: '1', 
    parentId: null, 
    name: 'Our Services', 
    nameAm: 'የእኛ አገልግሎቶች',
    order: 0, 
    content: '<p>Explore what we can do for you.</p>',
    contentAm: '<p>ለእርስዎ ምን ማድረግ እንደምንችል ይመርምሩ።</p>',
    attachedMenuIds: ['3', '4']
  },
  { 
    id: '2', 
    parentId: null, 
    name: 'Contact Us', 
    nameAm: 'ያግኙን',
    content: '<p>You can reach us at <strong>support@talktree.com</strong></p>', 
    contentAm: '<p>በ <strong>support@talktree.com</strong> ሊያገኙን ይችላሉ።</p>',
    order: 1 
  },
  { 
    id: '3', 
    parentId: '1', 
    name: 'Web Development', 
    nameAm: 'የዌብ ልማት',
    content: '<h2>Web Development</h2><p>We build responsive and high-performance websites.</p>', 
    contentAm: '<h2>የዌብ ልማት</h2><p>ምላሽ ሰጪ እና ከፍተኛ አፈጻጸም ያላቸውን ድረ-ገጾች እንገነባለን።</p>',
    order: 0 
  },
  { 
    id: '4', 
    parentId: '1', 
    name: 'Mobile Apps', 
    nameAm: 'የሞባይል መተግበሪያዎች',
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
  const newItem = { ...menu, id: Math.random().toString(36).substr(2, 9), attachedMenuIds: [] };
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
