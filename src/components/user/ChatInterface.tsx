'use client';

import { useState, useEffect, useRef } from 'react';
import { MenuItem } from '@/lib/types';
import { getStoredMenus } from '@/lib/store';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home, ArrowLeft, Languages, Globe, Link as LinkIcon, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  content?: string;
  options?: MenuItem[];
  relatedOptions?: MenuItem[];
}

export function ChatInterface() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentMenuId, setCurrentMenuId] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
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

  const navigateTo = (menu: MenuItem) => {
    const userMsg: Message = { id: `user-${Date.now()}`, sender: 'user', text: getLocalizedName(menu) };
    
    const children = menus.filter(m => m.parentId === menu.id);
    const relatedIds = menu.attachedMenuIds || [];
    // Ensure uniqueness and that only explicitly selected items are shown (excluding unselected siblings)
    const related = menus.filter(m => relatedIds.includes(m.id));
    
    const botMsg: Message = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      content: getLocalizedContent(menu),
      options: children.length > 0 ? children : undefined,
      relatedOptions: related.length > 0 ? related : undefined,
    };

    setHistory(prev => [...prev, userMsg, botMsg]);
    setCurrentMenuId(menu.id);
  };

  const goBack = () => {
    if (!currentMenuId) return;
    const current = menus.find(m => m.id === currentMenuId);
    if (!current) {
      goHome();
      return;
    }
    
    const parent = menus.find(m => m.id === current.parentId);
    if (!parent) {
      goHome();
    } else {
      navigateTo(parent);
    }
  };

  const goHome = () => {
    const userMsg: Message = { 
      id: `home-req-${Date.now()}`, 
      sender: 'user', 
      text: language === 'Amharic' ? 'ዋና ሜኑ' : 'Main Menu' 
    };
    const botMsg: Message = {
      id: `home-resp-${Date.now()}`,
      sender: 'bot',
      text: language === 'Amharic' ? 'ወደ ዋናው ሜኑ መመለስ። ሌላ ምን ልርዳዎት?' : 'Returning to main menu. What else can I help with?',
      options: menus.filter(m => m.parentId === null)
    };
    setHistory(prev => [...prev, userMsg, botMsg]);
    setCurrentMenuId(null);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const data = getStoredMenus();
    const welcomeText = newLang === 'Amharic' ? 'ሰላም! ዛሬ እንዴት ልረዳዎ እችላለሁ?' : 'Hello! How can I assist you today?';
    setHistory([
      {
        id: 'welcome-reset',
        sender: 'bot',
        text: welcomeText,
        options: data.filter(m => m.parentId === null)
      }
    ]);
    setCurrentMenuId(null);
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-2xl mx-auto border-x shadow-2xl relative">
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md">
            <Globe size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">
              {language === 'Amharic' ? 'ረዳት ረዳት' : 'Support Assistant'}
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {language === 'Amharic' ? 'መስመር ላይ' : 'Online'}
              </span>
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
            <DropdownMenuItem onClick={() => handleLanguageChange('English')}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange('Amharic')}>
              አማርኛ (Amharic)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
      >
        <div className="space-y-4">
          {history.map((msg) => (
            <ChatBubble key={msg.id} isBot={msg.sender === 'bot'}>
              {msg.text && <p>{msg.text}</p>}
              {msg.content && <div dangerouslySetInnerHTML={{ __html: msg.content }} />}
              
              <div className="space-y-4 mt-4">
                {msg.options && (
                  <div className="flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <Button 
                        key={opt.id} 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigateTo(opt)}
                        className="rounded-full border-primary/20 hover:border-primary hover:bg-primary/5 text-primary text-xs h-auto py-2 px-4 text-left justify-start"
                      >
                        {getLocalizedName(opt)}
                        <ChevronRight size={14} className="ml-2 opacity-50 shrink-0" />
                      </Button>
                    ))}
                  </div>
                )}

                {msg.relatedOptions && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 pt-2">
                      <div className="h-px bg-muted flex-1" />
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/20 px-2 py-0.5 rounded-full border border-muted/30">
                        <Sparkles size={10} className="text-primary" />
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
                          onClick={() => navigateTo(opt)}
                          className="rounded-full text-xs h-auto py-2 px-4 text-left justify-start gap-2 bg-white border border-border hover:bg-muted hover:border-primary/30 transition-all group"
                        >
                          <LinkIcon size={12} className="opacity-50 group-hover:text-primary group-hover:opacity-100" />
                          {getLocalizedName(opt)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ChatBubble>
          ))}
        </div>
      </div>

      <footer className="bg-white border-t p-4 pb-8 flex justify-center gap-4 shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full gap-2 text-muted-foreground hover:text-primary"
          onClick={goHome}
        >
          <Home size={18} />
          <span className="text-xs font-semibold">{language === 'Amharic' ? 'ቤት' : 'Home'}</span>
        </Button>
        {currentMenuId && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full gap-2 text-muted-foreground hover:text-primary"
            onClick={goBack}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-semibold">{language === 'Amharic' ? 'ተመለስ' : 'Back'}</span>
          </Button>
        )}
      </footer>
    </div>
  );
}
