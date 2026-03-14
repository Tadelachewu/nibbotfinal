export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  content?: string;
  order: number;
}

export interface AppState {
  menus: MenuItem[];
}
