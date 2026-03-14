'use client';

import { useState, useEffect } from 'react';
import { MenuItem } from '@/lib/types';
import { getStoredMenus, addMenu, updateMenu, deleteMenu } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown, 
  Save, 
  X, 
  Languages, 
  MessageSquare,
  Info,
  Menu as MenuIcon
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WysiwygEditor } from './WysiwygEditor';
import { adminContentTranslator } from '@/ai/flows/admin-content-translator';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    setMenus(getStoredMenus());
  }, []);

  const refresh = () => setMenus(getStoredMenus());

  const handleAdd = (parentId: string | null = null) => {
    const newItem = addMenu({
      name: `New ${parentId ? 'Sub' : 'Main'} Menu`,
      parentId,
      content: '<p>Enter content for this menu item...</p>',
      order: menus.filter(m => m.parentId === parentId).length
    });
    refresh();
    handleStartEdit(newItem);
    if (parentId) {
      setExpandedFolders(prev => new Set([...prev, parentId]));
    }
  };

  const handleStartEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setEditForm(menu);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm) {
      updateMenu(editingId, editForm);
      setEditingId(null);
      refresh();
      toast({ title: "Saved", description: "Menu updated successfully." });
    }
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMenu(itemToDelete);
      refresh();
      if (editingId === itemToDelete) setEditingId(null);
      setItemToDelete(null);
      toast({ title: "Deleted", description: "Menu and all its sub-menus removed." });
    }
  };

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const handleTranslate = async (lang: string) => {
    if (!editForm.content && !editForm.name) return;
    setIsTranslating(true);
    try {
      const nameTranslation = await adminContentTranslator({ content: editForm.name || '', targetLanguage: lang });
      const contentTranslation = editForm.content ? await adminContentTranslator({ content: editForm.content, targetLanguage: lang }) : { translatedContent: '' };
      
      setEditForm(prev => ({
        ...prev,
        name: nameTranslation.translatedContent,
        content: contentTranslation.translatedContent || prev.content
      }));
      toast({ title: "Translated", description: `Menu translated to ${lang}` });
    } catch (error) {
      toast({ variant: "destructive", title: "Translation Failed", description: "Could not translate content." });
    } finally {
      setIsTranslating(false);
    }
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    const items = menus
      .filter(m => m.parentId === parentId)
      .sort((a, b) => a.order - b.order);
      
    if (items.length === 0 && parentId !== null) return null;

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l pl-2 mt-1' : ''}`}>
        {items.map(item => {
          const hasChildren = menus.some(m => m.parentId === item.id);
          return (
            <div key={item.id} className="group">
              <div className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors ${editingId === item.id ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button 
                    onClick={() => toggleFolder(item.id)} 
                    className={`text-muted-foreground hover:text-primary shrink-0 transition-transform ${expandedFolders.has(item.id) ? 'rotate-0' : '-rotate-90'}`}
                  >
                    <ChevronDown size={14} />
                  </button>
                  
                  <MenuIcon size={16} className="text-primary shrink-0 opacity-70" />
                  
                  <span className={`truncate text-sm font-medium ${editingId === item.id ? 'text-primary' : 'text-foreground'}`}>
                    {item.name}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id)}>
                          <Plus size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add Sub Menu</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(item)}>
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItemToDelete(item.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {expandedFolders.has(item.id) && renderTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <Card className="lg:col-span-4 shadow-sm h-[calc(100vh-160px)] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <CardTitle className="text-lg font-bold">Menu Structure</CardTitle>
          <Button variant="outline" size="sm" onClick={() => handleAdd(null)} className="h-8 px-3 gap-1">
            <Plus size={14} /> Main Menu
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto pt-4 px-2">
          {renderTree(null)}
          {menus.length === 0 && (
            <div className="text-center py-10 text-muted-foreground italic text-sm">
              No menus found. Click "Main Menu" to start.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-8 shadow-sm h-[calc(100vh-160px)] overflow-hidden flex flex-col">
        <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {editingId ? `Editing: ${editForm.name}` : 'Menu Editor'}
            </CardTitle>
          </div>
          {editingId && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-9">
                <X size={16} className="mr-2" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="h-9 bg-accent hover:bg-accent/90 text-white shadow-md">
                <Save size={16} className="mr-2" /> Save Changes
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6">
          {editingId ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="item-name">Display Name</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={14} className="text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>The text shown on the button in the chat interface.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input 
                    id="item-name" 
                    value={editForm.name || ''} 
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="e.g., Billing Support"
                  />
                </div>
                <div className="space-y-2">
                  <Label>AI Translations</Label>
                  <div className="flex flex-wrap gap-1">
                    {['Spanish', 'French', 'Japanese', 'German'].map(lang => (
                      <Button 
                        key={lang} 
                        variant="outline" 
                        size="sm" 
                        disabled={isTranslating}
                        onClick={() => handleTranslate(lang)}
                        className="text-[10px] px-2 h-8"
                      >
                        <Languages size={10} className="mr-1" /> {lang}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message Content (HTML)</Label>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Bot Response</span>
                </div>
                <WysiwygEditor 
                  title={editForm.name || ''}
                  value={editForm.content || ''} 
                  onChange={(val) => setEditForm({ ...editForm, content: val })} 
                />
              </div>

              <div className="mt-4 p-4 border rounded-lg bg-muted/20">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Add Child Options</h4>
                <Button variant="outline" size="sm" onClick={() => handleAdd(editingId)} className="text-xs h-8">
                  <Plus size={14} className="mr-2" /> Create Sub Menu Item
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={40} className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">No Menu Selected</h3>
              <p className="text-muted-foreground max-w-xs text-sm">
                Select a menu item from the structure on the left to edit its response message and properties.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this menu item will also remove all its nested sub-menus. This action is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
