'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MenuItem, KYCField, TableColumn, Language, UserReport, KYCFieldType } from '@/lib/types';
import { getStoredMenus, getAppSettings, addReport, getStoredReports } from '@/lib/store';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronRight, 
  Home, 
  ArrowLeft, 
  Languages, 
  Send, 
  Loader2, 
  ClipboardCheck, 
  CornerDownRight, 
  Search, 
  FileSearch, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageSquare,
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
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
  const [currentLang, setCurrentLang] = useState<Language | null>(null);
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  
  const [userData, setUserData] = useState<UserData>({
    id: 'user_123',
    token: 'talktree_static_token_778899',
    isLoggedIn: true,
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

  useEffect(() => {
    const settings = getAppSettings();
    setLanguages(settings.supportedLanguages);
    const defaultLang = settings.supportedLanguages.find(l => l.isDefault) || settings.supportedLanguages[0];
    setCurrentLang(defaultLang);
    
    const data = getStoredMenus();
    setMenus(data);
    
    const welcomeText = defaultLang.code === 'am' ? 'ሰላም! ዛሬ እንዴት ልረዳዎ እችላለሁ?' : 'Hello! How can I assist you today?';
    setHistory([{ id: 'welcome', sender: 'bot', text: welcomeText, options: data.filter(m => m.parentId === null) }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [history, isLoading, kycFlow, statusFlow]);

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
    if (!currentLang) return field.prompt;
    if (currentLang.code === 'am' && field.promptAm) return field.promptAm;
    return field.prompt;
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
    if (!currentLang) return mapping.template;
    if (currentLang.isDefault) return mapping.template;
    const translation = menu.translations?.[currentLang.code]?.responseTemplate;
    if (translation) return translation;
    if (currentLang.code === 'am' && mapping.templateAm) return mapping.templateAm;
    return mapping.template;
  };

  const getLocalizedErrorFallback = (menu: MenuItem) => {
    if (!menu.apiConfig) return "";
    const mapping = menu.apiConfig.errorFallback; // Fallback to mapping root
    if (!currentLang) return mapping || "";
    if (currentLang.isDefault) return mapping || "";
    const translation = menu.translations?.[currentLang.code]?.errorFallback;
    if (translation) return translation;
    if (currentLang.code === 'am' && menu.apiConfig.responseMapping.errorFallbackAm) return menu.apiConfig.responseMapping.errorFallbackAm;
    return mapping || "";
  };

  const getVal = (path: string, obj: any) => {
    if (!path || !obj) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const findArrayData = (obj: any): { path: string; data: any[] } | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) return { path: '', data: obj };
    for (const key in obj) { if (Array.isArray(obj[key])) return { path: key, data: obj[key] }; }
    if (obj.status === 'success' || obj.status === 'ok' || !obj.status) return { path: '', data: [obj] };
    return null;
  };

  const resolveTableCell = (key: string, row: any, root: any, arrayPath: string) => {
    if (arrayPath && key.startsWith(arrayPath + '.')) {
      const strippedKey = key.substring(arrayPath.length + 1);
      const val = getVal(strippedKey, row);
      if (val !== undefined) return val;
    }
    const rowVal = getVal(key, row);
    if (rowVal !== undefined) return rowVal;
    return getVal(key, root);
  };

  const replacePlaceholders = (template: string, dataObj: Record<string, any>) => {
    if (!template) return '';
    let res = template;
    res = res.replace(/{{\s*user_id\s*}}/g, userData.id);
    res = res.replace(/{{\s*user_token\s*}}/g, userData.token);
    
    const responseMatches = res.match(/{{\s*response\.(.*?)\s*}}/g);
    responseMatches?.forEach(match => {
      const path = match.replace('{{', '').replace('}}', '').trim();
      res = res.replace(match, String(getVal(path, dataObj) ?? ''));
    });

    Object.entries(userData.kyc).forEach(([k, v]) => {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      res = res.replace(regex, String(v ?? ''));
    });
    
    return res;
  };

  const validateInput = (value: string, type: KYCFieldType): { isValid: boolean, error?: string } => {
    if (!value.trim()) return { isValid: true };
    
    switch (type) {
      case 'number':
        return { 
          isValid: !isNaN(Number(value)), 
          error: currentLang?.code === 'am' ? 'እባክዎ ቁጥር ብቻ ያስገቡ' : 'Please enter a valid number' 
        };
      case 'tel':
        const phoneRegex = /^\+?[0-9]{7,15}$/;
        const stripped = value.replace(/[\s\-()]/g, '');
        return { 
          isValid: phoneRegex.test(stripped), 
          error: currentLang?.code === 'am' ? 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ' : 'Please enter a valid phone number' 
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
        data: reportPayload
      });

      const responseContext = { response: { id: savedReport.id, ...reportPayload } };
      const finalMsg = replacePlaceholders(getLocalizedTemplate(menu), responseContext);

      const successContent = getLocalizedContent(menu);
      const defaultSuccess = currentLang?.code === 'am' ? 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' : 'Your report has been submitted successfully. Thank you.';
      
      setHistory(prev => [...prev, {
        id: `bot-report-${Date.now()}`,
        sender: 'bot',
        text: finalMsg || (successContent ? undefined : defaultSuccess),
        content: finalMsg ? undefined : successContent,
        options: menus.filter(m => m.parentId === menu.id)
      }]);
      setIsLoading(false);
    }, 600);
  };

  const executeApiCall = async (menu: MenuItem, kycData: Record<string, any>) => {
    if (!menu.apiConfig) return;
    setLoadingText(currentLang?.code === 'am' ? 'ከአስተማማኝ መግቢያ ጋር በመገናኘት ላይ...' : 'Communicating with Secure Gateway...');
    setIsLoading(true);
    let apiResponse: any;
    let success = false;
    const mapping = menu.apiConfig.responseMapping;

    try {
      let url = replacePlaceholders(menu.apiConfig.endpoint, kycData);
      const requestPayload: Record<string, any> = {};
      menu.apiConfig.requestParameters?.forEach(param => {
        if (param.sourceValue === 'user.id') requestPayload[param.apiKey] = userData.id;
        else if (param.sourceValue === 'user.token') requestPayload[param.apiKey] = userData.token;
        else if (param.sourceType === 'static') requestPayload[param.apiKey] = param.sourceValue;
        else if (kycData[param.sourceValue] !== undefined) requestPayload[param.apiKey] = kycData[param.sourceValue];
      });

      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...menu.apiConfig.headers };
      const auth = menu.apiConfig.authConfig;
      if (auth && auth.type !== 'none') {
        const headerName = auth.apiKey?.header || auth.basicAuth?.header || auth.bearer?.header || 'Authorization';
        if (auth.type === 'apiKey' && auth.apiKey) { headers[headerName] = replacePlaceholders(auth.apiKey.value, kycData); }
        else if (auth.type === 'basic' && auth.basicAuth) {
          const user = auth.basicAuth.user || '';
          const pass = auth.basicAuth.pass || '';
          headers[headerName] = `Basic ${btoa(`${user}:${pass}`)}`;
        } else if (auth.type === 'bearer' && auth.bearer) { headers[headerName] = replacePlaceholders(auth.bearer.template, kycData); }
      }

      const options: RequestInit = { method: menu.apiConfig.method, headers };
      if (menu.apiConfig.method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(requestPayload).forEach(([k, v]) => {
          if (v !== null) params.append(k, String(v));
        });
        if (params.toString()) url += (url.includes('?') ? '&' : '?') + params.toString();
      } else { options.body = JSON.stringify(requestPayload); }

      const res = await fetch(url, options);
      const data = await res.json().catch(() => null);
      success = res.ok;
      apiResponse = data;
    } catch (e) { success = false; }

    let botMsg: Message = { id: `bot-api-${Date.now()}`, sender: 'bot' };
    if (!success) { botMsg.text = apiResponse?.message || getLocalizedErrorFallback(menu); }
    else {
      if (mapping.type === 'message') {
        botMsg.text = replacePlaceholders(getLocalizedTemplate(menu), { response: apiResponse });
      } else if (mapping.type === 'table') {
        const foundArray = findArrayData(apiResponse);
        if (foundArray) {
          botMsg.tableData = { 
            columns: (mapping.tableColumns || []).map(c => ({ ...c, localizedHeader: getLocalizedTableHeader(menu, c) })), 
            rows: Array.isArray(foundArray.data) ? foundArray.data : [foundArray.data], 
            rootData: apiResponse, 
            arrayPath: foundArray.path 
          };
          botMsg.text = currentLang?.code === 'am' ? 'የተገኙ ውጤቶች የሚከተሉት ናቸው' : 'Here are the results:';
        } else { botMsg.text = getLocalizedErrorFallback(menu); }
      }
    }
    botMsg.options = menus.filter(m => m.parentId === menu.id);
    setHistory(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const navigateTo = (menu: MenuItem) => {
    const childMenus = menus.filter(m => m.parentId === menu.id);
    const relatedItems = menus.filter(m => menu.attachedMenuIds?.includes(m.id));
    
    setHistory(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) }]);

    const isAction = (menu.responseType === 'api' || menu.responseType === 'report') && menu.apiConfig;
    const hasFields = menu.apiConfig?.kycFields?.length || 0;

    if (isAction && (hasFields > 0 || childMenus.length === 0)) {
      const kycFields = menu.apiConfig?.kycFields || [];
      const missingFields = kycFields
        .filter(f => userData.kyc[f.name] === undefined)
        .sort((a, b) => a.order - b.order);
      
      if (missingFields.length > 0) {
        setKycFlow({ active: true, menuId: menu.id, fieldIndex: 0, fields: missingFields });
        setHistory(prev => [...prev, { id: `bot-kyc-start-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(missingFields[0]), isKYC: true }]);
        return;
      }
      
      if (menu.responseType === 'report') {
        handleInternalReport(menu, userData.kyc);
      } else {
        executeApiCall(menu, userData.kyc);
      }
      return;
    }

    setHistory(prev => [...prev, {
      id: `bot-${Date.now()}`, 
      sender: 'bot', 
      content: getLocalizedContent(menu) || (childMenus.length > 0 ? (currentLang?.code === 'am' ? 'እባክዎ አማራጭ ይምረጡ፡' : 'Please select an option:') : ''),
      options: childMenus.length > 0 ? childMenus : undefined,
      relatedOptions: relatedItems.length > 0 ? relatedItems : undefined,
    }]);
    setCurrentMenuId(menu.id);
  };

  const startStatusFlow = () => {
    setStatusFlow(true);
    setHistory(prev => [...prev, { 
      id: `bot-status-prompt-${Date.now()}`, 
      sender: 'bot', 
      text: currentLang?.code === 'am' ? 'እባክዎ የሪፖርት ቁጥርዎን ያስገቡ፡' : 'Please enter your Report Reference ID:' 
    }]);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'resolved': return { icon: <CheckCircle2 className="text-green-500" />, label: currentLang?.code === 'am' ? 'ተፈትቷል' : 'Resolved', color: 'bg-green-100 text-green-800' };
      case 'reviewed': return { icon: <Clock className="text-blue-500" />, label: currentLang?.code === 'am' ? 'በመመርመር ላይ' : 'Reviewed', color: 'bg-blue-100 text-blue-800' };
      default: return { icon: <AlertCircle className="text-amber-500" />, label: currentLang?.code === 'am' ? 'በጥበቃ ላይ' : 'Pending', color: 'bg-amber-100 text-amber-800' };
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

  return (
    <div className="flex flex-col h-full bg-background max-w-2xl mx-auto border-x shadow-2xl relative">
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 overflow-hidden rounded-full shadow-md border-2 border-primary/10">
            <Image 
              src={logo?.imageUrl || 'https://picsum.photos/seed/logo/100/100'} 
              alt="TalkTree Logo"
              fill
              className="object-cover"
              data-ai-hint={logo?.imageHint || 'logo'}
            />
          </div>
          <div>
            <h1 className="font-bold text-lg">Support Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider font-bold">Online</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 p-0 border shadow-sm">
                <Avatar className="h-full w-full">
                  <AvatarImage src={userAvatar?.imageUrl || "https://picsum.photos/seed/user/100/100"} />
                  <AvatarFallback className="bg-accent text-white"><UserIcon size={16} /></AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-bold">User Profile</span>
                <span className="text-[10px] text-muted-foreground font-mono">{userData.id}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground pb-1">Settings</DropdownMenuLabel>
              <DropdownMenuSeparator className="mt-0" />
              <div className="p-1">
                <span className="text-[10px] font-bold px-2 flex items-center gap-2 text-muted-foreground mb-1">
                  <Languages size={10} /> Language
                </span>
                {languages.map(lang => (
                  <DropdownMenuItem 
                    key={lang.code} 
                    onClick={() => setCurrentLang(lang)}
                    className={cn("text-xs flex items-center justify-between", currentLang?.code === lang.code && "bg-primary/10 text-primary")}
                  >
                    {lang.name}
                    {currentLang?.code === lang.code && <CheckCircle2 size={12} />}
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startStatusFlow} className="text-sm gap-2">
                <FileSearch size={16} className="text-primary" />
                {currentLang?.code === 'am' ? 'ሁኔታ አረጋግጥ' : 'Check Report Status'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {history.map(msg => (
          <ChatBubble key={msg.id} isBot={msg.sender === 'bot'}>
            {msg.text && <p>{msg.text}</p>}
            {msg.content && <div dangerouslySetInnerHTML={{ __html: msg.content }} />}
            {msg.reportStatus && (
              <div className="mt-4 border rounded-xl p-4 bg-muted/30 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    {getStatusDisplay(msg.reportStatus.status).icon}
                    <span className="text-xs font-bold uppercase tracking-tight">Report Status</span>
                  </div>
                  <Badge className={cn("text-[10px] rounded-full", getStatusDisplay(msg.reportStatus.status).color)}>
                    {getStatusDisplay(msg.reportStatus.status).label}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Original Request</div>
                  <div className="text-sm font-semibold">{msg.reportStatus.menuName}</div>
                </div>
                {msg.reportStatus.adminResponse && (
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-dashed border-primary/30">
                    <div className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                      <MessageSquare size={10} /> Admin Feedback
                    </div>
                    <div className="text-sm italic text-foreground">{msg.reportStatus.adminResponse}</div>
                  </div>
                )}
              </div>
            )}
            {msg.tableData && (
              <div className="mt-4 border rounded-lg overflow-hidden bg-muted/20 shadow-sm">
                <ScrollArea className="max-h-60">
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
                        <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                          {msg.tableData!.columns.map((col, j) => (
                            <TableCell key={j} className="text-xs py-3 font-medium">
                              {String(resolveTableCell(col.key, row, msg.tableData!.rootData, msg.tableData!.arrayPath) ?? '')}
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
              {msg.options?.map(opt => <Button key={opt.id} variant="outline" size="sm" className="rounded-full bg-white hover:bg-primary/5 border-primary/20 text-primary-dark" onClick={() => navigateTo(opt)}>{getLocalizedName(opt)}<ChevronRight size={14} className="ml-1 opacity-50" /></Button>)}
              {msg.relatedOptions?.length ? <div className="w-full flex items-center gap-2 py-2"><div className="h-px bg-muted flex-1" /><span className="text-[9px] font-bold uppercase text-muted-foreground">{currentLang?.code === 'am' ? 'ተዛማጅ' : 'Related'}</span><div className="h-px bg-muted flex-1" /></div> : null}
              {msg.relatedOptions?.map(opt => <Button key={opt.id} variant="secondary" size="sm" className="rounded-full shadow-sm" onClick={() => navigateTo(opt)}><ClipboardCheck size={12} className="mr-2" />{getLocalizedName(opt)}</Button>)}
            </div>
          </ChatBubble>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-2 animate-pulse">
              <Loader2 size={16} className="animate-spin text-primary" />
              <span className="text-xs italic font-medium">{loadingText}</span>
            </div>
          </div>
        )}
      </div>
      
      {(kycFlow || statusFlow) && <div className="p-4 bg-white border-t flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300">
        <form onSubmit={handleUserInput} className="flex gap-2">
          <Input 
            autoFocus 
            type={getInputType()} 
            value={kycInput} 
            onChange={e => setKycInput(e.target.value)} 
            placeholder={statusFlow ? (currentLang?.code === 'am' ? 'ሪፖርት ቁጥር እዚህ ያስገቡ...' : 'Enter reference ID...') : (currentLang?.code === 'am' ? 'እዚህ ይጻፉ...' : 'Enter requested information...')} 
            className="rounded-full shadow-inner" 
          />
          <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0"><Send size={18} /></Button>
          {kycFlow && !kycFlow.fields[kycFlow.fieldIndex].required && (
            <Button type="button" variant="ghost" size="sm" onClick={() => handleKycSubmit(true)} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-primary h-10 px-3">
              <CornerDownRight size={14} className="mr-1" /> {currentLang?.code === 'am' ? 'ዘልለው' : 'Skip'}
            </Button>
          )}
          {statusFlow && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setStatusFlow(false)} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive h-10 px-3">
              {currentLang?.code === 'am' ? 'ሰርዝ' : 'Cancel'}
            </Button>
          )}
        </form>
      </div>}
      
      <footer className="bg-white border-t p-4 flex justify-center gap-4 shrink-0 overflow-x-auto shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <Button variant="ghost" size="sm" className="hover:bg-primary/5 rounded-full px-4" onClick={() => { setHistory(prev => [...prev, { id: `home-${Date.now()}`, sender: 'bot', text: currentLang?.code === 'am' ? 'እንዴት ልረዳዎ እችላለሁ?' : 'How can I help you?', options: menus.filter(m => m.parentId === null) }]); setCurrentMenuId(null); setKycFlow(null); setStatusFlow(false); }}><Home className="mr-2 text-primary" size={18} /> {currentLang?.code === 'am' ? 'ቤት' : 'Home'}</Button>
        {currentMenuId && !kycFlow && !statusFlow && <Button variant="ghost" size="sm" className="hover:bg-primary/5 rounded-full px-4" onClick={() => { const current = menus.find(m => m.id === currentMenuId); const parent = menus.find(m => m.id === current?.parentId); if (parent) navigateTo(parent); else setHistory(p => [...p, { id: 'reset', sender: 'bot', text: 'Navigation Reset', options: menus.filter(m => !m.parentId) }]); }}><ArrowLeft className="mr-2 text-primary" size={18} /> {currentLang?.code === 'am' ? 'ተመለስ' : 'Back'}</Button>}
      </footer>
    </div>
  );
}
