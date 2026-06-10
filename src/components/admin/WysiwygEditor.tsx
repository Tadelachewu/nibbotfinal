
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Extension } from '@tiptap/react';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    }
  },
} as any);
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Baseline,
  Highlighter,
  Eraser,
  Minus,
  Image as ImageIcon,
  ChevronDown,
  Monitor,
  CaseSensitive,
  Check,
  X,
  Table as TableIcon,
  Columns,
  Rows,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClassWithRules } from '@/lib/csp';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  title: string;
  readOnly?: boolean;
}

/* ─── Color Picker Panel ────────────────────────────────────────────────────
 * Rendered inline (NOT in a portal) so it never steals focus from the editor.
 * Every interactive element uses onMouseDown + preventDefault to keep the
 * editor's native selection intact.
 * ──────────────────────────────────────────────────────────────────────────── */

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#374151' },
  { name: 'Slate', value: '#475569' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Green', value: '#059669' },
  { name: 'Lime', value: '#65a30d' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Nib Gold', value: '#f4a61c' },
  { name: 'Nib Brown', value: '#7a3f16' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Lime', value: '#d9f99d' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Cyan', value: '#a5f3fc' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Rose', value: '#fecdd3' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Amber', value: '#fde68a' },
];

interface ColorPanelProps {
  editor: any;
  mode: 'text' | 'highlight';
  onClose: () => void;
}

function ColorPanel({ editor, mode, onClose }: ColorPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [customHex, setCustomHex] = useState('');

  const colors = mode === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const currentColor = mode === 'text'
    ? editor.getAttributes('textStyle').color || ''
    : editor.getAttributes('highlight').color || '';

  const applyColor = useCallback((color: string) => {
    if (mode === 'text') {
      if (!color) {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    } else {
      if (!color) {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    }
  }, [editor, mode]);

  const applyCustomHex = useCallback(() => {
    const hex = customHex.startsWith('#') ? customHex : `#${customHex}`;
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
      applyColor(hex);
      setCustomHex('');
    }
  }, [customHex, applyColor]);

  // Generate CSS classes for color buttons and current color display using nonce-protected styles
  useEffect(() => {
    const map = new Map<string, { className: string; tag: HTMLStyleElement }>()
    const createdTags: HTMLStyleElement[] = []

    // color buttons
    colors.forEach((c) => {
      const val = c.value || ''
      if (map.has(val)) return
      let result;
      if (!val && mode === 'highlight') {
        const rules = `background-color: transparent; background-image: linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%); background-size: 6px 6px; background-position: 0 0, 3px 3px;`
        result = createClassWithRules(rules)
      } else {
        const bg = val || (mode === 'text' ? 'white' : 'transparent')
        result = createClassWithRules(`background-color: ${bg};`)
      }
      map.set(val, result)
      createdTags.push(result.tag)
    })

    // apply classes to elements
    const buttons = Array.from(document.querySelectorAll('[data-color]')) as HTMLElement[]
    buttons.forEach((btn) => {
      const val = btn.getAttribute('data-color') || ''
      const res = map.get(val)
      if (res) btn.classList.add(res.className)
    })

    const current = document.querySelector('[data-current-color]') as HTMLElement | null
    if (current) {
      const c = current.getAttribute('data-current-color') || ''
      let res = map.get(c)
      if (!res) {
        res = createClassWithRules(`background-color: ${c};`)
        createdTags.push(res.tag)
      }
      current.classList.add(res.className)
    }

    return () => {
      createdTags.forEach(tag => {
        try {
          if (tag.parentNode) tag.parentNode.removeChild(tag)
        } catch (e) { }
      })
    }
  }, [colors, mode])

  // Close on click-outside (mousedown so it fires before focus shift)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 mt-1 w-[280px] rounded-lg border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
      // Prevent the entire panel from stealing focus
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            {mode === 'text' ? 'Text Color' : 'Highlight Color'}
          </Label>
          <button
            type="button"
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={12} className="text-muted-foreground" />
          </button>
        </div>

        {/* Color Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c) => {
            const isActive = c.value
              ? currentColor?.toLowerCase() === c.value.toLowerCase()
              : !currentColor;

            return (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyColor(c.value);
                }}
                className={cn(
                  "h-7 w-full rounded-md border transition-all flex items-center justify-center group relative",
                  "hover:scale-110 hover:shadow-md hover:z-10",
                  isActive
                    ? "ring-2 ring-primary ring-offset-1 border-primary shadow-sm"
                    : "border-muted-foreground/20 hover:border-muted-foreground/40"
                )}
                // dynamic color classes are generated below
                data-color={c.value || ''}
                title={c.name}
              >
                {!c.value && mode === 'text' && <Eraser size={10} className="text-muted-foreground" />}
                {!c.value && mode === 'highlight' && <X size={10} className="text-muted-foreground" />}
                {isActive && c.value && (
                  <Check
                    size={12}
                    className={cn(
                      "drop-shadow-sm",
                      // Use white check on dark colors, dark check on light colors
                      mode === 'highlight' ? 'text-gray-700' : 'text-white'
                    )}
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom color section */}
        <div className="pt-2 border-t space-y-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Custom Color
          </Label>
          <div className="flex items-center gap-2">
            {/* Native color picker */}
            <div className="relative shrink-0">
              <input
                type="color"
                className="w-8 h-8 rounded-md border border-muted-foreground/20 cursor-pointer p-0.5 block"
                value={currentColor || '#000000'}
                onMouseDown={(e) => {
                  // Allow native picker to open but prevent editor blur
                  e.stopPropagation();
                }}
                onChange={(e) => {
                  applyColor(e.target.value);
                }}
                title="Pick a color"
              />
            </div>
            {/* Hex text input */}
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-muted-foreground font-mono">#</span>
              <input
                type="text"
                placeholder="hex code"
                value={customHex.replace('#', '')}
                className="flex-1 h-7 px-1.5 text-xs font-mono border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onMouseDown={(e) => {
                  // Allow typing but stop propagation so panel stays
                  e.stopPropagation();
                }}
                onChange={(e) => setCustomHex(e.target.value.replace('#', ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCustomHex();
                  }
                }}
              />
              <button
                type="button"
                className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[10px] font-bold uppercase hover:bg-primary/90 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyCustomHex();
                }}
              >
                Set
              </button>
            </div>
          </div>


          {/* Current color display */}
          {currentColor && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-sm border border-muted-foreground/20"
                data-current-color={currentColor}
              />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {currentColor}
              </span>
            </div>
          )}
        </div>

        {/* Always-visible Clear button */}
        <div className="pt-2 border-t">
          <button
            type="button"
            className="w-full h-8 rounded-md border border-destructive/20 bg-destructive/5 text-destructive text-[11px] uppercase font-bold hover:bg-destructive/15 transition-colors flex items-center justify-center gap-1.5"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyColor('');
            }}
          >
            <Eraser size={12} />
            {mode === 'text' ? 'Clear Text Color' : 'Clear Highlight'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Menu Bar ──────────────────────────────────────────────────────────── */

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const [colorPanelMode, setColorPanelMode] = useState<'text' | 'highlight' | null>(null);

  const closeColorPanel = useCallback(() => setColorPanelMode(null), []);

  const toggleColorPanel = useCallback((mode: 'text' | 'highlight') => {
    setColorPanelMode((prev) => (prev === mode ? null : mode));
  }, []);

  const setLink = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const fontSizes = [
    '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px', '64px'
  ];

  const fontFamilies = [
    { name: 'Sans Serif', value: 'Inter, ui-sans-serif, system-ui' },
    { name: 'Serif', value: 'Georgia, serif' },
    { name: 'Monospace', value: 'ui-monospace, SFMono-Regular, "JetBrains Mono", monospace' },
    { name: 'Display', value: '"Clash Display", sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Open Sans', value: '"Open Sans", sans-serif' },
    { name: 'Lato', value: 'Lato, sans-serif' },
    { name: 'Montserrat', value: 'Montserrat, sans-serif' },
    { name: 'Oswald', value: 'Oswald, sans-serif' },
    { name: 'Playfair Display', value: '"Playfair Display", serif' },
    { name: 'Myriad Pro', value: '"Myriad Pro", "Myriad", sans-serif' },
    { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/5 sticky top-0 z-10 backdrop-blur-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
            <Type size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase">
              {editor.isActive('heading', { level: 1 }) ? 'H1' :
                editor.isActive('heading', { level: 2 }) ? 'H2' :
                  editor.isActive('heading', { level: 3 }) ? 'H3' :
                    editor.isActive('heading', { level: 4 }) ? 'H4' :
                      editor.isActive('heading', { level: 5 }) ? 'H5' :
                        editor.isActive('heading', { level: 6 }) ? 'H6' : 'Body'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[180px]">
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className={cn(!editor.isActive('heading') && "bg-accent")}>
            Normal Text
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {[1, 2, 3, 4, 5, 6].map((level: any) => (
            <DropdownMenuItem
              key={level}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              className={cn(editor.isActive('heading', { level }) && "bg-accent")}
            >
              <div className="flex items-center justify-between w-full">
                <span>Heading {level}</span>
                <span className={cn("text-[10px] text-muted-foreground uppercase")}>h{level}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Typography: Font Family */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
            <Type size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase truncate max-w-[60px]">
              {fontFamilies.find(f => editor.isActive('textStyle', { fontFamily: f.value }))?.name || 'Font'}
            </span>
            <ChevronDown size={10} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[180px]">
          {fontFamilies.map((f) => (
            <DropdownMenuItem
              key={f.value}
              onClick={() => editor.chain().focus().setFontFamily(f.value).run()}
              className={cn(editor.isActive('textStyle', { fontFamily: f.value }) && "bg-accent")}
              style={{ fontFamily: f.value }}
            >
              {f.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().unsetFontFamily().run()}>
            Reset Font
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Font Size */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
            <CaseSensitive size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase">
              {editor.getAttributes('textStyle').fontSize || '16px'}
            </span>
            <ChevronDown size={10} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[100px]">
          {fontSizes.map((size) => (
            <DropdownMenuItem
              key={size}
              onClick={() => editor.chain().focus().setFontSize(size).run()}
              className={cn(editor.getAttributes('textStyle').fontSize === size && "bg-accent")}
            >
              {size}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().unsetFontSize().run()}>
            Reset Size
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-accent text-accent-foreground")}
      >
        <Bold size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-accent text-accent-foreground")}
      >
        <Italic size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('underline') && "bg-accent text-accent-foreground")}
      >
        <UnderlineIcon size={16} />
      </Button>

      {/* ── Text Color Button ────────────────────────────────── */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", colorPanelMode === 'text' && "bg-accent")}
          title="Text Color"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleColorPanel('text');
          }}
        >
          <div className="relative flex items-center justify-center">
            <Baseline size={16} />
            <div
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
              style={{
                backgroundColor: editor.getAttributes('textStyle').color || '#000000',
              }}
            />
          </div>
        </Button>
        {colorPanelMode === 'text' && (
          <ColorPanel editor={editor} mode="text" onClose={closeColorPanel} />
        )}
      </div>

      {/* ── Highlight Color Button ───────────────────────────── */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", colorPanelMode === 'highlight' && "bg-accent")}
          title="Highlight Color"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleColorPanel('highlight');
          }}
        >
          <div className="relative flex items-center justify-center">
            <Highlighter size={16} />
            <div
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
              style={{
                backgroundColor: editor.getAttributes('highlight').color || 'transparent',
                opacity: editor.getAttributes('highlight').color ? 1 : 0,
              }}
            />
          </div>
        </Button>
        {colorPanelMode === 'highlight' && (
          <ColorPanel editor={editor} mode="highlight" onClose={closeColorPanel} />
        )}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'left' }) && "bg-accent text-accent-foreground")}
      >
        <AlignLeft size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'center' }) && "bg-accent text-accent-foreground")}
      >
        <AlignCenter size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'right' }) && "bg-accent text-accent-foreground")}
      >
        <AlignRight size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={triggerImageUpload}
        className="h-8 w-8 p-0"
        title="Upload Image"
      >
        <ImageIcon size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Table Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Table options">
            <TableIcon size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon className="mr-2 h-4 w-4" /> Insert Table 3x3
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()} disabled={!editor.can().addColumnBefore()}>
            <Columns className="mr-2 h-4 w-4" /> Add Column Before
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()}>
            <Columns className="mr-2 h-4 w-4" /> Add Column After
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Column
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()} disabled={!editor.can().addRowBefore()}>
            <Rows className="mr-2 h-4 w-4" /> Add Row Before
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}>
            <Rows className="mr-2 h-4 w-4" /> Add Row After
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Row
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} className="text-destructive focus:text-destructive font-bold">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-accent text-accent-foreground")}
      >
        <List size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-accent text-accent-foreground")}
      >
        <ListOrdered size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
        className={cn("h-8 w-8 p-0", editor.isActive('blockquote') && "bg-accent text-accent-foreground")}
      >
        <Quote size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="h-8 w-8 p-0"
        title="Horizontal Rule"
      >
        <Minus size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={setLink}
        className={cn("h-8 w-8 p-0", editor.isActive('link') && "bg-accent text-accent-foreground")}
        title="Insert Link"
      >
        <LinkIcon size={16} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); }}
        className="h-8 w-8 p-0"
        title="Clear Format"
      >
        <Eraser size={16} />
      </Button>

      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="h-8 w-8 p-0"
      >
        <Undo size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="h-8 w-8 p-0"
      >
        <Redo size={16} />
      </Button>
    </div>
  );
};

export function WysiwygEditor({ value, onChange, title, readOnly }: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      FontFamily,
      FontSize.configure({ types: ['textStyle', 'heading', 'paragraph', 'listItem', 'blockquote'] }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto border-2 border-primary/10 shadow-lg my-4 cursor-pointer hover:scale-[1.01] transition-transform',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'min-w-full border-collapse border border-border my-4 shadow-sm rounded-lg overflow-hidden',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-border hover:bg-muted/50 transition-colors',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'bg-muted/30 font-bold p-2 text-left border-r border-border last:border-r-0',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'p-2 border-r border-border last:border-r-0 align-top',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer font-medium',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      if (!readOnly) onChange(editor.getHTML());
    },
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'wysiwyg-content focus:outline-none min-h-[150px] max-h-[400px] overflow-y-auto p-4 bg-card text-foreground',
      },
    },
  });

  // Keep editor content in sync with props while avoiding selection resets
  useEffect(() => {
    if (!editor) return;

    const currentHTML = editor.getHTML();
    // Only update the editor if the prop value is actually different AND
    // the change didn't originate from the editor itself (not focused)
    if (value !== currentHTML && !editor.isFocused && value !== undefined) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm ring-1 ring-border mt-1 transition-all focus-within:ring-primary/50 focus-within:border-primary">
      {!readOnly && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/5 border-t text-[10px] text-muted-foreground">
        <span className="font-bold uppercase tracking-wider">{title} Editor</span>
        <div className="flex gap-2 font-mono">
          <span>{editor ? editor.getText().length : 0} characters</span>
        </div>
      </div>
    </div>
  );
}
