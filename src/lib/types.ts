export type KYCFieldType = 'text' | 'number' | 'tel' | 'select';

export interface KYCField {
  id: string;
  name: string;
  prompt: string;
  promptAm?: string;
  type: KYCFieldType;
  validation?: string;
  order: number;
}

export interface TableColumn {
  header: string;
  headerAm?: string;
  key: string; // The property name in the array item, e.g., "id" or "amount"
}

export interface RequestParameter {
  apiKey: string;
  sourceType: 'kyc' | 'static' | 'user_profile';
  sourceValue: string; // The ID/Name of the KYC field or a static value
}

export interface ApiConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  timeout: number;
  retry: number;
  loginRequired: boolean;
  requiredKYC: string[]; // IDs of KYC fields
  kycFields: KYCField[];
  requestParameters: RequestParameter[]; // Mapping for the API request
  responseMapping: {
    type: 'message' | 'table' | 'buttons' | 'trigger';
    template: string; // Handlebars-style template for message type
    templateAm?: string;
    tableDataKey?: string; // Path to the array in the response, e.g., "response.items"
    tableColumns?: TableColumn[];
    errorFallback: string;
    errorFallbackAm?: string;
    timeoutMessage: string;
    timeoutMessageAm?: string;
    authRequiredMessage: string;
    authRequiredMessageAm?: string;
  };
}

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  nameAm?: string;
  responseType: 'static' | 'api';
  content?: string; // For static
  contentAm?: string; // For static
  apiConfig?: ApiConfig; // For API
  order: number;
  attachedMenuIds?: string[];
}

export interface AppState {
  menus: MenuItem[];
}
