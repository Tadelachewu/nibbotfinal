'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { KBResult } from '@/lib/kb';

// Compact overrides so markdown elements fit the chat bubble's small type
// scale instead of using browser-default heading/list spacing.
const markdownComponents = {
  p:          ({ ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
  strong:     ({ ...props }) => <strong className="font-semibold" {...props} />,
  ul:         ({ ...props }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5 last:mb-0" {...props} />,
  ol:         ({ ...props }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 last:mb-0" {...props} />,
  li:         ({ ...props }) => <li className="pl-0.5" {...props} />,
  a:          ({ ...props }) => <a className="underline underline-offset-2 hover:text-[#f4a61b]" target="_blank" rel="noopener noreferrer" {...props} />,
  code:       ({ ...props }) => <code className="px-1 py-0.5 rounded bg-[#f4a61b]/10 text-[10px] font-mono" {...props} />,
  blockquote: ({ ...props }) => <blockquote className="border-l-2 border-[#f4a61b]/40 pl-2 italic opacity-90" {...props} />,
};

interface KBAnswerBubbleProps {
  result: KBResult;
  onMenuClick?: (menuId: string) => void;
  onBack?: () => void;
}

export function KBAnswerBubble({ result, onMenuClick, onBack }: KBAnswerBubbleProps) {
  if (result.noAnswer) {
    return (
      <div className="flex gap-2 w-full mb-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="h-7 w-7 shrink-0 rounded-full bg-[#f4a61b]/20 border border-[#f4a61b]/40 flex items-center justify-center text-[9px] font-bold text-[#763717]">
          AI
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-none p-2 sm:p-2.5 bg-card border border-border shadow-sm text-xs text-[#763717]">
          <p className="text-[11px] font-medium mb-1.5">
            I don&apos;t have specific information on that.
          </p>
          {result.suggestedMenus.length > 0 && (
            <div className="mb-1.5">
              <p className="text-[10px] text-[#763717]/70 mb-1">You may find these helpful:</p>
              <div className="flex flex-wrap gap-1">
                {result.suggestedMenus.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onMenuClick?.(m.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#f4a61b]/10 border border-[#f4a61b]/30 text-[#763717] hover:bg-[#f4a61b]/20 transition-colors"
                  >
                    {m.name} ↗
                  </button>
                ))}
              </div>
            </div>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="mt-1 text-[10px] text-[#763717]/60 hover:text-[#763717] underline underline-offset-2 transition-colors"
            >
              ← Back to menu
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full mb-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="h-7 w-7 shrink-0 rounded-full bg-[#f4a61b]/20 border border-[#f4a61b]/40 flex items-center justify-center text-[9px] font-bold text-[#763717]">
        AI
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-none p-2 sm:p-2.5 bg-card border border-[#f4a61b]/20 shadow-sm text-xs text-[#763717]">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#f4a61b]/15 text-[#763717]/80 font-semibold">
            ✨ AI Answer
          </span>
        </div>

        <div className="text-[11px] leading-relaxed break-words [word-break:break-word]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {result.answer}
          </ReactMarkdown>
        </div>

        {result.sources.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-[#f4a61b]/20">
            <p className="text-[9px] text-[#763717]/60 mb-1">Sources:</p>
            <div className="flex flex-wrap gap-1">
              {result.sources.map(s => (
                <button
                  key={s.menuId}
                  onClick={() => onMenuClick?.(s.menuId)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#f4a61b]/10 border border-[#f4a61b]/30 text-[#763717] hover:bg-[#f4a61b]/20 transition-colors"
                >
                  {s.menuName} ↗
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
