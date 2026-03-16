
'use client';

import { useState, useEffect, useRef } from 'react';
import { MenuItem, KYCField, TableColumn } from '@/lib/types';
import { getStoredMenus } from '@/lib/store';
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
  scopeIds?: string[];
  originatingAttachedIds?: string[];
  isKYC?: boolean;
  tableData?: {
    columns: TableColumn[];
    rows: any[];
  };
}

interface UserData {
  id: string;
  isLoggedIn: boolean;
  kyc: Record<string, any>;
}

export function ChatInterface() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentMenuId, setCurrentMenuId] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [userData, setUserData] = useState<UserData>({
    id: 'user_123',
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
    const data = getStoredMenus();
    setMenus(data);
    const welcomeText = language === 'Amharic' ? 'ሰላም! ዛሬ እንዴት ልረዳዎ እችላለሁ?' : 'Hello! How can I assist you today?';
    setHistory([{ id: 'welcome', sender: 'bot', text: welcomeText, options: data.filter(m => m.parentId === null) }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const getLocalizedName = (menu: MenuItem) => language === 'Amharic' && menu.nameAm ? menu.nameAm : menu.name;
  const getLocalizedContent = (menu: MenuItem) => language === 'Amharic' && menu.contentAm ? menu.contentAm : menu.content;
  const getLocalizedKYCPrompt = (field: KYCField) => language === 'Amharic' && field.promptAm ? field.promptAm : field.prompt;
  const getLocalizedTableHeader = (col: TableColumn) => language === 'Amharic' && col.headerAm ? col.headerAm : col.header;

  const getVal = (path: string, obj: any) => {
    if (!path || !obj) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const findFirstArray = (obj: any): any[] | null => {
    if (Array.isArray(obj)) return obj;
    if (typeof obj !== 'object' || obj === null) return null;
    
    for (const key in obj) {
      if (Array.isArray(obj[key])) return obj[key];
      if (typeof obj[key] === 'object') {
        const found = findFirstArray(obj[key]);
        if (found) return found;
      }
    }
    return null;
  };

  const handleKycSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!kycFlow || !kycInput.trim()) return;
    const currentField = kycFlow.fields[kycFlow.fieldIndex];
    const newKYC = { ...userData.kyc, [currentField.name]: kycInput };
    setUserData(prev => ({ ...prev, kyc: newKYC }));
    setHistory(prev => [...prev, { id: `user-kyc-${Date.now()}`, sender: 'user', text: kycInput }]);
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
      let url = menu.apiConfig.endpoint;
      const requestPayload: Record<string, any> = {};
      
      if (menu.apiConfig.requestParameters && menu.apiConfig.requestParameters.length > 0) {
        menu.apiConfig.requestParameters.forEach(param => {
          if (param.sourceValue === 'user.id') requestPayload[param.apiKey] = userData.id;
          else if (kycData[param.sourceValue]) requestPayload[param.apiKey] = kycData[param.sourceValue];
        });
      }

      const options: RequestInit = {
        method: menu.apiConfig.method,
        headers: { 'Content-Type': 'application/json', ...menu.apiConfig.headers },
      };

      if (menu.apiConfig.method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(requestPayload).forEach(([k, v]) => params.append(k, String(v)));
        if (params.toString()) url += (url.includes('?') ? '&' : '?') + params.toString();
      } else {
        options.body = JSON.stringify(requestPayload);
      }

      const res = await fetch(url, options);
      if (res.ok) { success = true; apiResponse = await res.json(); }
      else { apiResponse = await res.json().catch(() => null); }
    } catch (e) { success = false; }

    let botMsg: Message = { id: `bot-api-${Date.now()}`, sender: 'bot' };
    if (!success) {
      botMsg.text = apiResponse?.message || mapping.errorFallback;
    } else {
      if (mapping.type === 'message') {
        let resultText = mapping.template;
        const matches = resultText.match(/{{response\.(.*?)}}/g);
        matches?.forEach(match => {
          const path = match.replace('{{response.', '').replace('}}', '');
          resultText = resultText.replace(match, String(getVal(path, apiResponse) || ''));
        });
        botMsg.text = resultText;
      } else if (mapping.type === 'table') {
        // Automatically find the array to iterate over if tableDataKey is not specified or doesn't work
        let rows = mapping.tableDataKey ? getVal(mapping.tableDataKey, apiResponse) : null;
        if (!Array.isArray(rows)) {
          rows = findFirstArray(apiResponse);
        }

        if (Array.isArray(rows)) {
          botMsg.tableData = { columns: mapping.tableColumns || [], rows };
          botMsg.text = language === 'Amharic' ? 'የተገኙ ውጤቶች የሚከተሉት ናቸው' : 'Here are the results:';
        } else { botMsg.text = mapping.errorFallback; }
      }
    }
    botMsg.options = menus.filter(m => m.parentId === menu.id);
    setHistory(prev => [...prev, botMsg]);
    setIsLoadingApi(false);
  };

  const navigateTo = (menu: MenuItem, scopeIds?: string[]) => {
    setHistory(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) }]);
    if (menu.responseType === 'api' && menu.apiConfig) {
      const missingFields = menu.apiConfig.kycFields.filter(f => !userData.kyc[f.name]).sort((a, b) => a.order - b.order);
      if (missingFields.length > 0) {
        setKycFlow({ active: true, menuId: menu.id, fieldIndex: 0, fields: missingFields });
        setHistory(prev => [...prev, { id: `bot-kyc-start-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(missingFields[0]), isKYC: true }]);
        return;
      }
      executeApiCall(menu, userData.kyc);
      return;
    }
    let children = menus.filter(m => m.parentId === menu.id);
    if (scopeIds && scopeIds.length > 0) children = children.filter(c => scopeIds.includes(c.id));
    const entryPoints = menus.filter(m => menu.attachedMenuIds?.includes(m.id))
                             .filter(item => !item.parentId || !menu.attachedMenuIds?.includes(item.parentId));
    setHistory(prev => [...prev, {
      id: `bot-${Date.now()}`, sender: 'bot', content: getLocalizedContent(menu),
      options: children.length > 0 ? children : undefined,
      relatedOptions: entryPoints.length > 0 ? entryPoints : undefined,
      scopeIds, originatingAttachedIds: menu.attachedMenuIds,
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
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="text-xs"><Languages className="mr-2" size={14} /> {language}</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => setLanguage('English')}>English</DropdownMenuItem><DropdownMenuItem onClick={() => setLanguage('Amharic')}>አማርኛ (Amharic)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {history.map(msg => (
          <ChatBubble key={msg.id} isBot={msg.sender === 'bot'}>
            {msg.text && <p>{msg.text}</p>}
            {msg.content && <div dangerouslySetInnerHTML={{ __html: msg.content }} />}
            {msg.tableData && (
              <div className="mt-4 border rounded-lg overflow-hidden bg-muted/20">
                <ScrollArea className="max-h-60">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        {msg.tableData.columns.map((col, i) => (
                          <TableHead key={i} className="text-[10px] font-bold">
                            {getLocalizedTableHeader(col)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {msg.tableData.rows.map((row, i) => (
                        <TableRow key={i}>
                          {msg.tableData!.columns.map((col, j) => (
                            <TableCell key={j} className="text-xs">
                              {String(getVal(col.key, row) || '')}
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
              {msg.options?.map(opt => <Button key={opt.id} variant="outline" size="sm" className="rounded-full" onClick={() => navigateTo(opt, msg.scopeIds)}>{getLocalizedName(opt)}<ChevronRight size={14} className="ml-1 opacity-50" /></Button>)}
              {msg.relatedOptions?.length ? <div className="w-full flex items-center gap-2 py-2"><div className="h-px bg-muted flex-1" /><span className="text-[9px] font-bold uppercase text-muted-foreground">{language === 'Amharic' ? 'ተዛማጅ' : 'Related'}</span><div className="h-px bg-muted flex-1" /></div> : null}
              {msg.relatedOptions?.map(opt => <Button key={opt.id} variant="secondary" size="sm" className="rounded-full" onClick={() => navigateTo(opt, msg.originatingAttachedIds)}><LinkIcon size={12} className="mr-2" />{getLocalizedName(opt)}</Button>)}
            </div>
          </ChatBubble>
        ))}
        {isLoadingApi && <div className="flex justify-start"><div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin text-primary" /><span className="text-xs italic">Fetching data...</span></div></div>}
      </div>
      {kycFlow && <div className="p-4 bg-white border-t flex flex-col gap-2 animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Input Required</span>
          <span className="text-[10px] text-muted-foreground">{kycFlow.fieldIndex + 1} of {kycFlow.fields.length}</span>
        </div>
        <form onSubmit={handleKycSubmit} className="flex gap-2">
          <Input 
            autoFocus 
            value={kycInput} 
            onChange={e => setKycInput(e.target.value)} 
            placeholder={language === 'Amharic' ? 'እዚህ ይጻፉ...' : 'Type here...'} 
            className="rounded-full"
          />
          <Button type="submit" size="icon" className="rounded-full"><Send size={18} /></Button>
        </form>
      </div>}
      <footer className="bg-white border-t p-4 flex justify-center gap-4 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => { setHistory(prev => [...prev, { id: `home-${Date.now()}`, sender: 'bot', text: language === 'Amharic' ? 'እንዴት ልረዳዎ እችላለሁ?' : 'How can I help you?', options: menus.filter(m => m.parentId === null) }]); setCurrentMenuId(null); setKycFlow(null); }}><Home className="mr-2" size={18} /> {language === 'Amharic' ? 'ቤት' : 'Home'}</Button>
        {currentMenuId && !kycFlow && <Button variant="ghost" size="sm" onClick={() => { const current = menus.find(m => m.id === currentMenuId); const parent = menus.find(m => m.id === current?.parentId); if (parent) navigateTo(parent); else setHistory(p => [...p, { id: 'reset', sender: 'bot', text: 'Reset', options: menus.filter(m => !m.parentId) }]); }}><ArrowLeft className="mr-2" size={18} /> {language === 'Amharic' ? 'ተመለስ' : 'Back'}</Button>}
      </footer>
    </div>
  );
}
