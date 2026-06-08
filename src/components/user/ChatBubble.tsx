'use client';

import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { escapeHtml } from '@/lib/security';

interface ChatBubbleProps {
  children: ReactNode;
  isBot?: boolean;
  botAvatar?: { type?: 'text' | 'image', image?: string, text?: string, url?: string };
  userAvatar?: { type?: 'text' | 'image', image?: string, text?: string, url?: string };
}

function makeAvatarDataUri(text: string, background: string, color: string) {
  const safeText = escapeHtml(String(text || '').toUpperCase());
  const fontSize = Math.max(14, 36 - Math.max(0, safeText.length - 2) * 6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${background}"/><text x="50" y="58" text-anchor="middle" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial" font-size="${fontSize}" font-weight="700" fill="${color}">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ChatBubble({ children, isBot = true, botAvatar, userAvatar }: ChatBubbleProps) {
  const defaultBotAvatar = botAvatar?.url || (botAvatar?.type === 'image' && botAvatar.image ? botAvatar.image : makeAvatarDataUri(botAvatar?.text || 'NB', '#f4a61b', '#763717'));
  const defaultUserAvatar = userAvatar?.url || (userAvatar?.type === 'image' && userAvatar.image ? userAvatar.image : makeAvatarDataUri(userAvatar?.text || 'U', '#f4a61b', '#763717'));

  const isBotImage = botAvatar?.type === 'image' || botAvatar?.url;
  const isUserImage = userAvatar?.type === 'image' || userAvatar?.url;

  return (
    <div className={cn(
      "flex gap-3 w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isBot ? "justify-start" : "justify-end"
    )}>
      {isBot && (
        <Avatar className={cn(
          "h-8 border-2 border-[#f4a61b]/20 shrink-0",
          isBotImage ? "w-12 sm:w-16 rounded-lg bg-transparent" : "w-8 rounded-full"
        )}>
          <AvatarImage src={defaultBotAvatar} />
          <AvatarFallback className="bg-[#f4a61b] text-[#763717] text-[10px] font-bold">{botAvatar?.text || 'NB'}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "max-w-[80%] rounded-2xl p-3 sm:p-4 shadow-sm transition-all hover:shadow-md overflow-hidden min-w-0",
        isBot
          ? "bg-card text-[#763717] rounded-tl-none border border-border"
          : "bg-[#f4a61b] text-[#763717] rounded-tr-none"
      )}>
        <div className="wysiwyg-content break-words whitespace-pre-wrap [word-break:break-word] [overflow-wrap:anywhere] min-w-0">
          {children}
        </div>
      </div>

      {!isBot && (
        <Avatar className="h-8 w-8 border-2 border-[#f4a61b]/20 shrink-0 rounded-full">
          <AvatarImage src={defaultUserAvatar} className="object-cover" />
          <AvatarFallback className="bg-[#f4a61b] text-[#763717] text-[10px] font-bold">{userAvatar?.text || 'U'}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
