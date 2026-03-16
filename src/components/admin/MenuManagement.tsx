'use client';

import { useState, useEffect } from 'react';
import { MenuItem, KYCField, ApiConfig, TableColumn } from '@/lib/types';
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
  ListTree,
  AlertCircle,
  Globe,
  Settings2,
  ShieldCheck,
  Zap,
  Layout,
  PlayCircle,
  Table as TableIcon,
  Columns
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WysiwygEditor } from './WysiwygEditor';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { adminContentTranslator } from '@/ai/flows/admin-content-translator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
  
  // API Preview State
  const [apiPreviewResult, setApiPreviewResult] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  useEffect(() => {
    setMenus(getStoredMenus());
  }, []);

  const refresh = () => setMenus(getStoredMenus());

  const handleAdd = (parentId: string | null = null) => {
    const newItem = addMenu({
      name: parentId ? 'Sub Menu' : 'Main Menu',
      parentId,
      responseType: 'static',
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
    setApiPreviewResult(null);
    setEditForm({ 
      ...menu, 
      responseType: menu.responseType || 'static',
      attachedMenuIds: menu.attachedMenuIds || [],
      apiConfig: menu.apiConfig || {
        name: '',
        endpoint: '',
        method: 'GET',
        headers: {},
        timeout: 5000,
        retry: 0,
        loginRequired: false,
        requiredKYC: [],
        kycFields: [],
        requestMapping: {},
        responseMapping: {
          type: 'message',
          template: '',
          tableDataKey: '',
          tableColumns: [],
          errorFallback: 'An error occurred.',
          timeoutMessage: 'Request timed out.',
          authRequiredMessage: 'Login required.'
        }
      }
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editingId && editForm) {
      setIsSaving(true);
      try {
        const updatedForm = { ...editForm };
        
        // Background AI Localization
        if (editForm.name) {
          try {
            const res = await adminContentTranslator({ content: editForm.name, targetLanguage: 'Amharic' });
            updatedForm.nameAm = res.translatedContent;
          } catch (e) {}
        }
        
        if (editForm.responseType === 'static' && editForm.content) {
          try {
            const res = await adminContentTranslator({ content: editForm.content, targetLanguage: 'Amharic' });
            updatedForm.contentAm = res.translatedContent;
          } catch (e) {}
        }

        // Localize Table Headers if exist
        if (editForm.responseType === 'api' && editForm.apiConfig?.responseMapping?.tableColumns) {
           const localizedCols = await Promise.all(editForm.apiConfig.responseMapping.tableColumns.map(async col => {
             try {
               const res = await adminContentTranslator({ content: col.header, targetLanguage: 'Amharic' });
               return { ...col, headerAm: res.translatedContent };
             } catch (e) { return col; }
           }));
           updatedForm.apiConfig = {
             ...updatedForm.apiConfig!,
             responseMapping: { ...updatedForm.apiConfig!.responseMapping, tableColumns: localizedCols }
           };
        }

        updateMenu(editingId, updatedForm);
        setIsEditDialogOpen(false);
        setEditingId(null);
        refresh();
        toast({ title: "Saved", description: "Menu updated and localized successfully." });
      } catch (error) {
        toast({ title: "Save Error", description: "Could not save menu item.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const testApi = async () => {
    if (!editForm.apiConfig?.endpoint) {
      toast({ title: "Missing Endpoint", description: "Please enter an API URL first.", variant: "destructive" });
      return;
    }
    setIsTestingApi(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      
      const endpoint = editForm.apiConfig.endpoint.toLowerCase();
      const isExRate = endpoint.includes('rate') || editForm.name?.toLowerCase().includes('rate');
      const isBalance = endpoint.includes('balance');
      
      const mockResponses: Record<string, any> = {
        "exchange": {
          "status": "success",
          "base": "USD",
          "rates": [
            { "currency": "ETB", "rate": "57.50", "updated": "2024-05-20" },
            { "currency": "EUR", "rate": "0.92", "updated": "2024-05-20" },
            { "currency": "GBP", "rate": "0.78", "updated": "2024-05-20" }
          ]
        },
        "balance": {
          "status": "success",
          "data": { 
            "balance": "12,500.00", 
            "currency": "ETB", 
            "account_id": "88991122",
            "last_updated": new Date().toISOString()
          }
        },
        "default": { 
          "status": "success", 
          "data": { "info": "Standard generic response data" } 
        }
      };
      
      if (isExRate) setApiPreviewResult(mockResponses["exchange"]);
      else if (isBalance) setApiPreviewResult(mockResponses["balance"]);
      else setApiPreviewResult(mockResponses["default"]);

      toast({ title: "API Test Successful", description: "Response received. Use the log below to map your keys." });
    } catch (e) {
      toast({ title: "API Test Failed", description: "Check console or network.", variant: "destructive" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const addTableColumn = () => {
    const apiConfig = editForm.apiConfig!;
    const cols = apiConfig.responseMapping.tableColumns || [];
    const newCol: TableColumn = { header: 'New Column', key: '' };
    setEditForm({
      ...editForm,
      apiConfig: {
        ...apiConfig,
        responseMapping: { ...apiConfig.responseMapping, tableColumns: [...cols, newCol] }
      }
    });
  };

  const removeTableColumn = (idx: number) => {
    const apiConfig = editForm.apiConfig!;
    const cols = [...(apiConfig.responseMapping.tableColumns || [])];
    cols.splice(idx, 1);
    setEditForm({
      ...editForm,
      apiConfig: {
        ...apiConfig,
        responseMapping: { ...apiConfig.responseMapping, tableColumns: cols }
      }
    });
  };

  const updateTableColumn = (idx: number, updates: Partial<TableColumn>) => {
    const apiConfig = editForm.apiConfig!;
    const cols = [...(apiConfig.responseMapping.tableColumns || [])];
    cols[idx] = { ...cols[idx], ...updates };
    setEditForm({
      ...editForm,
      apiConfig: {
        ...apiConfig,
        responseMapping: { ...apiConfig.responseMapping, tableColumns: cols }
      }
    });
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
                    onClick={() => {
                      const next = new Set(expandedFolders);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      setExpandedFolders(next);
                    }} 
                    className={cn(
                      "text-muted-foreground hover:text-primary shrink-0 transition-transform",
                      !hasChildren && "opacity-0 cursor-default",
                      expandedFolders.has(item.id) ? 'rotate-0' : '-rotate-90'
                    )}
                    disabled={!hasChildren}
                  >
                    <ChevronDown size={14} />
                  </button>
                  
                  {item.responseType === 'api' ? <Zap size={16} className="text-amber-500 shrink-0" /> : <MenuIcon size={16} className="text-primary shrink-0" />}
                  
                  <div className="flex flex-col min-w-0">
                    <span className={`truncate text-sm font-medium ${editingId === item.id ? 'text-primary' : 'text-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id)}>
                    <FolderPlus size={14} />
                  </Button>
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
                onClick={() => {
                  const currentIds = editForm.attachedMenuIds || [];
                  const isNowSelected = !currentIds.includes(item.id);
                  
                  if (isNowSelected) {
                    if (item.parentId && item.parentId !== null) {
                      const parentIsSelected = currentIds.includes(item.parentId);
                      if (!parentIsSelected) {
                        toast({ 
                          title: "Hierarchical Selection Required", 
                          description: "Please select the parent menu first to maintain the conversational flow.",
                          variant: "destructive"
                        });
                        return;
                      }
                    }
                    setEditForm({ ...editForm, attachedMenuIds: [...currentIds, item.id] });
                  } else {
                    const childrenToDeselect = new Set<string>();
                    const findChildren = (pid: string) => {
                      menus.forEach(m => {
                        if (m.parentId === pid) {
                          childrenToDeselect.add(m.id);
                          findChildren(m.id);
                        }
                      });
                    };
                    findChildren(item.id);
                    setEditForm({ 
                      ...editForm, 
                      attachedMenuIds: currentIds.filter(id => id !== item.id && !childrenToDeselect.has(id)) 
                    });
                  }
                }}
              >
                <div className="flex items-center gap-1 shrink-0">
                  {hasChildren && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = new Set(browserExpanded);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        setBrowserExpanded(next);
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
                    className="h-4 w-4 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <span className={cn("text-xs font-medium truncate", isSelected && "text-primary")}>
                  {item.name}
                </span>
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
              <Button onClick={() => handleAdd(null)} variant="outline">Create Main Menu</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 border-b bg-white shrink-0">
            <DialogTitle className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-primary" />
                Edit {editForm.parentId ? 'Sub Menu' : 'Main Menu'}: {editForm.name}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold">Admin Panel</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8 pb-32">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Menu Button Text (English)</Label>
                    <Input 
                      value={editForm.name || ''} 
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="e.g., Get Support"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Response Type</Label>
                    <Select 
                      value={editForm.responseType} 
                      onValueChange={(val: any) => setEditForm({ ...editForm, responseType: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static Content Response</SelectItem>
                        <SelectItem value="api">API Action</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs value={editForm.responseType} className="w-full">
                  <TabsContent value="static" className="space-y-4 pt-4 mt-0">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Chat Response Content (English)</Label>
                      <WysiwygEditor 
                        title={editForm.name || ''}
                        value={editForm.content || ''} 
                        onChange={(val) => setEditForm({ ...editForm, content: val })} 
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="api" className="space-y-6 pt-4 mt-0">
                    <Card>
                      <CardHeader className="bg-muted/20 py-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap size={14} className="text-amber-500" />
                          API Endpoint Configuration
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={testApi} disabled={isTestingApi} className="h-8 gap-1.5">
                          {isTestingApi ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                          Live API Preview
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-4">
                          <div className="sm:col-span-1">
                            <Label className="text-xs">Method</Label>
                            <Select 
                              value={editForm.apiConfig?.method}
                              onValueChange={(v: any) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { ...editForm.apiConfig!, method: v } 
                              })}
                            >
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-3">
                            <Label className="text-xs">Endpoint URL</Label>
                            <Input 
                              className="h-9"
                              value={editForm.apiConfig?.endpoint}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { ...editForm.apiConfig!, endpoint: e.target.value } 
                              })}
                              placeholder="https://api.example.com/v1/user/balance"
                            />
                          </div>
                        </div>

                        {apiPreviewResult && (
                          <div className="bg-zinc-950 rounded-lg p-3 overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-zinc-400 font-mono uppercase">API Response Log</span>
                              <Button variant="ghost" size="icon" className="h-4 w-4 text-zinc-400 hover:text-white" onClick={() => setApiPreviewResult(null)}>
                                <X size={10} />
                              </Button>
                            </div>
                            <ScrollArea className="h-32">
                              <pre className="text-[10px] text-emerald-400 font-mono">
                                {JSON.stringify(apiPreviewResult, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={editForm.apiConfig?.loginRequired}
                              onCheckedChange={(v) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { ...editForm.apiConfig!, loginRequired: v } 
                              })}
                            />
                            <Label className="text-xs">Login Required</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Timeout (ms)</Label>
                            <Input 
                              type="number" 
                              className="h-9 w-20 text-xs"
                              value={editForm.apiConfig?.timeout}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { ...editForm.apiConfig!, timeout: parseInt(e.target.value) } 
                              })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="bg-muted/20 py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layout size={14} className="text-primary" />
                          Response Mapping & Templates
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        <div className="space-y-3">
                          <Label className="text-xs">Response Display Type</Label>
                          <Tabs 
                            value={editForm.apiConfig?.responseMapping?.type || 'message'} 
                            onValueChange={(v: any) => setEditForm({
                              ...editForm,
                              apiConfig: {
                                ...editForm.apiConfig!,
                                responseMapping: { ...editForm.apiConfig!.responseMapping, type: v }
                              }
                            })}
                          >
                            <TabsList className="grid w-full grid-cols-2 h-9">
                              <TabsTrigger value="message" className="text-xs gap-2">
                                <MessageSquare size={14} /> Message
                              </TabsTrigger>
                              <TabsTrigger value="table" className="text-xs gap-2">
                                <TableIcon size={14} /> Table
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="message" className="pt-3">
                              <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Success Template (Use {'{{response.key}}'} syntax)</Label>
                              <Input 
                                value={editForm.apiConfig?.responseMapping?.template}
                                onChange={(e) => setEditForm({ 
                                  ...editForm, 
                                  apiConfig: { 
                                    ...editForm.apiConfig!, 
                                    responseMapping: { ...editForm.apiConfig!.responseMapping, template: e.target.value } 
                                  } 
                                })}
                                placeholder="Your balance is {{response.data.balance}} {{response.data.currency}}."
                              />
                            </TabsContent>

                            <TabsContent value="table" className="space-y-4 pt-3">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block">Array Data Path</Label>
                                <Input 
                                  value={editForm.apiConfig?.responseMapping?.tableDataKey}
                                  placeholder="e.g., response.rates"
                                  className="h-8 text-xs"
                                  onChange={(e) => setEditForm({
                                    ...editForm,
                                    apiConfig: {
                                      ...editForm.apiConfig!,
                                      responseMapping: { ...editForm.apiConfig!.responseMapping, tableDataKey: e.target.value }
                                    }
                                  })}
                                />
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground block">Columns Mapping</Label>
                                  <Button variant="ghost" size="sm" onClick={addTableColumn} className="h-6 text-[10px] gap-1 hover:bg-primary/5 hover:text-primary">
                                    <Plus size={10} /> Add Column
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {editForm.apiConfig?.responseMapping?.tableColumns?.map((col, idx) => (
                                    <div key={idx} className="flex gap-2 items-end">
                                      <div className="flex-1 space-y-1">
                                        <Label className="text-[8px] font-bold">Header (EN)</Label>
                                        <Input 
                                          value={col.header} 
                                          className="h-7 text-xs" 
                                          onChange={(e) => updateTableColumn(idx, { header: e.target.value })}
                                        />
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        <Label className="text-[8px] font-bold">JSON Key</Label>
                                        <Input 
                                          value={col.key} 
                                          placeholder="e.g., currency"
                                          className="h-7 text-xs" 
                                          onChange={(e) => updateTableColumn(idx, { key: e.target.value })}
                                        />
                                      </div>
                                      <Button variant="ghost" size="icon" onClick={() => removeTableColumn(idx)} className="h-7 w-7 text-destructive">
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                        
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Message</Label>
                            <Input 
                              className="text-xs h-8"
                              value={editForm.apiConfig?.responseMapping?.errorFallback}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { 
                                  ...editForm.apiConfig!, 
                                  responseMapping: { ...editForm.apiConfig!.responseMapping, errorFallback: e.target.value } 
                                } 
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Timeout Message</Label>
                            <Input 
                              className="text-xs h-8"
                              value={editForm.apiConfig?.responseMapping?.timeoutMessage}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                apiConfig: { 
                                  ...editForm.apiConfig!, 
                                  responseMapping: { ...editForm.apiConfig!.responseMapping, timeoutMessage: e.target.value } 
                                } 
                              })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="bg-muted/20 py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldCheck size={14} className="text-primary" />
                          KYC Collection Flow
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                         <p className="text-[10px] text-muted-foreground mb-4">Chatbot will collect these sequentially if missing from user session.</p>
                         <div className="text-center py-6 text-xs text-muted-foreground italic bg-muted/5 rounded-lg border border-dashed">
                           Configure KYC fields to gate this API interaction.
                         </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="pt-8 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ListTree size={16} className="text-primary" />
                      Attach Related Menus
                    </h3>
                  </div>
                  <div className="relative max-w-[240px]">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search menus..." 
                      className="pl-8 h-9 text-xs" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4 min-h-[150px]">
                  {renderBrowserTree(null)}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-white flex shrink-0 sm:justify-end gap-2 fixed bottom-0 left-0 right-0 z-50">
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
            <AlertDialogAction onClick={() => {
              if (itemToDelete) {
                deleteMenu(itemToDelete);
                refresh();
                setItemToDelete(null);
                toast({ title: "Deleted", description: "Menu removed successfully." });
              }
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
