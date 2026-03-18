export type KYCFieldType = 'text' | 'number' | 'tel' | 'select' | 'password';

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

export type AuthType = 'none' | 'apiKey' | 'basic' | 'bearer';

export interface ApiConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  authConfig?: {
    type: AuthType;
    apiKey?: { header: string; value: string };
    basicAuth?: { 
      header?: string;
      user?: string; 
      pass?: string;
    };
    bearer?: { 
      header?: string;
      template: string; 
    };
  };
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

export interface Language {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface AppSettings {
  supportedLanguages: Language[];
}

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  nameAm?: string;
  responseType: 'static' | 'api' | 'report';
  content?: string; // For static or report success
  contentAm?: string; // For static or report success
  apiConfig?: ApiConfig; // For API or Report fields
  order: number;
  attachedMenuIds?: string[];
  translations?: Record<string, {
    name?: string;
    content?: string;
    responseTemplate?: string;
    errorFallback?: string;
    tableHeaders?: Record<string, string>; // Map of column key -> translated header
  }>;
}

export interface AppState {
  menus: MenuItem[];
}
