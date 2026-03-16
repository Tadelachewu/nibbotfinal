export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  content?: string;
  nameAm?: string;
  contentAm?: string;
  order: number;
  attachedMenuIds?: string[]; // IDs of menus to show as sub-options
}

export interface AppState {
  menus: MenuItem[];
}
