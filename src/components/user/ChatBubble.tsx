'use client';

import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  children: ReactNode;
  isBot?: boolean;
}

function makeAvatarDataUri(text: string, background: string) {
  const safeText = String(text || '').slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${background}"/><text x="50" y="58" text-anchor="middle" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial" font-size="36" font-weight="700" fill="#ffffff">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ChatBubble({ children, isBot = true }: ChatBubbleProps) {
  return (
    <div className={cn(
      "flex gap-3 w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isBot ? "justify-start" : "justify-end"
    )}>
      {isBot && (
        <Avatar className="h-8 w-8 border-2 border-primary/20 shrink-0">
          <AvatarImage src={makeAvatarDataUri('TT', '#763717')} />
          <AvatarFallback className="bg-primary text-white text-[10px]">TT</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "max-w-[85%] rounded-2xl p-4 shadow-sm transition-all hover:shadow-md",
        isBot 
          ? "bg-white text-foreground rounded-tl-none border border-border" 
          : "bg-accent text-white rounded-tr-none"
      )}>
        <div className="wysiwyg-content">
          {children}
        </div>
      </div>

      {!isBot && (
        <Avatar className="h-8 w-8 border-2 border-accent/20 shrink-0">
          <AvatarImage src={makeAvatarDataUri('ME', '#F4A61B')} />
          <AvatarFallback className="bg-accent text-white text-[10px]">ME</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
