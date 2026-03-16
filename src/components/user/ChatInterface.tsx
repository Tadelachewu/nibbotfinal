
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
  isLoggedIn: boolean;
  kyc: Record<string, any>;
}

export function ChatInterface() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentMenuId, setCurrentMenuId] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [userData, setUserData] = useState<UserData>({
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
    setHistory([
      {
        id: 'welcome',
        sender: 'bot',
        text: welcomeText,
        options: data.filter(m => m.parentId === null)
      }
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const getLocalizedName = (menu: MenuItem) => {
    if (language === 'Amharic' && menu.nameAm) return menu.nameAm;
    return menu.name;
  };

  const getLocalizedContent = (menu: MenuItem) => {
    if (language === 'Amharic' && menu.contentAm) return menu.contentAm;
    return menu.content;
  };

  const getLocalizedKYCPrompt = (field: KYCField) => {
    if (language === 'Amharic' && field.promptAm) return field.promptAm;
    return field.prompt;
  };

  const getLocalizedTableHeader = (col: TableColumn) => {
    if (language === 'Amharic' && col.headerAm) return col.headerAm;
    return col.header;
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
      setHistory(prev => [...prev, {
        id: `bot-kyc-${Date.now()}`,
        sender: 'bot',
        text: getLocalizedKYCPrompt(nextField),
        isKYC: true
      }]);
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
      const options: RequestInit = {
        method: menu.apiConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...menu.apiConfig.headers
        },
      };

      // Real injection of KYC Data into the request
      if (menu.apiConfig.method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(kycData).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        if (params.toString()) {
          url += (url.includes('?') ? '&' : '?') + params.toString();
        }
      } else {
        options.body = JSON.stringify(kycData);
      }

      const res = await fetch(url, options);
      
      if (res.ok) {
        apiResponse = await res.json();
        success = true;
      } else {
        // Try to parse error message from body if available
        try {
          const errData = await res.json();
          apiResponse = errData;
        } catch (e) {
          apiResponse = null;
        }
        success = false;
      }
    } catch (e) {
      // Fallback to internal mocks only for demonstration if the endpoint is unreachable
      success = false;
    }

    let botMsg: Message = { id: `bot-api-${Date.now()}`, sender: 'bot' };

    if (!success) {
      botMsg.text = apiResponse?.message || mapping.errorFallback;
    } else {
      if (mapping.type === 'message') {
        let resultText = mapping.template;
        const getVal = (path: string, obj: any) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
        
        const matches = resultText.match(/{{response\.(.*?)}}/g);
        matches?.forEach(match => {
          const path = match.replace('{{response.', '').replace('}}', '');
          resultText = resultText.replace(match, String(getVal(path, apiResponse) || ''));
        });
        botMsg.text = resultText;
      } else if (mapping.type === 'table') {
        const dataPath = mapping.tableDataKey || '';
        const rows = dataPath === '' ? apiResponse : dataPath.split('.').reduce((acc, part) => acc && acc[part], apiResponse);
        
        if (Array.isArray(rows)) {
          botMsg.tableData = {
            columns: mapping.tableColumns || [],
            rows: rows
          };
          botMsg.text = language === 'Amharic' ? 'እነዚህ የእርስዎ የምንዛሬ ተመኖች ናቸው።' : 'Here are the results:';
        } else {
          botMsg.text = mapping.errorFallback;
        }
      }
    }

    botMsg.options = menus.filter(m => m.parentId === menu.id);
    setHistory(prev => [...prev, botMsg]);
    setIsLoadingApi(false);
  };

  const navigateTo = (menu: MenuItem, scopeIds?: string[]) => {
    const userMsg: Message = { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) };
    setHistory(prev => [...prev, userMsg]);

    if (menu.responseType === 'api' && menu.apiConfig) {
      if (menu.apiConfig.loginRequired && !userData.isLoggedIn) {
        setHistory(prev => [...prev, { id: `bot-auth-${Date.now()}`, sender: 'bot', text: menu.apiConfig!.responseMapping.authRequiredMessage }]);
        return;
      }

      const missingFields = menu.apiConfig.kycFields
        .sort((a, b) => a.order - b.order)
        .filter(f => !userData.kyc[f.name]);

      if (missingFields.length > 0) {
        setKycFlow({ active: true, menuId: menu.id, fieldIndex: 0, fields: missingFields });
        setHistory(prev => [...prev, { id: `bot-kyc-start-${Date.now()}`, sender: 'bot', text: getLocalizedKYCPrompt(missingFields[0]), isKYC: true }]);
        return;
      }

      executeApiCall(menu, userData.kyc);
      return;
    }

    let children = menus.filter(m => m.parentId === menu.id);
    if (scopeIds && scopeIds.length > 0) {
      children = children.filter(c => scopeIds.includes(c.id));
    }

    const relatedIds = menu.attachedMenuIds || [];
    const allSelectedRelated = menus.filter(m => relatedIds.includes(m.id));
    const entryPoints = allSelectedRelated.filter(item => !item.parentId || !relatedIds.includes(item.parentId));
    
    const botMsg: Message = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      content: getLocalizedContent(menu),
      options: children.length > 0 ? children : undefined,
      relatedOptions: entryPoints.length > 0 ? entryPoints : undefined,
      scopeIds: scopeIds,
      originatingAttachedIds: relatedIds,
    };

    setHistory(prev => [...prev, botMsg]);
    setCurrentMenuId(menu.id);
  };

  const goHome = () => {
    const welcome = language === 'Amharic' ? 'እንዴት ልረዳዎ እችላለሁ?' : 'How can I help you?';
    setHistory(prev => [...prev, { id: `home-${Date.now()}`, sender: 'bot', text: welcome, options: menus.filter(m => m.parentId === null) }]);
    setCurrentMenuId(null);
    setKycFlow(null);
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-2xl mx-auto border-x shadow-2xl relative">
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md">
            <Globe size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Support Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Online</span>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold">
              <Languages size={14} /> {language}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage('English')}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('Amharic')}>አማርኛ (Amharic)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
        <div className="space-y-4">
          {history.map((msg) => (
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
                            <TableHead key={i} className="text-[10px] uppercase font-bold text-muted-foreground">
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
                                {row[col.key]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
              
              <div className="space-y-4 mt-4">
                {msg.options && (
                  <div className="flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <Button 
                        key={opt.id} 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigateTo(opt, msg.scopeIds)}
                        className="rounded-full border-primary/20 hover:border-primary hover:bg-primary/5 text-primary text-xs h-auto py-2 px-4"
                      >
                        {getLocalizedName(opt)}
                        <ChevronRight size={14} className="ml-1 opacity-50" />
                      </Button>
                    ))}
                  </div>
                )}

                {msg.relatedOptions && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 pt-2">
                      <div className="h-px bg-muted flex-1" />
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/20 px-2 py-0.5 rounded-full">
                        {language === 'Amharic' ? 'ተዛማጅ' : 'Related'}
                      </div>
                      <div className="h-px bg-muted flex-1" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.relatedOptions.map(opt => (
                        <Button 
                          key={opt.id} 
                          variant="secondary" 
                          size="sm"
                          onClick={() => navigateTo(opt, msg.originatingAttachedIds)}
                          className="rounded-full text-xs h-auto py-2 px-4 gap-2 bg-white border border-border"
                        >
                          <LinkIcon size={12} className="opacity-50" />
                          {getLocalizedName(opt)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ChatBubble>
          ))}
          
          {isLoadingApi && (
            <div className="flex justify-start mb-6">
              <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs text-muted-foreground italic">Fetching data...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {kycFlow && (
        <div className="p-4 bg-white border-t border-primary/20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <form onSubmit={handleKycSubmit} className="flex gap-2">
            <Input 
              autoFocus
              value={kycInput}
              onChange={(e) => setKycInput(e.target.value)}
              placeholder={language === 'Amharic' ? 'እዚህ ይጻፉ...' : 'Type here...'}
              className="flex-1 rounded-full border-primary/30 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" className="rounded-full bg-primary hover:bg-primary/90">
              <Send size={18} />
            </Button>
          </form>
        </div>
      )}

      <footer className="bg-white border-t p-4 pb-8 flex justify-center gap-4 shrink-0">
        <Button variant="ghost" size="sm" className="rounded-full gap-2 text-muted-foreground" onClick={goHome}>
          <Home size={18} />
          <span className="text-xs font-semibold">{language === 'Amharic' ? 'ቤት' : 'Home'}</span>
        </Button>
        {currentMenuId && !kycFlow && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full gap-2 text-muted-foreground"
            onClick={() => {
              const current = menus.find(m => m.id === currentMenuId);
              const parent = menus.find(m => m.id === current?.parentId);
              if (parent) navigateTo(parent); else goHome();
            }}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-semibold">{language === 'Amharic' ? 'ተመለስ' : 'Back'}</span>
          </Button>
        )}
      </footer>
    </div>
  );
}
