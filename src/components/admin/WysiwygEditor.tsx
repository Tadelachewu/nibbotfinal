
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
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
            parseHTML: (element: any) => element.style?.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: any) => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
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
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Baseline,
  Eraser,
  Minus,
  Highlighter,
  Image as ImageIcon,
  ChevronDown,
  Monitor,
  CaseSensitive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  title: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const setLink = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const textColors = [
    { name: 'Logo Brown', value: '#763717' },
    { name: 'Logo Gold', value: '#F4A61B' },
    { name: 'Logo White', value: '#FFFFFF' },
    { name: 'Default', value: 'inherit' },
    { name: 'Deep Black', value: '#000000' },
    { name: 'Royal Blue', value: '#2563eb' },
    { name: 'Emerald Green', value: '#059669' },
    { name: 'Vibrant Red', value: '#dc2626' },
    { name: 'Amethyst Purple', value: '#7c3aed' },
    { name: 'Slate Gray', value: '#475569' },
    { name: 'Terracotta', value: '#c2410c' },
    { name: 'Teal', value: '#0d9488' },
  ];

  const fontSizes = [
    '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px', '64px'
  ];

  const fontFamilies = [
    { name: 'Sans Serif', value: 'Inter, ui-sans-serif, system-ui' },
    { name: 'Serif', value: 'Georgia, serif' },
    { name: 'Monospace', value: 'ui-monospace, SFMono-Regular, "JetBrains Mono", monospace' },
    { name: 'Display', value: '"Clash Display", sans-serif' },
    { name: 'Modern', value: 'Roboto, sans-serif' },
  ];

  const highlightColors = [
    { name: 'Logo Gold', value: '#F4A61B' },
    { name: 'Logo Brown', value: '#763717' },
    { name: 'Logo White', value: '#FFFFFF' },
    { name: 'Nib Gold Glow', value: '#fef3c7' },
    { name: 'Soft Mint', value: '#dcfce7' },
    { name: 'Sky Blue', value: '#dbeafe' },
    { name: 'Rose Petal', value: '#ffe4e6' },
    { name: 'Lavender', value: '#f3e8ff' },
    { name: 'Orange Peel', value: '#ffedd5' },
    { name: 'Cyan Breeze', value: '#cffafe' },
    { name: 'Lime Zest', value: '#f0fdf4' },
  ];

  const addImage = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
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
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-accent text-accent-foreground")}
      >
        <Bold size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-accent text-accent-foreground")}
      >
        <Italic size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('underline') && "bg-accent text-accent-foreground")}
      >
        <UnderlineIcon size={16} />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Text Color"
          >
            <Baseline size={16} style={{ color: editor.getAttributes('textStyle').color }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Text Color</Label>
          <div className="grid grid-cols-4 gap-2">
            {textColors.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  if (c.value === 'inherit') {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(c.value).run();
                  }
                }}
                className={cn(
                  "h-8 w-full rounded border border-muted hover:scale-110 transition-transform shadow-sm relative group",
                  (editor.getAttributes('textStyle').color === c.value) && "ring-2 ring-primary ring-offset-2"
                )}
                style={{ backgroundColor: c.value === 'inherit' ? 'white' : c.value }}
                title={c.name}
              >
                {c.value === 'inherit' && <Eraser size={10} className="absolute inset-0 m-auto text-muted-foreground" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-3 mt-3 border-t">
            <input 
              type="color" 
              className="w-8 h-8 rounded border cursor-pointer bg-white p-0.5"
              onInput={(e: any) => editor.chain().focus().setColor(e.target.value).run()}
              title="Custom Color"
            />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Custom Color</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3 h-8 text-[10px] uppercase font-bold text-destructive hover:text-destructive"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            Reset Color
          </Button>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Highlight Color"
          >
            <Highlighter size={16} style={{ backgroundColor: editor.getAttributes('highlight').color }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Highlight Color</Label>
          <div className="grid grid-cols-4 gap-2">
            {highlightColors.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                className={cn(
                  "h-8 w-full rounded border border-muted hover:scale-110 transition-transform shadow-sm",
                  editor.isActive('highlight', { color: c.value }) && "ring-2 ring-primary ring-offset-2"
                )}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-3 mt-3 border-t">
            <input 
              type="color" 
              className="w-8 h-8 rounded border cursor-pointer bg-transparent"
              onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
              title="Custom Highlight"
            />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Custom Color</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3 h-8 text-[10px] uppercase font-bold text-destructive hover:text-destructive"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            Clear Highlight
          </Button>
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'left' }) && "bg-accent text-accent-foreground")}
      >
        <AlignLeft size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'center' }) && "bg-accent text-accent-foreground")}
      >
        <AlignCenter size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'right' }) && "bg-accent text-accent-foreground")}
      >
        <AlignRight size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={addImage}
        className="h-8 w-8 p-0"
        title="Insert Image"
      >
        <ImageIcon size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-accent text-accent-foreground")}
      >
        <List size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-accent text-accent-foreground")}
      >
        <ListOrdered size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
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
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
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

export function WysiwygEditor({ value, onChange, title }: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto border-2 border-primary/10 shadow-lg my-4 cursor-pointer hover:scale-[1.01] transition-transform',
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
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'wysiwyg-content focus:outline-none min-h-[150px] max-h-[400px] overflow-y-auto p-4 bg-white',
      },
    },
  });

  // Keep editor content in sync with props if changed externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-border mt-1 transition-all focus-within:ring-primary/50 focus-within:border-primary">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/5 border-t text-[10px] text-muted-foreground">
        <span className="font-bold uppercase tracking-wider">{title} Editor</span>
        <div className="flex gap-2 font-mono">
          <span>{editor?.getCharacterCount()} characters</span>
        </div>
      </div>
    </div>
  );
}

