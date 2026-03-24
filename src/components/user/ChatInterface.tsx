'use client';

import { io } from 'socket.io-client';
import { useConnectivity } from '@/hooks/useConnectivity';

import { useState, useEffect, useRef } from 'react';
import { MenuItem, KYCField, TableColumn, Language, UserReport, KYCFieldType } from '@/lib/types';
import { getStoredMenus, getAppSettings, addReport, getStoredReports, incrementMenuClick } from '@/lib/store';
import { saveLogEntry } from '@/lib/logger';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { 
  ChevronRight, 
  Home as HomeIcon, 
  ChevronLeft,
  Globe, 
  Send, 
  Loader2, 
  ClipboardCheck, 
  CornerDownRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User as UserIcon,
  Check
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  content?: string;
  options?: MenuItem[];
  relatedOptions?: MenuItem[];
  isKYC?: boolean;
  tableData?: {
    columns: (TableColumn & { localizedHeader: string })[];
    rows: any[];
    rootData: any;
    arrayPath: string;
  };
  reportStatus?: UserReport;
}

interface UserData {
  id: string;
  token: string;
  isLoggedIn: boolean;
  kyc: Record<string, any>;
}

export function ChatInterface() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentMenuId, setCurrentMenuId] = useState<string | null>(null);
  const [menuHistory, setMenuHistory] = useState<string[]>([]);
  const [currentLang, setCurrentLang] = useState<Language | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  
  const [userData, setUserData] = useState<UserData>({
    id: 'anonymous',
    token: 'nib_static_token_778899',
    isLoggedIn: false,
    kyc: {}
  });
  
  const [kycFlow, setKycFlow] = useState<{
    active: boolean;
    menuId: string;
    fieldIndex: number;
    fields: KYCField[];
  } | null>(null);

  const [statusFlow, setStatusFlow] = useState<boolean>(false);
  const [kycInput, setKycInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading, kycFlow, statusFlow]);

  useEffect(() => {
    const STORAGE_KEY = 'nib_user_session';
    let sessionId = '';
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        sessionId = stored;
      } else {
        sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEY, sessionId);
      }
    }

    setUserData(prev => ({ ...prev, id: sessionId }));

    const settings = getAppSettings();
    setLanguages(settings.supportedLanguages);
    const defaultLang = settings.supportedLanguages.find(l => l.isDefault) || settings.supportedLanguages[0];
    setCurrentLang(defaultLang);
    
    const data = getStoredMenus();
    setMenus(data);
    
    setHistory([{ id: 'welcome', sender: 'bot', options: data.filter(m => m.parentId === null) }]);
    
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const t = (key: string, fallback: string) => {
    const settings = getAppSettings();
    const langCode = currentLang?.code || 'en';
    return settings.systemTranslations?.[key]?.[langCode] || fallback;
  };

  // Socket.io Real-Time Presence Heartbeat Engine
  useEffect(() => {
    if (!userData.id || typeof window === 'undefined') return;
    
    // Connects to the same origin server mapping the Custom Socket
    const socket = io({ path: '/socket.io' }); 
    
    // Initial announce
    socket.emit('user_active', { sessionId: userData.id });
    
    // Keep-alive heartbeat loop
    const pingInterval = setInterval(() => {
      socket.emit('user_active', { sessionId: userData.id });
    }, 15000);
    
    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [userData.id]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const getLocalizedName = (menu: MenuItem) => {
    if (!currentLang) return menu.name;
    if (currentLang.isDefault) return menu.name;
    if (currentLang.code === 'am' && menu.nameAm) return menu.nameAm;
    return menu.translations?.[currentLang.code]?.name || menu.name;
  };

  const getLocalizedContent = (menu: MenuItem) => {
    if (!currentLang) return menu.content || '';
    if (currentLang.isDefault) return menu.content || '';
    if (currentLang.code === 'am' && menu.contentAm) return menu.contentAm;
    return menu.translations?.[currentLang.code]?.content || menu.content || '';
  };

  const getLocalizedKYCPrompt = (field: KYCField) => {
    return (currentLang?.code === 'am' ? field.promptAm : field.prompt) || field.prompt;
  };

  const getLocalizedTableHeader = (menu: MenuItem, col: TableColumn) => {
    if (!currentLang) return col.header;
    if (currentLang.isDefault) return col.header;
    const translation = menu.translations?.[currentLang.code]?.tableHeaders?.[col.key];
    if (translation) return translation;
    if (currentLang.code === 'am' && col.headerAm) return col.headerAm;
    return col.header;
  };
  
  const getLocalizedTemplate = (menu: MenuItem) => {
    if (!menu.apiConfig) return "";
    const mapping = menu.apiConfig.responseMapping;
    if (currentLang?.isDefault) return mapping.template || "";
    const translation = menu.translations?.[currentLang?.code || 'en']?.responseTemplate;
    if (translation) return translation;
    if (currentLang?.code === 'am' && mapping.templateAm) return mapping.templateAm;
    return mapping.template || "";
  };

  const getLocalizedTableIntro = (menu: MenuItem) => {
    if (!menu.apiConfig) return "";
    const mapping = menu.apiConfig.responseMapping;
    if (currentLang?.isDefault) return mapping.tableIntro || "";
    const translation = menu.translations?.[currentLang?.code || 'en']?.tableIntro;
    if (translation) return translation;
    if (currentLang?.code === 'am' && mapping.tableIntroAm) return mapping.tableIntroAm;
    return mapping.tableIntro || "";
  };

  const getLocalizedErrorFallback = (menu: MenuItem) => {
    if (!menu.apiConfig) return "";
    const mapping = menu.apiConfig.responseMapping; 
    if (!currentLang) return mapping.errorFallback || "";
    if (currentLang.isDefault) return mapping.errorFallback || "";
    const translation = menu.translations?.[currentLang.code]?.errorFallback;
    if (translation) return translation;
    if (currentLang.code === 'am' && mapping.errorFallbackAm) return mapping.errorFallbackAm;
    return mapping.errorFallback || "";
  };

  const getVal = (path: string, obj: any, rootKey: string = 'data') => {
    if (!path || !obj) return undefined;
    // Strip root prefix
    let cleanPath = path;
    if (path.startsWith(rootKey + '.')) {
      cleanPath = path.substring(rootKey.length + 1);
    } else if (path.startsWith('data.')) {
      cleanPath = path.substring(5);
    } else if (path === rootKey || path === 'data') {
      return obj;
    }
    
    const normalizedPath = cleanPath.replace(/\[(\w+)\]/g, '.$1');

    const value = normalizedPath.split('.').filter(Boolean).reduce((acc, part) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[part];
    }, obj);
    return value;
  };

  const replacePlaceholders = (template: string, context: any) => {
    if (!template) return '';
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
      const path = key.trim();
      
      // 1. Try unified path resolution from context
      const value = path.split('.').reduce((obj: any, k: string) => obj?.[k], context);
      if (value !== undefined && value !== null) return String(value);
      
      // 2. Fallback for non-prefixed KYC fields
      if (context.kyc && context.kyc[path] !== undefined && context.kyc[path] !== null) {
        return String(context.kyc[path]);
      }

      // 3. Fallback for system variables
      if (path === 'user_id') return String(userData.id);
      if (path === 'user_token') return String(userData.token);
      
      return match;
    });
  };

  const findArrayData = (obj: any, explicitPath?: string, rootKey: string = 'data'): { path: string; data: any[] } | null => {
    if (!obj || typeof obj !== 'object' || obj === null) return null;
    if (explicitPath) {
      const data = getVal(explicitPath, obj, rootKey);
      if (Array.isArray(data)) return { path: explicitPath, data };
    }
    if (Array.isArray(obj)) return { path: '', data: obj };
    for (const key in obj) { if (Array.isArray(obj[key])) return { path: key, data: obj[key] }; }
    if (obj.status === 'success' || obj.status === 'ok' || !obj.status) return { path: '', data: [obj] };
    return null;
  };

  const resolveTableCell = (key: string, row: any, root: any, arrayPath: string, rootKey: string = 'data') => {
    if (key.startsWith(rootKey + '.') || key.startsWith('data.')) {
      const val = getVal(key, root, rootKey);
      if (val !== undefined) return val;
    }
    const rowVal = getVal(key, row, rootKey);
    if (rowVal !== undefined) return rowVal;
    return undefined;
  };

  const validateInput = (value: string, type: KYCFieldType): { isValid: boolean, error?: string } => {
    if (!value.trim()) return { isValid: true };
    
    switch (type) {
      case 'boolean':
        // Only accept English true/false exactly
        const validTruths = ['true', 'false'];
        return {
          isValid: validTruths.includes(value.toLowerCase().trim()),
          error: currentLang?.code === 'am' ? 'እባክዎ "true" ወይም "false" ብቻ ያስገቡ' : 'Please enter "true" or "false" only'
        };
      case 'number':
        const cleanNum = value.replace(/,/g, ''); 
        return { 
          isValid: /^\d+(\.\d+)?$/.test(cleanNum) && !isNaN(Number(cleanNum)), 
          error: currentLang?.code === 'am' ? 'እባክዎ ቁጥር ብቻ ያስገቡ' : 'Please enter a valid number' 
        };
      case 'tel':
        // Strict Ethiopian phone validation: starts with +251 or 0, followed by 9 or 7, plus 8 digits.
        const ethioPhoneRegex = /^(\+251|0)[97]\d{8}$/;
        const stripped = value.replace(/[\s\-()]/g, '');
        return { 
          isValid: ethioPhoneRegex.test(stripped), 
          error: currentLang?.code === 'am' ? 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' : 'Please enter a valid Ethiopian phone number (e.g., 0911... or +251...)' 
        };
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return { 
          isValid: emailRegex.test(value), 
          error: currentLang?.code === 'am' ? 'እባክዎ ትክክለኛ ኢሜል ያስገቡ' : 'Please enter a valid email address' 
        };
      default:
        return { isValid: true };
    }
  };

  const handleUserInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycInput.trim()) return;
    if (statusFlow) {
      handleStatusLookup(kycInput);
      return;
    }
    if (kycFlow) {
      handleKycSubmit();
      return;
    }
  };

  const handleStatusLookup = (id: string) => {
    setHistory(prev => [...prev, { id: `user-lookup-${Date.now()}`, sender: 'user', text: id }]);
    const reports = getStoredReports();
    const found = reports.find(r => r.id === id);
    if (found) {
      setHistory(prev => [...prev, { 
        id: `bot-status-${Date.now()}`, 
        sender: 'bot', 
        text: currentLang?.code === 'am' ? `ሪፖርት ቁጥር ${id} ተገኝቷል` : `Report ${id} found:`,
        reportStatus: found
      }]);
    } else {
      setHistory(prev => [...prev, { 
        id: `bot-notfound-${Date.now()}`, 
        sender: 'bot', 
        text: currentLang?.code === 'am' ? `ይቅርታ፣ ሪፖርት ቁጥር ${id} ማግኘት አልቻልንም።` : `Sorry, we couldn't find a report with reference ${id}.`
      }]);
    }
    saveLogEntry({
      sessionId: userData.id,
      userMessage: id,
      botResponse: found ? (currentLang?.code === 'am' ? `ሪፖርት ቁጥር ${id} ተገኝቷል` : `Report ${id} found:`) : (currentLang?.code === 'am' ? `ይቅርታ፣ ሪፖርት ቁጥር ${id} ማግኘት አልቻልንም።` : `Sorry, we couldn't find a report with reference ${id}.`),
      status: found ? 'success' : 'failed',
      endpoint: 'Internal:StatusLookup',
      tags: ['status_lookup']
    });

    setKycInput('');
    setStatusFlow(false);
  };

  const handleKycSubmit = (skip: boolean = false) => {
    if (!kycFlow) return;
    const currentField = kycFlow.fields[kycFlow.fieldIndex];
    if (currentField.required && !skip && !kycInput.trim()) {
      toast({
        variant: "destructive",
        title: currentLang?.code === 'am' ? 'የግዴታ መስክ' : 'Required Field',
        description: currentLang?.code === 'am' ? 'እባክዎ ይህንን መረጃ ያስገቡ' : 'Please provide this information to continue.'
      });
      return;
    }
    if (!skip && kycInput.trim()) {
      const validation = validateInput(kycInput, currentField.type);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: currentLang?.code === 'am' ? 'ትክክል ያልሆነ ግብዓት' : 'Invalid Input',
          description: validation.error
        });
        return;
      }
    }
    const valueToSave = skip ? null : kycInput;
    const newKYC = { ...userData.kyc, [currentField.name]: valueToSave };
    setUserData(prev => ({ ...prev, kyc: newKYC }));
    const displayValue = skip 
      ? (currentLang?.code === 'am' ? '[ዘለል]' : '[Skipped]') 
      : (currentField.type === 'password' ? '********' : kycInput);
    setHistory(prev => [...prev, { id: `user-kyc-${Date.now()}`, sender: 'user', text: displayValue }]);
    setKycInput('');
    if (kycFlow.fieldIndex < kycFlow.fields.length - 1) {
      const nextField = kycFlow.fields[kycFlow.fieldIndex + 1];
      setHistory(prev => [...prev, { id: `bot-kyc-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(nextField), isKYC: true }]);
      setKycFlow({ ...kycFlow, fieldIndex: kycFlow.fieldIndex + 1 });
    } else {
      const menu = menus.find(m => m.id === kycFlow.menuId);
      setKycFlow(null);
      if (menu) {
        if (menu.responseType === 'report') {
          handleInternalReport(menu, newKYC);
        } else {
          executeApiCall(menu, newKYC);
        }
      }
    }
  };

  const handleInternalReport = (menu: MenuItem, kycData: Record<string, any>) => {
    setLoadingText(currentLang?.code === 'am' ? 'ሪፖርት እየላክን ነው...' : 'Submitting your report...');
    setIsLoading(true);
    setTimeout(() => {
      const reportPayload: Record<string, any> = {};
      menu.apiConfig?.kycFields?.forEach(field => {
        if (kycData[field.name] !== undefined) {
          reportPayload[field.name] = kycData[field.name];
        }
      });
      const savedReport = addReport({
        userId: userData.id,
        menuName: menu.name,
        data: reportPayload,
        priority: menu.apiConfig?.defaultPriority || 'medium'
      });
      const rootKey = menu.apiConfig?.rootKey || 'data';
      const hideId = menu.apiConfig?.responseMapping?.hideReportId;
      const responseContext = { 
        ...reportPayload,
        id: hideId ? '***' : savedReport.id,
        data: { id: hideId ? '***' : savedReport.id, ...reportPayload },
        response: { id: hideId ? '***' : savedReport.id, ...reportPayload }, 
        kyc: kycData, 
        rootKey 
      };
      const template = getLocalizedTemplate(menu);
      const finalMsg = template ? replacePlaceholders(template, responseContext) : "";
      const defaultSuccess = currentLang?.code === 'am' ? 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' : 'Your report has been submitted successfully. Thank you.';
      setHistory(prev => [...prev, {
        id: `bot-report-${Date.now()}`,
        sender: 'bot',
        text: finalMsg || defaultSuccess,
        options: menus.filter(m => m.parentId === menu.id)
      }]);
      saveLogEntry({
        sessionId: userData.id,
        userMessage: menu.name,
        botResponse: finalMsg || defaultSuccess,
        status: 'success',
        endpoint: 'Internal:Report',
        tags: ['report', menu.name]
      });

      setIsLoading(false);
    }, 600);
  };

  const executeApiCall = async (menu: MenuItem, kycData: Record<string, any>) => {
    if (!menu.apiConfig) return;
    const startTime = Date.now();
    const rootKey = menu.apiConfig.rootKey || 'data';
    setLoadingText(currentLang?.code === 'am' ? 'ደህንነቱ ከተጠበቀ አገልጋይ ጋር በመገናኘት ላይ...' : 'Connecting to secure server...');
    setIsLoading(true);
    let apiResponse: any;
    let success = false;
    const mapping = menu.apiConfig.responseMapping;
    try {
      let url = replacePlaceholders(menu.apiConfig.endpoint, { kyc: kycData, rootKey });
      const requestPayload: Record<string, any> = {};
      menu.apiConfig.requestParameters?.forEach(param => {
        const key = param.apiKey.trim();
        let val: any = null;

        if (param.sourceValue === 'user.id') val = userData.id;
        else if (param.sourceValue === 'user.token') val = userData.token;
        else if (param.sourceType === 'static') val = param.sourceValue;
        else if (kycData[param.sourceValue] !== undefined) val = kycData[param.sourceValue];

        // Smart Casting based on Field Type
        const fieldConfig = menu.apiConfig?.kycFields?.find(f => f.name === param.sourceValue);
        if (fieldConfig && typeof val === 'string') {
          if (fieldConfig.type === 'number') {
            const parsed = parseFloat(val.replace(/,/g, ''));
            if (!isNaN(parsed)) val = parsed;
          } else if (fieldConfig.type === 'boolean') {
            const low = val.toLowerCase().trim();
            val = (low === 'true' || low === 'አዎ');
          }
        }

        if (val !== null) requestPayload[key] = val;
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...menu.apiConfig.headers };
      const auth = menu.apiConfig.authConfig;
      if (auth && auth.type !== 'none') {
        const headerName = auth.apiKey?.header || auth.basicAuth?.header || auth.bearer?.header || 'Authorization';
        if (auth.type === 'apiKey' && auth.apiKey) { headers[headerName] = replacePlaceholders(auth.apiKey.value, { kyc: kycData, rootKey }); }
        else if (auth.type === 'basic' && auth.basicAuth) {
          const user = auth.basicAuth.user || '';
          const pass = auth.basicAuth.pass || '';
          headers[headerName] = `Basic ${btoa(`${user}:${pass}`)}`;
        } else if (auth.type === 'bearer' && auth.bearer) { headers[headerName] = replacePlaceholders(auth.bearer.template, { kyc: kycData, rootKey }); }
      }
      const options: RequestInit = { method: menu.apiConfig.method, headers };
      if (menu.apiConfig.method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(requestPayload).forEach(([k, v]) => {
          if (v !== null) params.append(k.trim(), String(v).trim());
        });
        if (params.toString()) url += (url.includes('?') ? '&' : '?') + params.toString();
      } else { options.body = JSON.stringify(requestPayload); }
      const res = await fetch(url, options);
      const data = await res.json().catch(() => null);
      success = res.ok && data?.status !== 'error';
      apiResponse = data;
    } catch (e) { success = false; }
    
    const context = { 
      ...apiResponse, 
      [rootKey]: apiResponse?.[rootKey] || apiResponse, 
      data: apiResponse?.data || apiResponse, // ensure 'data' is always a safe fallback
      kyc: kycData, 
      rootKey,
      response: apiResponse
    };
    let botMsg: Message = { id: `bot-api-${Date.now()}`, sender: 'bot' };
    
    if (!success) { 
      const errorMsg = apiResponse?.message || getLocalizedErrorFallback(menu);
      botMsg.text = errorMsg ? replacePlaceholders(errorMsg, context) : (currentLang?.code === 'am' ? 'ይቅርታ፣ ጥያቄዎን ለማካሄድ ስህተት ተከስቷል።' : 'Sorry, an error occurred while processing your request.');
    } else {
      const template = getLocalizedTemplate(menu);
      const mappingType = mapping.type || 'message';
      if (mappingType === 'message') {
        botMsg.text = template ? replacePlaceholders(template, context) : (currentLang?.code === 'am' ? 'ጥያቄዎ በተሳካ ሁኔታ ተከናውኗል።' : 'Your request was processed successfully.');
      } else if (mappingType === 'table') {
        const isExactPath = mapping.tableMappingMode === 'exact_path';
        let validData = false;
        let rows: any[] = [];
        let arrayPath = '';

        if (isExactPath) {
          validData = true;
          rows = [{}]; // Dummy single row for direct exact mapping from root
        } else {
          const foundArray = findArrayData(apiResponse, mapping.tableDataKey, rootKey);
          if (foundArray) {
            validData = true;
            rows = foundArray.data;
            arrayPath = foundArray.path;
          }
        }

        if (validData) {
          botMsg.tableData = { 
            columns: (mapping.tableColumns || []).map(col => ({ ...col, localizedHeader: getLocalizedTableHeader(menu, col) })), 
            rows, 
            rootData: apiResponse, 
            arrayPath 
          };
          const tableIntro = getLocalizedTableIntro(menu);
          botMsg.text = tableIntro ? replacePlaceholders(tableIntro, context) : (currentLang?.code === 'am' ? 'የተገኙ ውጤቶች የሚከተሉት ናቸው' : 'Here are the results:');
        } else { 
          const errorMsg = getLocalizedErrorFallback(menu);
          botMsg.text = errorMsg ? replacePlaceholders(errorMsg, context) : (currentLang?.code === 'am' ? 'ምንም መረጃ አልተገኘም።' : 'No data found.'); 
        }
      }
    }
    botMsg.options = menus.filter(m => m.parentId === menu.id);
    const endTime = Date.now();
    saveLogEntry({
      sessionId: userData.id,
      userMessage: kycData[menu.apiConfig?.kycFields?.[0]?.name || 'unknown'] || 'API Trigger',
      botResponse: botMsg.text || 'API Result',
      status: success ? 'success' : 'error',
      endpoint: menu.apiConfig?.endpoint || 'unknown',
      responseTime: endTime - startTime,
      errorDetails: !success ? (apiResponse?.message || 'Network/Server Error') : undefined,
      tags: ['api', menu.name]
    });

    setHistory(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const navigateTo = (menu: MenuItem) => {
    if (menu.trackClicks) {
      incrementMenuClick(menu.id, userData.id);
    }
    const childMenus = menus.filter(m => m.parentId === menu.id);
    const relatedItems = menus.filter(m => menu.attachedMenuIds?.includes(m.id));
    setHistory(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) }]);
    const isAction = (menu.responseType === 'api' || menu.responseType === 'report') && menu.apiConfig;
    const hasFields = menu.apiConfig?.kycFields?.length || 0;
    const rootKey = menu.apiConfig?.rootKey || 'data';

    if (isAction && (hasFields > 0 || childMenus.length === 0)) {
      const kycFields = menu.apiConfig?.kycFields || [];
      const missingFields = kycFields
        .filter(f => userData.kyc[f.name] === undefined)
        .sort((a, b) => a.order - b.order);
      
      const historyUpdates: Message[] = [];
      const rawIntro = getLocalizedContent(menu);
      const isDefault = rawIntro === '<p>Enter your response message here...</p>';
      const isEmptyText = rawIntro.replace(/<[^>]*>?/gm, '').trim() === '';
      const introContent = (isDefault || isEmptyText) ? null : rawIntro;

      if (introContent) {
        historyUpdates.push({ 
          id: `bot-intro-${Date.now()}`, 
          sender: 'bot', 
          content: replacePlaceholders(introContent, { rootKey }) 
        });
      }

      if (missingFields.length > 0) {
        historyUpdates.push({ 
          id: `bot-kyc-start-${Date.now()}`, 
          sender: 'bot', 
          text: getLocalizedKYCPrompt(missingFields[0]), 
          isKYC: true 
        });
        setKycFlow({ active: true, menuId: menu.id, fieldIndex: 0, fields: missingFields });
        setHistory(prev => [...prev, ...historyUpdates]);
        return;
      }
      
      if (historyUpdates.length > 0) {
        setHistory(prev => [...prev, ...historyUpdates]);
      }

      if (menu.responseType === 'report') {
        handleInternalReport(menu, userData.kyc);
      } else {
        executeApiCall(menu, userData.kyc);
      }
      return;
    }
    setMenuHistory(prev => [...prev, currentMenuId || 'root']);
    setHistory(prev => [...prev, {
      id: `bot-${Date.now()}`, 
      sender: 'bot', 
      content: replacePlaceholders(getLocalizedContent(menu), { rootKey }) || (childMenus.length > 0 ? t('ui_select_option', 'Please select an option:') : ''),
      options: childMenus.length > 0 ? childMenus : undefined,
      relatedOptions: relatedItems.length > 0 ? relatedItems : undefined,
    }]);

    saveLogEntry({
      sessionId: userData.id,
      userMessage: getLocalizedName(menu),
      botResponse: replacePlaceholders(getLocalizedContent(menu), { rootKey }) || 'Options',
      status: 'success',
      endpoint: 'Internal:MenuNavigation',
      tags: ['navigation', menu.name]
    });

    setCurrentMenuId(menu.id);
  };

  const handleBack = () => {
    if (menuHistory.length === 0) return;
    const previousId = menuHistory[menuHistory.length - 1];
    const newHistoryStack = menuHistory.slice(0, -1);
    
    setMenuHistory(newHistoryStack);
    
    if (previousId === 'root' || !previousId) {
      handleHome();
      return;
    }

    const previousMenu = menus.find(m => m.id === previousId);
    if (previousMenu) {
      setCurrentMenuId(previousId);
      const childMenus = menus.filter(m => m.parentId === previousId).sort((a, b) => a.order - b.order);
      setHistory(prev => [...prev, {
        id: `bot-back-${Date.now()}`,
        sender: 'bot',
        text: t('ui_back', 'Back'),
        content: getLocalizedContent(previousMenu),
        options: childMenus
      }]);
    }
  };

  const handleHome = () => {
    setMenuHistory([]);
    setCurrentMenuId(null);
    setHistory(prev => [...prev, {
      id: `bot-home-${Date.now()}`,
      sender: 'bot',
      text: t('ui_home', 'Home'),
      content: t('ui_welcome_subtitle', 'How can we assist you today?'),
      options: menus.filter(m => m.parentId === null).sort((a, b) => a.order - b.order)
    }]);
  };

  const startStatusFlow = () => {
    setStatusFlow(true);
    setHistory(prev => [...prev, { 
      id: `bot-status-prompt-${Date.now()}`, 
      sender: 'bot', 
      text: t('ui_enter_report_id', 'Please enter your Report Reference ID:') 
    }]);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'resolved': return { icon: <CheckCircle2 className="text-emerald-500" />, label: t('ui_status_resolved', 'Resolved'), color: 'bg-green-100 text-emerald-800' };
      case 'reviewed': return { icon: <Clock className="text-blue-500" />, label: t('ui_status_reviewed', 'Reviewed'), color: 'bg-blue-100 text-blue-800' };
      default: return { icon: <AlertCircle className="text-amber-500" />, label: t('ui_status_pending', 'Pending'), color: 'bg-amber-100 text-amber-800' };
    }
  };

  const getInputType = () => {
    if (statusFlow) return 'text';
    if (!kycFlow) return 'text';
    const fieldType = kycFlow.fields[kycFlow.fieldIndex].type;
    if (fieldType === 'tel') return 'tel';
    if (fieldType === 'number') return 'number';
    if (fieldType === 'email') return 'email';
    if (fieldType === 'password') return 'password';
    return 'text';
  };

  const connectivity = useConnectivity();

  return (
    <div className="flex flex-col h-full bg-white max-w-2xl mx-auto border-x shadow-2xl relative">
      {(currentMenuId || menuHistory.length > 0) && (
        <div className="absolute top-20 right-4 z-40 flex flex-col gap-2">
          <Button 
            onClick={handleHome} 
            size="sm" 
            variant="secondary" 
            className="rounded-full shadow-lg border bg-white/80 backdrop-blur-sm h-10 w-10 p-0 text-primary hover:bg-primary/10"
          >
            <HomeIcon size={18} />
          </Button>
          <Button 
            disabled={menuHistory.length === 0} 
            onClick={handleBack} 
            size="sm" 
            variant="secondary" 
            className="rounded-full shadow-lg border bg-white/80 backdrop-blur-sm h-10 w-10 p-0 text-[#763717] hover:bg-primary/10 disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </Button>
        </div>
      )}
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="font-bold text-lg text-[#763717]">Nib International Bank</h1>
            <div className="flex items-center gap-1.5">
              {connectivity === 'checking' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500">{t('ui_checking', 'Checking...')}</span>
                </>
              )}
              {connectivity === 'online' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">{t('ui_online', 'Online')}</span>
                </>
              )}
              {connectivity === 'offline' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-red-500">{t('ui_offline', 'Offline')}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9 p-0 hover:bg-primary/10">
                <Globe size={18} className="text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {languages.map(lang => (
                <DropdownMenuItem 
                  key={lang.code} 
                  onClick={() => setCurrentLang(lang)}
                  className={cn("flex items-center justify-between", currentLang?.code === lang.code && "bg-primary/10 text-primary")}
                >
                  {lang.name}
                  {currentLang?.code === lang.code && <CheckCircle2 size={12} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 p-0 border shadow-sm">
                <Avatar className="h-full w-full">
                  <AvatarImage src={userAvatar?.imageUrl || ""} />
                  <AvatarFallback className="bg-primary text-white"><UserIcon size={16} /></AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-xs font-bold">User Profile</span>
                <span className="text-[10px] text-muted-foreground font-mono">{userData.id}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startStatusFlow} className="flex items-center gap-2 cursor-pointer">
                <ClipboardCheck size={16} className="text-primary" />
                {t('ui_report_status_btn', 'Check Report Status')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <ScrollArea ref={scrollRef} className="flex-1 overflow-x-hidden p-4 md:p-6 space-y-4">
        <div className="flex flex-col min-h-full">
          {history.map(msg => (
            <ChatBubble key={msg.id} isBot={msg.sender === 'bot'}>
              {msg.id === 'welcome' && (
                <div className="flex flex-col items-center justify-center pt-4 pb-6 space-y-4">
                  <div className="w-28 h-28 rounded-full border-4 border-[#f4a61b] shadow-xl flex items-center justify-center bg-white p-1 overflow-hidden">
                    <Logo className="w-full h-full scale-110" />
                  </div>
                  <h2 className="text-xl font-extrabold text-center text-[#763717] px-2">
                    {currentLang?.code === 'am' ? t('ui_welcome_am', 'Welcome to Nib International Bank') : t('ui_welcome_en', 'Welcome to Nib International Bank')}
                  </h2>
                  <p className="text-sm font-medium text-center text-muted-foreground">
                    {t('ui_welcome_subtitle', 'How can we assist you today?')}
                  </p>
                </div>
              )}
              {msg.id !== 'welcome' && msg.text && <p>{msg.text}</p>}
              {msg.content && <div dangerouslySetInnerHTML={{ __html: msg.content }} />}
              {msg.reportStatus && (
                <div className="mt-4 border rounded-xl p-4 bg-primary/5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      {getStatusDisplay(msg.reportStatus.status).icon}
                      <span className="text-xs font-bold uppercase tracking-tight">{t('ui_status_label', 'Report Status')}</span>
                    </div>
                    <Badge className={cn("text-[10px] rounded-full", getStatusDisplay(msg.reportStatus.status).color)}>
                      {getStatusDisplay(msg.reportStatus.status).label}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">{t('ui_original_request', 'Original Request')}</div>
                    <div className="text-sm font-semibold">{msg.reportStatus.menuName}</div>
                  </div>
                  {msg.reportStatus.adminResponse && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-primary/20">
                      <div className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                        <CornerDownRight size={10} /> Admin Feedback
                      </div>
                      <div className="text-sm italic text-muted-foreground">{msg.reportStatus.adminResponse}</div>
                    </div>
                  )}
                </div>
              )}
              {msg.tableData && (
                <div className="mt-4 border rounded-xl overflow-hidden bg-white shadow-md">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          {msg.tableData.columns.map((col, i) => (
                            <TableHead key={i} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              {col.localizedHeader}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {msg.tableData.rows.map((row, i) => (
                          <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                            {msg.tableData!.columns.map((col, j) => (
                              <TableCell key={j} className="text-xs py-3 font-medium">
                                {String(resolveTableCell(col.key, row, msg.tableData!.rootData, msg.tableData!.arrayPath, 'data') ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {msg.options?.map(opt => <Button key={opt.id} variant="outline" size="sm" className="rounded-full bg-white hover:bg-primary/5 border-primary/20 text-primary" onClick={() => navigateTo(opt)}>{getLocalizedName(opt)}<ChevronRight size={14} className="ml-1 opacity-50" /></Button>)}
                {msg.relatedOptions && msg.relatedOptions.length > 0 && <div className="w-full flex items-center gap-2 py-2"><div className="h-px bg-muted flex-1" /><span className="text-[9px] font-bold uppercase text-muted-foreground">{currentLang?.code === 'am' ? 'ተዛማጅ' : 'Related'}</span><div className="h-px bg-muted flex-1" /></div>}
                {msg.relatedOptions?.map(opt => <Button key={opt.id} variant="secondary" size="sm" className="rounded-full shadow-sm" onClick={() => navigateTo(opt)}><ClipboardCheck size={12} className="mr-2" />{getLocalizedName(opt)}</Button>)}
              </div>
            </ChatBubble>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-2 animate-in fade-in">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-sm italic font-medium">{loadingText}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </ScrollArea>
      {(kycFlow || statusFlow) && <div className="p-4 bg-white border-t flex flex-col gap-2 sticky bottom-0 z-50 animate-in slide-in-from-bottom-2 duration-300">
        <form onSubmit={handleUserInput} className="flex gap-2">
          <Input 
            autoFocus 
            type={getInputType()} 
            value={kycInput} 
            onChange={e => setKycInput(e.target.value)} 
            placeholder={statusFlow ? (currentLang?.code === 'am' ? 'የሪፖርት ቁጥር እዚህ ያስገቡ...' : 'Enter reference ID...') : (currentLang?.code === 'am' ? 'እዚህ ይጻፉ...' : 'Enter requested information...')} 
            className="flex-1 shadow-inner" 
          />
          <Button type="submit" size="icon" className="rounded-xl h-10 w-10 shrink-0"><Send size={18} /></Button>
          {kycFlow && !kycFlow.fields[kycFlow.fieldIndex].required && (
            <Button type="button" variant="ghost" size="sm" onClick={() => handleKycSubmit(true)} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-primary h-10 px-3">
              Skip
            </Button>
          )}
          {statusFlow && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setStatusFlow(false)} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive h-10 px-3">
              Cancel
            </Button>
          )}
        </form>
      </div>}
      <footer className="bg-white border-t p-4 flex justify-between gap-4 sticky bottom-0 z-40 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <Button 
          variant="ghost" 
          size="sm" 
          className="hover:bg-primary/5 rounded-full px-4 text-primary font-medium" 
          onClick={handleHome}
        >
          <HomeIcon className="mr-2" size={16} /> 
          {t('ui_home', 'Home')}
        </Button>
        {(currentMenuId || menuHistory.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:bg-primary/5 rounded-full px-4 text-[#763717] font-medium" 
            onClick={handleBack}
          >
            <ChevronLeft className="mr-2" size={18} /> 
            {t('ui_back', 'Back')}
          </Button>
        )}
      </footer>
    </div>
  );
}
