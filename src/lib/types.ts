export type MenuType = 'folder' | 'content';

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  type: MenuType;
  content?: string;
  order: number;
}

export interface AppState {
  menus: MenuItem[];
}
