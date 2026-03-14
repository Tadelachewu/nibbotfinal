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
  Languages, 
  MessageSquare,
  Info,
  Menu as MenuIcon,
  FolderPlus
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
} from "@/components/ui/dialog";
import { WysiwygEditor } from './WysiwygEditor';
import { adminContentTranslator } from '@/ai/flows/admin-content-translator';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

export function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    setMenus(getStoredMenus());
  }, []);

  const refresh = () => setMenus(getStoredMenus());

  const handleAdd = (parentId: string | null = null) => {
    const newItem = addMenu({
      name: parentId ? 'New Sub Menu' : 'New Main Menu',
      parentId,
      content: '<p>Enter your response message here...</p>',
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
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm) {
      updateMenu(editingId, editForm);
      setIsEditDialogOpen(false);
      setEditingId(null);
      refresh();
      toast({ title: "Saved", description: "Menu updated successfully." });
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
      toast({ title: "Translated", description: `Content translated to ${lang}` });
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

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <div>
            <CardTitle className="text-xl">Menu Hierarchy</CardTitle>
            <p className="text-sm text-muted-foreground">Manage your chatbot's conversational structure</p>
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
              <h3 className="text-lg font-medium">Your tree is empty</h3>
              <p className="text-muted-foreground mb-6">Start by adding your first Main Menu item</p>
              <Button onClick={() => handleAdd(null)} variant="outline">
                Create Main Menu
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified Editor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b bg-muted/5">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={18} className="text-primary" />
              Editing: {editForm.name}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="item-name">Display Name</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={14} className="text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>This text appears on the button the user clicks.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input 
                    id="item-name" 
                    value={editForm.name || ''} 
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="e.g., Billing Questions"
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
                  <Label>Bot Response (Rich Text/HTML)</Label>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Message Body</span>
                </div>
                <WysiwygEditor 
                  title={editForm.name || ''}
                  value={editForm.content || ''} 
                  onChange={(val) => setEditForm({ ...editForm, content: val })} 
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-muted/5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>
              <X size={16} className="mr-2" /> Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-primary hover:bg-primary/90 text-white min-w-[120px]">
              <Save size={16} className="mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{menus.find(m => m.id === itemToDelete)?.name}" and all of its nested sub-menus. This action cannot be undone.
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
