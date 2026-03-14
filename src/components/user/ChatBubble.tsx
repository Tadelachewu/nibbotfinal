'use client';

import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  children: ReactNode;
  isBot?: boolean;
}

export function ChatBubble({ children, isBot = true }: ChatBubbleProps) {
  return (
    <div className={cn(
      "flex gap-3 w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isBot ? "justify-start" : "justify-end"
    )}>
      {isBot && (
        <Avatar className="h-8 w-8 border-2 border-primary/20 shrink-0">
          <AvatarImage src="https://picsum.photos/seed/bot/100/100" />
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
          <AvatarImage src="https://picsum.photos/seed/user/100/100" />
          <AvatarFallback className="bg-accent text-white text-[10px]">ME</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
