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
  Folder, 
  FileText, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown, 
  Save, 
  X, 
  Languages, 
  MessageSquare,
  FolderPlus,
  ArrowRight
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

  const handleAdd = (parentId: string | null = null, type: 'folder' | 'content' = 'content') => {
    const newItem = addMenu({
      name: `New ${type === 'folder' ? 'Menu' : 'Page'}`,
      parentId,
      type,
      content: type === 'content' ? '<p>Write something here...</p>' : undefined,
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
      toast({ title: "Saved", description: "Changes have been updated successfully." });
    }
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMenu(itemToDelete);
      refresh();
      if (editingId === itemToDelete) setEditingId(null);
      setItemToDelete(null);
      toast({ title: "Deleted", description: "Item and its children removed." });
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
      <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l pl-2' : ''}`}>
        {items.map(item => (
          <div key={item.id} className="group">
            <div className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors ${editingId === item.id ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.type === 'folder' ? (
                  <button onClick={() => toggleFolder(item.id)} className="text-muted-foreground hover:text-primary shrink-0">
                    {expandedFolders.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : <div className="w-4" />}
                
                {item.type === 'folder' ? (
                  <Folder size={16} className="text-primary shrink-0" />
                ) : (
                  <FileText size={16} className="text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-medium text-sm">{item.name}</span>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.type === 'folder' && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id, 'folder')} title="Add Sub-menu">
                      <FolderPlus size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id, 'content')} title="Add Page">
                      <Plus size={14} />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(item)} title="Edit">
                  <Edit2 size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItemToDelete(item.id)} title="Delete">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            {item.type === 'folder' && expandedFolders.has(item.id) && renderTree(item.id, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <Card className="lg:col-span-4 shadow-sm h-[calc(100vh-160px)] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <CardTitle className="text-lg font-bold">Menu Structure</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleAdd(null, 'folder')} className="h-8 px-2 gap-1 text-[11px]">
              <FolderPlus size={12} /> Menu
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAdd(null, 'content')} className="h-8 px-2 gap-1 text-[11px]">
              <Plus size={12} /> Page
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto pt-4 px-2">
          {renderTree(null)}
          {menus.length === 0 && (
            <div className="text-center py-10 text-muted-foreground italic text-sm">
              No items created yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-8 shadow-sm h-[calc(100vh-160px)] overflow-hidden flex flex-col">
        <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{editingId ? `Editing: ${editForm.name}` : 'Editor'}</CardTitle>
          </div>
          {editingId && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-9">
                <X size={16} className="mr-2" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="h-9 bg-accent hover:bg-accent/90 text-white">
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
                  <Label htmlFor="item-name">Display Name</Label>
                  <Input 
                    id="item-name" 
                    value={editForm.name || ''} 
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Enter menu label..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quick Translate (AI)</Label>
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

              {editForm.type === 'content' && (
                <div className="space-y-2">
                  <Label>Page Content</Label>
                  <WysiwygEditor 
                    title={editForm.name || ''}
                    value={editForm.content || ''} 
                    onChange={(val) => setEditForm({ ...editForm, content: val })} 
                  />
                </div>
              )}

              {editForm.type === 'folder' && (
                <div className="p-12 border-2 border-dashed rounded-lg text-center bg-muted/20">
                  <Folder className="mx-auto text-primary/40 mb-4" size={48} />
                  <p className="text-muted-foreground font-medium">This is a Menu Folder</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Folders act as navigation categories in the chat interface. 
                    Add sub-menus or pages inside this folder using the tree view on the left.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <MessageSquare size={64} className="mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium">No Item Selected</h3>
              <p className="text-muted-foreground max-w-xs text-sm">
                Select an item from the structure on the left to edit its properties or content.
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
              This action cannot be undone. This will permanently delete this item and all its sub-menus and pages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
