export type KYCFieldType = 'text' | 'number' | 'tel' | 'email' | 'password' | 'boolean';

export interface KYCField {
  id: string;
  name: string;
  prompt: string;
  promptAm?: string;
  type: KYCFieldType;
  validation?: string;
  order: number;
  required: boolean;
  showToUser?: boolean;
}

export interface TableColumn {
  header: string;
  headerAm?: string;
  key: string; // The property name in the array item, e.g., "id" or "amount"
}

export interface RequestParameter {
  apiKey: string;
  sourceType: 'kyc' | 'static' | 'user_profile' | 'admin_default';
  sourceValue: string; // The ID/Name of the KYC field or a static value
  isEnabled?: boolean; // Toggle to enable/disable this parameter mapping
  isUserConfigurable?: boolean; // Whether user can override the default value
}

export type AuthType = 'none' | 'apiKey' | 'basic' | 'bearer';

export interface ApiConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  rootKey?: string; // The explicit root key for mapping (e.g., "data")
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
  defaultPriority?: ReportPriority; // Added field for default priority
  responseMapping: {
    type: 'message' | 'table' | 'buttons' | 'trigger';
    template: string; // Handlebars-style template for message type
    templateAm?: string;
    tableDataKey?: string; // Path to the array in the response, e.g., "response.items"
    tableIntro?: string;   // Separate intro message specifically for tables
    tableIntroAm?: string;
    tableMappingMode?: 'array_path' | 'exact_path'; // Option to explicitly define paths
    tableColumns?: TableColumn[];
    errorFallback: string;
    errorFallbackAm?: string;
    timeoutMessage: string;
    timeoutMessageAm?: string;
    authRequiredMessage: string;
    authRequiredMessageAm?: string;
    hideReportId?: boolean;
  };
}

export interface Language {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface ReportIdConfig {
  prefix: string;
  yearEnabled: boolean;
  numberLength: number;
  startValue: number;
  resetEveryYear: boolean;
}

export interface AppSettings {
  supportedLanguages: Language[];
  systemTranslations?: Record<string, Record<string, string>>; // key -> langCode -> translation
  reportId?: ReportIdConfig;
  botAvatarType?: 'text' | 'image';
  botAvatarText?: string;
  botAvatarImage?: string;
  userAvatarType?: 'text' | 'image';
  userAvatarText?: string;
  userAvatarImage?: string;
  appLogo?: string;
  showAdminPanelIcon?: boolean;
  aiEnabled?: boolean;
  liveAgentEnabled?: boolean;
  liveAgentBubbleEnabled?: boolean;
}

export type MenuApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AdminRole = 'admin' | 'checker' | 'support';

export type MenuUpdatePayload = {
  parentId?: string | null;
  name?: string;
  nameAm?: string | null;
  responseType?: 'static' | 'api' | 'report';
  content?: string | null;
  contentAm?: string | null;
  apiConfig?: ApiConfig | null;
  supportAssignee?: string | null;
  order?: number;
  isActive?: boolean;
  trackClicks?: boolean;
  kbEnabled?: boolean;
  translations?: MenuItem['translations'] | null;
  attachedMenuIds?: string[] | null;
};

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  nameAm?: string;
  responseType: 'static' | 'api' | 'report';
  content?: string; // For static or report success
  contentAm?: string; // For static or report success
  apiConfig?: ApiConfig; // For API or Report fields
  supportAssignee?: string | null;
  order: number;
  isActive?: boolean;
  approvalStatus?: MenuApprovalStatus;
  createdBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  pendingUpdate?: MenuUpdatePayload;
  pendingStatus?: MenuApprovalStatus;
  pendingCreatedBy?: string;
  pendingReviewedBy?: string;
  pendingReviewedAt?: string;
  pendingRejectionReason?: string;
  attachedMenuIds?: string[];
  trackClicks?: boolean;
  kbEnabled?: boolean;
  clickCount?: number;
  sessionClickCount?: number; // Unique sessions that clicked this
  translations?: Record<string, {
    name?: string;
    content?: string;
    responseTemplate?: string;
    tableIntro?: string;
    errorFallback?: string;
    tableHeaders?: Record<string, string>; // Map of column key -> translated header
  }>;
  attachmentDescription?: string;
}

export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface UserReport {
  id: string;
  userId: string;
  menuId?: string;
  menuName: string;
  data: Record<string, any>;
  status: 'pending' | 'reviewed' | 'resolved';
  priority?: ReportPriority;
  adminResponse?: string;
  internalNotes?: string;
  supportAssignee?: string;
  supportAssignmentType?: 'first_assignment' | 'escalation';
  supportAssignmentReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  assignmentHistory?: Array<{
    assignee: string;
    assignedBy: string;
    assignedAt: string;
    type: 'first_assignment' | 'escalation';
    reason?: string;
  }>;
  serviceRating?: number;
  serviceFeedback?: string;
  serviceRatedAt?: string;
  serviceRatedSupportAssignee?: string;
  timestamp: string;
}

export interface AppState {
  menus: MenuItem[];
}
