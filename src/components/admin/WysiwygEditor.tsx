'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { suggestAdminContent } from '@/ai/flows/admin-content-suggester';
import { Sparkles, Loader2, Bold, Italic, List, Heading1, Heading2 } from 'lucide-react';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  title: string;
}

export function WysiwygEditor({ value, onChange, title }: WysiwygEditorProps) {
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const result = await suggestAdminContent({
        prompt: `Write a helpful description for a menu item titled "${title}".`,
        context: value,
      });
      onChange(result.suggestedContent);
    } finally {
      setIsSuggesting(false);
    }
  };

  const insertTag = (tag: string, closingTag: string = '') => {
    // Simple tag insertion at the end for this basic version
    onChange(value + (closingTag ? `<${tag}>Text</${tag}>` : `<${tag}/>`));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/50 p-2 rounded-t-lg border border-b-0">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => insertTag('strong', 'strong')} title="Bold">
            <Bold size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => insertTag('em', 'em')} title="Italic">
            <Italic size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => insertTag('h1', 'h1')} title="H1">
            <Heading1 size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => insertTag('h2', 'h2')} title="H2">
            <Heading2 size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => insertTag('ul', 'ul')} title="List">
            <List size={16} />
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSuggest} 
          disabled={isSuggesting}
          className="gap-2 text-accent border-accent/20 hover:bg-accent/10"
        >
          {isSuggesting ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
          AI Suggest
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[300px] rounded-t-none border-t-0 font-mono text-sm"
        placeholder="Enter HTML content or use AI suggestions..."
      />
      <div className="p-4 border rounded-lg bg-white overflow-auto max-h-[300px]">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Preview</p>
        <div className="wysiwyg-content" dangerouslySetInnerHTML={{ __html: value || '<p class="text-muted-foreground italic">No content yet...</p>' }} />
      </div>
    </div>
  );
}
