'use client';

import { useState, useEffect } from 'react';
import { MenuItem, KYCField, RequestParameter, TableColumn } from '@/lib/types';
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
  Globe,
  Settings2,
  ShieldCheck,
  Zap,
  Layout,
  PlayCircle,
  Table as TableIcon,
  Link2,
  Code2
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
    if (parentId) setExpandedFolders(prev => new Set([...prev, parentId]));
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
        kycFields: [],
        requestParameters: [],
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
        if (editForm.name) {
          const res = await adminContentTranslator({ content: editForm.name, targetLanguage: 'Amharic' });
          updatedForm.nameAm = res.translatedContent;
        }
        if (editForm.responseType === 'static' && editForm.content) {
          const res = await adminContentTranslator({ content: editForm.content, targetLanguage: 'Amharic' });
          updatedForm.contentAm = res.translatedContent;
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
      const response = await fetch(editForm.apiConfig.endpoint, {
        method: editForm.apiConfig.method,
        headers: editForm.apiConfig.headers,
      });
      if (response.ok) {
        const data = await response.json();
        setApiPreviewResult(data);
        toast({ title: "API Test Successful", description: "Response received from endpoint." });
      } else {
        throw new Error("Endpoint failed");
      }
    } catch (e) {
      toast({ title: "API Test Failed", description: "Could not reach endpoint.", variant: "destructive" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const getDetectedKeys = (obj: any, path = ''): string[] => {
    if (!obj) return [];
    let target = obj;
    if (path) {
      target = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
    if (Array.isArray(target) && target.length > 0) {
      target = target[0];
    }
    if (typeof target !== 'object' || target === null) return [];
    return Object.keys(target);
  };

  const addTableColumn = () => {
    const config = editForm.apiConfig!;
    const cols = config.responseMapping.tableColumns || [];
    setEditForm({
      ...editForm,
      apiConfig: {
        ...config,
        responseMapping: { ...config.responseMapping, tableColumns: [...cols, { header: 'New Column', key: '' }] }
      }
    });
  };

  const addRequestParameter = () => {
    const config = editForm.apiConfig!;
    const params = config.requestParameters || [];
    setEditForm({
      ...editForm,
      apiConfig: {
        ...config,
        requestParameters: [...params, { apiKey: '', sourceType: 'kyc', sourceValue: '' }]
      }
    });
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    const items = menus.filter(m => m.parentId === parentId).sort((a, b) => a.order - b.order);
    if (items.length === 0 && parentId !== null) return null;
    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l pl-2 mt-1' : ''}`}>
        {items.map(item => {
          const hasChildren = menus.some(m => m.parentId === item.id);
          return (
            <div key={item.id} className="group">
              <div className={cn("flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors", editingId === item.id && 'bg-primary/10 ring-1 ring-primary/30')}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button onClick={() => {
                    const next = new Set(expandedFolders);
                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                    setExpandedFolders(next);
                  }} className={cn("text-muted-foreground hover:text-primary shrink-0 transition-transform", !hasChildren && "opacity-0 cursor-default", expandedFolders.has(item.id) ? 'rotate-0' : '-rotate-90')} disabled={!hasChildren}>
                    <ChevronDown size={14} />
                  </button>
                  {item.responseType === 'api' ? <Zap size={16} className="text-amber-500 shrink-0" /> : <MenuIcon size={16} className="text-primary shrink-0" />}
                  <span className="truncate text-sm font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id)}><FolderPlus size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(item)}><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItemToDelete(item.id)}><Trash2 size={14} /></Button>
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
    const items = menus.filter(m => m.parentId === parentId && m.id !== editingId)
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
              <div className={cn("flex items-center gap-2 p-2 rounded-md transition-all cursor-pointer hover:bg-muted/50", isSelected && "bg-primary/5 ring-1 ring-primary/10")} onClick={() => {
                const currentIds = editForm.attachedMenuIds || [];
                if (!currentIds.includes(item.id)) {
                  if (item.parentId && !currentIds.includes(item.parentId)) {
                    toast({ title: "Selection Order", description: "Select the parent menu first.", variant: "destructive" });
                    return;
                  }
                  setEditForm({ ...editForm, attachedMenuIds: [...currentIds, item.id] });
                } else {
                  const toRemove = new Set([item.id]);
                  const findChilds = (pid: string) => menus.forEach(m => { if (m.parentId === pid) { toRemove.add(m.id); findChilds(m.id); } });
                  findChilds(item.id);
                  setEditForm({ ...editForm, attachedMenuIds: currentIds.filter(id => !toRemove.has(id)) });
                }
              }}>
                <Checkbox checked={isSelected} className="h-4 w-4 rounded-full" onClick={(e) => e.stopPropagation()} />
                <span className="text-xs font-medium">{item.name}</span>
              </div>
              {(browserExpanded.has(item.id) || isSelected) && renderBrowserTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <div><CardTitle>Menu Hierarchy</CardTitle></div>
          <Button onClick={() => handleAdd(null)}><Plus size={16} className="mr-2" /> Add Main Menu</Button>
        </CardHeader>
        <CardContent className="p-6">{renderTree(null)}</CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="flex items-center gap-2"><Settings2 size={18} /> Configure {editForm.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8 pb-20">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Menu Text (English)</Label>
                  <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select value={editForm.responseType} onValueChange={(v: any) => setEditForm({ ...editForm, responseType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="static">Static Response</SelectItem><SelectItem value="api">API Action</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              {editForm.responseType === 'static' ? (
                <WysiwygEditor title={editForm.name || ''} value={editForm.content || ''} onChange={v => setEditForm({ ...editForm, content: v })} />
              ) : (
                <div className="space-y-8">
                  <Card>
                    <CardHeader className="bg-muted/10 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">API Connectivity</CardTitle>
                      <Button variant="outline" size="sm" onClick={testApi} disabled={isTestingApi}>
                        {isTestingApi ? <Loader2 className="animate-spin" /> : <PlayCircle />} Live Preview
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex gap-4">
                        <Select value={editForm.apiConfig?.method} onValueChange={v => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, method: v as any } })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                        </Select>
                        <Input value={editForm.apiConfig?.endpoint} onChange={e => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, endpoint: e.target.value } })} placeholder="https://api.example.com/endpoint" />
                      </div>
                      {apiPreviewResult && (
                        <div className="bg-slate-950 p-3 rounded-md">
                          <span className="text-[10px] text-slate-400 font-mono">LATEST API RESPONSE:</span>
                          <ScrollArea className="h-32 mt-2"><pre className="text-[10px] text-emerald-400 font-mono">{JSON.stringify(apiPreviewResult, null, 2)}</pre></ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="bg-muted/10"><CardTitle className="text-sm">KYC & Parameter Mapping</CardTitle></CardHeader>
                    <CardContent className="p-4 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">1. Collected KYC Fields</Label>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const fields = editForm.apiConfig?.kycFields || [];
                            setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: [...fields, { id: Math.random().toString(36).substr(2, 9), name: '', prompt: '', type: 'text', order: fields.length }] } });
                          }}><Plus /> Add KYC</Button>
                        </div>
                        {editForm.apiConfig?.kycFields?.map((field, idx) => (
                          <div key={field.id} className="grid grid-cols-3 gap-2 p-2 border rounded-md">
                            <Input placeholder="Field Name (e.g. phone)" value={field.name} onChange={e => {
                              const fields = [...editForm.apiConfig!.kycFields];
                              fields[idx].name = e.target.value;
                              setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                            }} />
                            <Input className="col-span-2" placeholder="User Prompt" value={field.prompt} onChange={e => {
                              const fields = [...editForm.apiConfig!.kycFields];
                              fields[idx].prompt = e.target.value;
                              setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                            }} />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">2. API Request Mapping</Label>
                          <Button variant="ghost" size="sm" onClick={addRequestParameter}><Link2 /> Map Parameter</Button>
                        </div>
                        {editForm.apiConfig?.requestParameters?.map((param, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input placeholder="API Param Key" value={param.apiKey} onChange={e => {
                              const params = [...editForm.apiConfig!.requestParameters];
                              params[idx].apiKey = e.target.value;
                              setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, requestParameters: params } });
                            }} />
                            <Select value={param.sourceValue} onValueChange={v => {
                              const params = [...editForm.apiConfig!.requestParameters];
                              params[idx].sourceValue = v;
                              setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, requestParameters: params } });
                            }}>
                              <SelectTrigger><SelectValue placeholder="Source Field" /></SelectTrigger>
                              <SelectContent>
                                {editForm.apiConfig?.kycFields?.map(f => <SelectItem key={f.id} value={f.name}>KYC: {f.name}</SelectItem>)}
                                <SelectItem value="user.id">User ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="bg-muted/10"><CardTitle className="text-sm">Response View Mapping</CardTitle></CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <Tabs value={editForm.apiConfig?.responseMapping?.type} onValueChange={v => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, type: v as any } } })}>
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="message">Message</TabsTrigger><TabsTrigger value="table">Table</TabsTrigger></TabsList>
                        <TabsContent value="message" className="pt-4">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Success Template (Use {'{{response.key}}'} syntax)</Label>
                          <Input value={editForm.apiConfig?.responseMapping?.template} onChange={e => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, template: e.target.value } } })} placeholder="Balance is {{response.data.balance}}" />
                        </TabsContent>
                        <TabsContent value="table" className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Array Data Path</Label>
                            <Input value={editForm.apiConfig?.responseMapping?.tableDataKey} onChange={e => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableDataKey: e.target.value } } })} placeholder="e.g. rates" />
                          </div>
                          {apiPreviewResult && (
                            <div className="p-2 border rounded-md bg-muted/5">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Detected Data Keys:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {getDetectedKeys(apiPreviewResult, editForm.apiConfig?.responseMapping?.tableDataKey).map(k => (
                                  <Badge key={k} variant="secondary" className="text-[9px] cursor-copy" onClick={() => toast({ title: "Copied", description: `${k} copied to clipboard.` })}>{k}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between"><Label className="text-xs">Columns</Label><Button variant="ghost" size="sm" onClick={addTableColumn}><Plus /> Add Col</Button></div>
                            {editForm.apiConfig?.responseMapping?.tableColumns?.map((col, idx) => (
                              <div key={idx} className="flex gap-2">
                                <Input placeholder="Header" value={col.header} onChange={e => {
                                  const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                  cols[idx].header = e.target.value;
                                  setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                }} />
                                <Input placeholder="JSON Key" value={col.key} onChange={e => {
                                  const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                  cols[idx].key = e.target.value;
                                  setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                }} />
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="pt-8 border-t">
                <Label className="text-sm font-bold flex items-center gap-2 mb-4"><ListTree size={16} /> Attach Related Menus</                     Label>
                <div className="bg-white rounded-xl border p-4">{renderBrowserTree(null)}</div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t bg-white sticky bottom-0 z-50">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Delete this menu and all its descendants?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { deleteMenu(itemToDelete!); refresh(); setItemToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
