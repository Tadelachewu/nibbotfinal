'use client';

import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  children: ReactNode;
  isBot?: boolean;
  botAvatar?: { type?: 'text' | 'image', image?: string, text?: string };
  userAvatar?: { type?: 'text' | 'image', image?: string, text?: string };
}

function makeAvatarDataUri(text: string, background: string) {
  const safeText = String(text || '').toUpperCase();
  const fontSize = Math.max(14, 36 - Math.max(0, safeText.length - 2) * 6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${background}"/><text x="50" y="58" text-anchor="middle" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial" font-size="${fontSize}" font-weight="700" fill="#ffffff">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ChatBubble({ children, isBot = true, botAvatar, userAvatar }: ChatBubbleProps) {
  const defaultBotAvatar = botAvatar?.type === 'image' && botAvatar.image ? botAvatar.image : makeAvatarDataUri(botAvatar?.text || 'TT', '#763717');
  const defaultUserAvatar = userAvatar?.type === 'image' && userAvatar.image ? userAvatar.image : makeAvatarDataUri(userAvatar?.text || 'ME', '#F4A61B');

  return (
    <div className={cn(
      "flex gap-3 w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isBot ? "justify-start" : "justify-end"
    )}>
      {isBot && (
        <Avatar className="h-8 w-8 border-2 border-primary/20 shrink-0">
          <AvatarImage src={defaultBotAvatar} />
          <AvatarFallback className="bg-primary text-white text-[10px]">{botAvatar?.text || 'TT'}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "max-w-[85%] rounded-2xl p-4 shadow-sm transition-all hover:shadow-md",
        isBot
          ? "bg-card text-foreground rounded-tl-none border border-border"
          : "bg-accent text-white rounded-tr-none"
      )}>
        <div className="wysiwyg-content break-words whitespace-pre-wrap [word-break:break-word] [overflow-wrap:anywhere]">
          {children}
        </div>
      </div>

      {!isBot && (
        <Avatar className="h-8 w-8 border-2 border-accent/20 shrink-0">
          <AvatarImage src={defaultUserAvatar} />
          <AvatarFallback className="bg-accent text-white text-[10px]">{userAvatar?.text || 'ME'}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
