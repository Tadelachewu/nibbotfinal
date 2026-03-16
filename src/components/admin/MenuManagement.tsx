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
  ChevronDown, 
  Save, 
  X, 
  MessageSquare,
  Menu as MenuIcon,
  FolderPlus,
  Loader2,
  Search,
  ChevronRight,
  ListTree
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/dialog";
import { WysiwygEditor } from './WysiwygEditor';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { adminContentTranslator } from '@/ai/flows/admin-content-translator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [browserExpanded, setBrowserExpanded] = useState<Set<string>>(new Set(['root']));
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMenus(getStoredMenus());
  }, []);

  const refresh = () => setMenus(getStoredMenus());

  const handleAdd = (parentId: string | null = null) => {
    const newItem = addMenu({
      name: parentId ? 'New Sub Menu' : 'New Main Menu',
      parentId,
      content: '<p>Enter your response message here...</p>',
      order: menus.filter(m => m.parentId === parentId).length,
      attachedMenuIds: []
    });
    refresh();
    handleStartEdit(newItem);
    if (parentId) {
      setExpandedFolders(prev => new Set([...prev, parentId]));
    }
  };

  const handleStartEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setEditForm({ ...menu, attachedMenuIds: menu.attachedMenuIds || [] });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editingId && editForm) {
      setIsSaving(true);
      try {
        const updatedForm = { ...editForm };
        
        // Background AI Localization (System handles Amharic automatically)
        if (editForm.name) {
          try {
            const res = await adminContentTranslator({ 
              content: editForm.name, 
              targetLanguage: 'Amharic' 
            });
            updatedForm.nameAm = res.translatedContent;
          } catch (e) {
            console.error("Localization failed", e);
          }
        }
        
        if (editForm.content) {
          try {
            const res = await adminContentTranslator({ 
              content: editForm.content, 
              targetLanguage: 'Amharic' 
            });
            updatedForm.contentAm = res.translatedContent;
          } catch (e) {
            console.error("Localization failed", e);
          }
        }

        updateMenu(editingId, updatedForm);
        setIsEditDialogOpen(false);
        setEditingId(null);
        refresh();
        toast({ title: "Saved", description: "Menu updated and localized in background." });
      } catch (error) {
        toast({ title: "Save Error", description: "Could not save menu item.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMenu(itemToDelete);
      refresh();
      if (editingId === itemToDelete) {
        setEditingId(null);
        setIsEditDialogOpen(false);
      }
      setItemToDelete(null);
      toast({ title: "Deleted", description: "Menu removed successfully." });
    }
  };

  const toggleFolder = (id: string, state: 'main' | 'browser') => {
    const set = state === 'main' ? expandedFolders : browserExpanded;
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    
    if (state === 'main') setExpandedFolders(next);
    else setBrowserExpanded(next);
  };

  const toggleAttachment = (id: string) => {
    const currentIds = editForm.attachedMenuIds || [];
    const newIds = currentIds.includes(id) 
      ? currentIds.filter(mid => mid !== id) 
      : [...currentIds, id];
    setEditForm({ ...editForm, attachedMenuIds: newIds });
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
                    onClick={() => toggleFolder(item.id, 'main')} 
                    className={cn(
                      "text-muted-foreground hover:text-primary shrink-0 transition-transform",
                      !hasChildren && "opacity-0 cursor-default",
                      expandedFolders.has(item.id) ? 'rotate-0' : '-rotate-90'
                    )}
                    disabled={!hasChildren}
                  >
                    <ChevronDown size={14} />
                  </button>
                  
                  <MenuIcon size={16} className="text-primary shrink-0 opacity-70" />
                  
                  <div className="flex flex-col min-w-0">
                    <span className={`truncate text-sm font-medium ${editingId === item.id ? 'text-primary' : 'text-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id)}>
                          <FolderPlus size={14} />
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

  const renderBrowserTree = (parentId: string | null = null, level = 0) => {
    const items = menus
      .filter(m => m.parentId === parentId && m.id !== editingId)
      .filter(m => searchQuery === '' || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.order - b.order);

    if (items.length === 0) return null;

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-6 border-l pl-3' : ''}`}>
        {items.map(item => {
          const hasChildren = menus.some(m => m.parentId === item.id);
          const isSelected = editForm.attachedMenuIds?.includes(item.id);

          return (
            <div key={item.id} className="space-y-1">
              <div 
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md transition-all cursor-pointer hover:bg-muted/50",
                  isSelected && "bg-primary/5 ring-1 ring-primary/10"
                )}
                onClick={() => toggleAttachment(item.id)}
              >
                <div className="flex items-center gap-1 shrink-0">
                  {hasChildren && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(item.id, 'browser');
                      }}
                      className={cn(
                        "text-muted-foreground transition-transform",
                        browserExpanded.has(item.id) ? 'rotate-0' : '-rotate-90'
                      )}
                    >
                      <ChevronDown size={14} />
                    </button>
                  )}
                  {!hasChildren && <div className="w-4" />}
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleAttachment(item.id)}
                    className="h-4 w-4 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={cn("text-xs font-medium truncate", isSelected && "text-primary")}>
                    {item.name}
                  </span>
                </div>
              </div>
              {browserExpanded.has(item.id) && renderBrowserTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <div>
            <CardTitle className="text-xl">Menu Hierarchy</CardTitle>
            <p className="text-sm text-muted-foreground">Define your conversational structure</p>
          </div>
          <Button onClick={() => handleAdd(null)} className="gap-2">
            <Plus size={16} /> Add Main Menu
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {menus.length > 0 ? (
            <div className="bg-white rounded-lg border p-4">
              {renderTree(null)}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/10 rounded-lg border-2 border-dashed flex flex-col items-center">
              <MessageSquare size={48} className="text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No menus defined</h3>
              <p className="text-muted-foreground mb-6">Create your first Main Menu to get started</p>
              <Button onClick={() => handleAdd(null)} variant="outline">
                Create Main Menu
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 border-b bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={18} className="text-primary" />
              Edit {editForm.parentId ? 'Sub Menu' : 'Main Menu'}: {editForm.name}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Label htmlFor="item-name" className="text-sm font-semibold">Menu Button Text (English)</Label>
                  <Input 
                    id="item-name" 
                    value={editForm.name || ''} 
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="e.g., Get Support, View Pricing"
                    className="max-w-md"
                  />
                  <p className="text-[10px] text-muted-foreground italic">System will automatically handle Amharic localization.</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Chat Response Content (English)</Label>
                  <WysiwygEditor 
                    title={editForm.name || ''}
                    value={editForm.content || ''} 
                    onChange={(val) => setEditForm({ ...editForm, content: val })} 
                  />
                </div>
              </div>

              <div className="pt-8 border-t">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ListTree size={16} className="text-primary" />
                      Attach Follow-up Sub-menus
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Browse all menus to select which buttons appear after this message.</p>
                  </div>
                  <div className="relative max-w-[240px]">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search sub-menus..." 
                      className="pl-8 h-9 text-xs" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-4 min-h-[200px]">
                  {renderBrowserTree(null)}
                  {menus.length <= 1 && (
                    <div className="py-12 text-center text-muted-foreground text-xs italic">
                      No other menus available to attach. Create more menus first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-white flex shrink-0 sm:justify-end gap-2 sticky bottom-0 z-20 shadow-2xl">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="px-6 h-11">
              <X size={16} className="mr-2" /> Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={isSaving}
              className="px-8 bg-primary hover:bg-primary/90 text-white min-w-[200px] h-11"
            >
              {isSaving ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Saving & Localizing...</>
              ) : (
                <><Save size={16} className="mr-2" /> Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this menu?</AlertDialogTitle>
            <AlertDialogDescription>
              "{menus.find(m => m.id === itemToDelete)?.name}" and all its nested children will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
