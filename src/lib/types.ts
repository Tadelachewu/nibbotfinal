export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  content?: string;
  nameAm?: string;
  contentAm?: string;
  order: number;
}

export interface AppState {
  menus: MenuItem[];
}
