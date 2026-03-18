'use client';

import { useState, useEffect, useRef } from 'react';
import { MenuItem, KYCField, TableColumn, ApiConfig, Language } from '@/lib/types';
import { getStoredMenus, getAppSettings } from '@/lib/store';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, Home, ArrowLeft, Languages, Globe, Link as LinkIcon, Send, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';

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
  
  // SYSTEM USER DATA
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
  
  const [kycInput, setKycInput] = useState('');
  const [isLoadingApi, setIsLoadingApi] = useState(false);
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

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
    const mapping = menu.apiConfig.responseMapping;
    if (!currentLang) return mapping.errorFallback;
    if (currentLang.isDefault) return mapping.errorFallback;
    const translation = menu.translations?.[currentLang.code]?.errorFallback;
    if (translation) return translation;
    if (currentLang.code === 'am' && mapping.errorFallbackAm) return mapping.errorFallbackAm;
    return mapping.errorFallback;
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

  const replacePlaceholders = (template: string, kycData: Record<string, any>) => {
    let res = template;
    res = res.replace(/{{\s*user_id\s*}}/g, userData.id);
    res = res.replace(/{{\s*user_token\s*}}/g, userData.token);
    Object.entries(kycData).forEach(([k, v]) => {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      res = res.replace(regex, String(v));
    });
    return res;
  };

  const handleKycSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!kycFlow || !kycInput.trim()) return;
    const currentField = kycFlow.fields[kycFlow.fieldIndex];
    const newKYC = { ...userData.kyc, [currentField.name]: kycInput };
    setUserData(prev => ({ ...prev, kyc: newKYC }));
    setHistory(prev => [...prev, { id: `user-kyc-${Date.now()}`, sender: 'user', text: currentField.type === 'password' ? '********' : kycInput }]);
    setKycInput('');
    if (kycFlow.fieldIndex < kycFlow.fields.length - 1) {
      const nextField = kycFlow.fields[kycFlow.fieldIndex + 1];
      setHistory(prev => [...prev, { id: `bot-kyc-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(nextField), isKYC: true }]);
      setKycFlow({ ...kycFlow, fieldIndex: kycFlow.fieldIndex + 1 });
    } else {
      setKycFlow(null);
      const menu = menus.find(m => m.id === kycFlow.menuId);
      if (menu) executeApiCall(menu, newKYC);
    }
  };

  const executeApiCall = async (menu: MenuItem, kycData: Record<string, any>) => {
    if (!menu.apiConfig) return;
    setIsLoadingApi(true);
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
        else if (kycData[param.sourceValue]) requestPayload[param.apiKey] = kycData[param.sourceValue];
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
        Object.entries(requestPayload).forEach(([k, v]) => params.append(k, String(v)));
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
        let resultText = getLocalizedTemplate(menu);
        const matches = resultText.match(/{{response\.(.*?)}}/g);
        matches?.forEach(match => {
          const path = match.replace('{{response.', '').replace('}}', '');
          resultText = resultText.replace(match, String(getVal(path, apiResponse) || ''));
        });
        botMsg.text = resultText;
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
    setIsLoadingApi(false);
  };

  const navigateTo = (menu: MenuItem) => {
    setHistory(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) }]);
    if (menu.responseType === 'api' && menu.apiConfig) {
      const requiredFieldNames: string[] = [];
      const placeholders = (menu.apiConfig.endpoint + (menu.apiConfig.authConfig?.bearer?.template || '')).match(/{{\s*(.*?)\s*}}/g);
      placeholders?.forEach(m => {
        const name = m.replace('{{', '').replace('}}', '').trim();
        if (name !== 'user_id' && name !== 'user_token') requiredFieldNames.push(name);
      });
      menu.apiConfig.requestParameters?.forEach(p => { if (p.sourceType === 'kyc') requiredFieldNames.push(p.sourceValue); });
      
      const uniqueRequired = Array.from(new Set(requiredFieldNames));
      const kycFields = menu.apiConfig.kycFields || [];
      const missingFields = kycFields
        .filter(f => uniqueRequired.includes(f.name) && !userData.kyc[f.name])
        .sort((a, b) => a.order - b.order);
      
      if (missingFields.length > 0) {
        setKycFlow({ active: true, menuId: menu.id, fieldIndex: 0, fields: missingFields });
        setHistory(prev => [...prev, { id: `bot-kyc-start-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(missingFields[0]), isKYC: true }]);
        return;
      }
      executeApiCall(menu, userData.kyc);
      return;
    }
    const children = menus.filter(m => m.parentId === menu.id);
    const relatedItems = menus.filter(m => menu.attachedMenuIds?.includes(m.id));
    setHistory(prev => [...prev, {
      id: `bot-${Date.now()}`, 
      sender: 'bot', 
      content: getLocalizedContent(menu),
      options: children.length > 0 ? children : undefined,
      relatedOptions: relatedItems.length > 0 ? relatedItems : undefined,
    }]);
    setCurrentMenuId(menu.id);
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-2xl mx-auto border-x shadow-2xl relative">
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md"><Globe size={20} /></div>
          <div><h1 className="font-bold text-lg">Support Assistant</h1><div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-[10px] uppercase tracking-wider font-bold">Online</span></div></div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="text-xs"><Languages className="mr-2" size={14} /> {currentLang?.name || 'Language'}</Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            {languages.map(lang => (
              <DropdownMenuItem key={lang.code} onClick={() => setCurrentLang(lang)}>{lang.name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {history.map(msg => (
          <ChatBubble key={msg.id} isBot={msg.sender === 'bot'}>
            {msg.text && <p>{msg.text}</p>}
            {msg.content && <div dangerouslySetInnerHTML={{ __html: msg.content }} />}
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
              {msg.relatedOptions?.map(opt => <Button key={opt.id} variant="secondary" size="sm" className="rounded-full shadow-sm" onClick={() => navigateTo(opt)}><LinkIcon size={12} className="mr-2" />{getLocalizedName(opt)}</Button>)}
            </div>
          </ChatBubble>
        ))}
        {isLoadingApi && <div className="flex justify-start"><div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-2 animate-pulse"><Loader2 size={16} className="animate-spin text-primary" /><span className="text-xs italic font-medium">Communicating with Secure Gateway...</span></div></div>}
      </div>
      {kycFlow && <div className="p-4 bg-white border-t flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300">
        <form onSubmit={handleKycSubmit} className="flex gap-2">
          <Input autoFocus type={kycFlow.fields[kycFlow.fieldIndex].type === 'password' ? 'password' : 'text'} value={kycInput} onChange={e => setKycInput(e.target.value)} placeholder={currentLang?.code === 'am' ? 'እዚህ ይጻፉ...' : 'Enter requested information...'} className="rounded-full shadow-inner" />
          <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0"><Send size={18} /></Button>
        </form>
      </div>}
      <footer className="bg-white border-t p-4 flex justify-center gap-4 shrink-0">
        <Button variant="ghost" size="sm" className="hover:bg-primary/5 rounded-full px-6" onClick={() => { setHistory(prev => [...prev, { id: `home-${Date.now()}`, sender: 'bot', text: currentLang?.code === 'am' ? 'እንዴት ልረዳዎ እችላለሁ?' : 'How can I help you?', options: menus.filter(m => m.parentId === null) }]); setCurrentMenuId(null); setKycFlow(null); }}><Home className="mr-2 text-primary" size={18} /> {currentLang?.code === 'am' ? 'ቤት' : 'Home'}</Button>
        {currentMenuId && !kycFlow && <Button variant="ghost" size="sm" className="hover:bg-primary/5 rounded-full px-6" onClick={() => { const current = menus.find(m => m.id === currentMenuId); const parent = menus.find(m => m.id === current?.parentId); if (parent) navigateTo(parent); else setHistory(p => [...p, { id: 'reset', sender: 'bot', text: 'Navigation Reset', options: menus.filter(m => !m.parentId) }]); }}><ArrowLeft className="mr-2 text-primary" size={18} /> {currentLang?.code === 'am' ? 'ተመለስ' : 'Back'}</Button>}
      </footer>
    </div>
  );
}
