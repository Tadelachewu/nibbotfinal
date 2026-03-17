
'use client';

import { useState, useEffect } from 'react';
import { MenuItem, KYCField, TableColumn } from '@/lib/types';
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
  Menu as MenuIcon,
  FolderPlus,
  Loader2,
  ListTree,
  Globe,
  Settings2,
  Zap,
  PlayCircle,
  Link2,
  Table as TableIcon,
  Languages
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WysiwygEditor } from './WysiwygEditor';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { adminContentTranslator } from '@/ai/flows/admin-content-translator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
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
        
        // AI Suggestion only for missing fields
        try {
          if (editForm.name && !editForm.nameAm) {
            const res = await adminContentTranslator({ content: editForm.name, targetLanguage: 'Amharic' });
            updatedForm.nameAm = res.translatedContent;
          }
          if (editForm.responseType === 'static' && editForm.content && !editForm.contentAm) {
            const res = await adminContentTranslator({ content: editForm.content, targetLanguage: 'Amharic' });
            updatedForm.contentAm = res.translatedContent;
          }
        } catch (aiError) {
          console.warn("Localization AI suggestion failed, saving manual entries:", aiError);
        }

        updateMenu(editingId, updatedForm);
        setIsEditDialogOpen(false);
        setEditingId(null);
        refresh();
        toast({ title: "Saved", description: "Menu updated successfully." });
      } catch (error) {
        toast({ title: "Save Error", description: "Could not save menu item. Check console for details.", variant: "destructive" });
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
      const endpoint = editForm.apiConfig.endpoint.startsWith('/') 
        ? editForm.apiConfig.endpoint 
        : `/api/${editForm.apiConfig.endpoint}`;

      const response = await fetch(endpoint, {
        method: editForm.apiConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...editForm.apiConfig.headers
        },
      });
      
      const data = await response.json();
      setApiPreviewResult(data);

      if (response.ok) {
        toast({ title: "API Test Successful", description: "Response received from endpoint." });
      } else {
        toast({ title: "API Info", description: "Endpoint returned a status info/error. Mapping keys still available.", variant: "default" });
      }
    } catch (e) {
      toast({ title: "API Network Error", description: "Could not reach endpoint. Ensure the URL is correct.", variant: "destructive" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const getDetectedKeys = (obj: any): string[] => {
    if (!obj) return [];
    
    const keys: Set<string> = new Set();
    
    const extractKeys = (data: any, prefix = '') => {
      if (!data || typeof data !== 'object') return;
      
      if (Array.isArray(data)) {
        if (data.length > 0) extractKeys(data[0], prefix);
        return;
      }
      
      Object.keys(data).forEach(k => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        keys.add(fullKey);
        
        if (data[k] && typeof data[k] === 'object') {
          extractKeys(data[k], fullKey);
        }
      });
    };
    
    extractKeys(obj);
    return Array.from(keys);
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
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {item.nameAm && <span className="truncate text-[10px] text-muted-foreground">{item.nameAm}</span>}
                  </div>
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
          const isSelected = editForm.attachedMenuIds?.includes(item.id);
          return (
            <div key={item.id} className="space-y-1">
              <div className={cn("flex items-center gap-2 p-2 rounded-md transition-all cursor-pointer hover:bg-muted/50", isSelected && "bg-primary/5 ring-1 ring-primary/10")} onClick={() => {
                const currentIds = editForm.attachedMenuIds || [];
                if (!currentIds.includes(item.id)) {
                  setEditForm({ ...editForm, attachedMenuIds: [...currentIds, item.id] });
                } else {
                  setEditForm({ ...editForm, attachedMenuIds: currentIds.filter(id => id !== item.id) });
                }
              }}>
                <Checkbox checked={isSelected} className="h-4 w-4 rounded-full" onClick={(e) => e.stopPropagation()} />
                <span className="text-xs font-medium">{item.name}</span>
              </div>
              {isSelected && renderBrowserTree(item.id, level + 1)}
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground"><Languages size={14} /> Menu Text (English)</Label>
                    <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. Services" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase font-bold text-primary"><Languages size={14} /> Amharic Translation</Label>
                    <Input value={editForm.nameAm || ''} onChange={e => setEditForm({ ...editForm, nameAm: e.target.value })} placeholder="ለምሳሌ፡ አገልግሎቶች" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                    <Select value={editForm.responseType} onValueChange={(v: any) => setEditForm({ ...editForm, responseType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="static">Static Response</SelectItem><SelectItem value="api">API Action</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {editForm.responseType === 'static' ? (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Response Content (English)</Label>
                    <WysiwygEditor title="English Content" value={editForm.content || ''} onChange={v => setEditForm({ ...editForm, content: v })} />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase font-bold text-primary">Response Content (Amharic)</Label>
                    <WysiwygEditor title="Amharic Content" value={editForm.contentAm || ''} onChange={v => setEditForm({ ...editForm, contentAm: v })} />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <Card>
                    <CardHeader className="bg-muted/10 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">API Connectivity</CardTitle>
                      <Button variant="outline" size="sm" onClick={testApi} disabled={isTestingApi}>
                        {isTestingApi ? <Loader2 className="animate-spin" /> : <PlayCircle className="mr-2" />} Live Preview
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex gap-4">
                        <Select value={editForm.apiConfig?.method} onValueChange={v => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, method: v as any } })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                        </Select>
                        <Input value={editForm.apiConfig?.endpoint} onChange={e => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, endpoint: e.target.value } })} placeholder="e.g. /api/test/balance" />
                      </div>
                      {apiPreviewResult && (
                        <div className="bg-slate-950 p-3 rounded-md">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-slate-400 font-mono">LATEST API RESPONSE:</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[9px] text-slate-400" onClick={() => setApiPreviewResult(null)}><X size={10} className="mr-1"/> Clear</Button>
                          </div>
                          <ScrollArea className="h-48 mt-2"><pre className="text-[10px] text-emerald-400 font-mono">{JSON.stringify(apiPreviewResult, null, 2)}</pre></ScrollArea>
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
                            setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: [...fields, { id: Math.random().toString(36).substr(2, 9), name: '', prompt: '', promptAm: '', type: 'text', order: fields.length }] } });
                          }}><Plus className="mr-1" /> Add KYC</Button>
                        </div>
                        {editForm.apiConfig?.kycFields?.map((field, idx) => (
                          <div key={field.id} className="flex flex-col gap-3 p-4 border rounded-md bg-muted/5 group relative">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold">Field Key</Label>
                                <Input placeholder="e.g. phone" value={field.name} onChange={e => {
                                  const fields = [...editForm.apiConfig!.kycFields];
                                  fields[idx].name = e.target.value;
                                  setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                                }} />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold">English Prompt</Label>
                                <Input placeholder="e.g. Please enter your phone number" value={field.prompt} onChange={e => {
                                  const fields = [...editForm.apiConfig!.kycFields];
                                  fields[idx].prompt = e.target.value;
                                  setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                                }} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-bold text-primary">Amharic Prompt (Manual Override)</Label>
                              <Input placeholder="ለምሳሌ፡ እባክዎን ስልክ ቁጥርዎን ያስገቡ" value={field.promptAm} onChange={e => {
                                const fields = [...editForm.apiConfig!.kycFields];
                                fields[idx].promptAm = e.target.value;
                                setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                              }} />
                            </div>
                            <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white border text-destructive shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                               const fields = editForm.apiConfig!.kycFields.filter((_, i) => i !== idx);
                               setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, kycFields: fields } });
                            }}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">2. API Request Mapping</Label>
                          <Button variant="ghost" size="sm" onClick={() => {
                             const params = editForm.apiConfig?.requestParameters || [];
                             setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, requestParameters: [...params, { apiKey: '', sourceType: 'kyc', sourceValue: '' }] } });
                          }}><Link2 className="mr-1" /> Map Parameter</Button>
                        </div>
                        {editForm.apiConfig?.requestParameters?.map((param, idx) => (
                          <div key={idx} className="flex gap-2 items-center group">
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
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                               const params = editForm.apiConfig!.requestParameters.filter((_, i) => i !== idx);
                               setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, requestParameters: params } });
                            }}>
                              <Trash2 size={14} />
                            </Button>
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
                        <TabsContent value="message" className="pt-4 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Success Template (Use {'{{response.key}}'} syntax)</Label>
                            <Input value={editForm.apiConfig?.responseMapping?.template} onChange={e => setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, template: e.target.value } } })} placeholder="Balance is {{response.data.balance}}" />
                          </div>
                          {apiPreviewResult && (
                            <div className="p-3 border rounded-md bg-muted/5">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Available Response Keys:</span>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {getDetectedKeys(apiPreviewResult).map(k => (
                                  <Badge key={k} variant="outline" className="text-[9px] cursor-copy hover:bg-primary/10" onClick={() => {
                                    const current = editForm.apiConfig?.responseMapping?.template || '';
                                    setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, template: current + `{{response.${k}}}` } } });
                                  }}>{k}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="table" className="space-y-4 pt-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold flex items-center gap-2"><TableIcon size={14} /> Table Columns Mapping</Label>
                            <Button variant="ghost" size="sm" onClick={() => {
                               const cols = editForm.apiConfig!.responseMapping.tableColumns || [];
                               setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: [...cols, { header: 'New Column', key: '' }] } } });
                            }}><Plus className="mr-1" /> Add Column</Button>
                          </div>
                          
                          <div className="space-y-4">
                            {editForm.apiConfig?.responseMapping?.tableColumns?.map((col, idx) => (
                              <div key={idx} className="flex flex-col gap-3 p-4 border rounded-md bg-white group relative shadow-sm">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] text-muted-foreground uppercase font-bold">English Header</Label>
                                    <Input className="h-8 text-xs" placeholder="e.g. Price" value={col.header} onChange={e => {
                                      const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                      cols[idx].header = e.target.value;
                                      setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                    }} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] text-primary uppercase font-bold">Amharic Header</Label>
                                    <Input className="h-8 text-xs" placeholder="ለምሳሌ፡ ዋጋ" value={col.headerAm} onChange={e => {
                                      const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                      cols[idx].headerAm = e.target.value;
                                      setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                    }} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] text-muted-foreground uppercase font-bold">JSON Data Key</Label>
                                    <Input className="h-8 text-xs font-mono" placeholder="e.g. price.amount" value={col.key} onChange={e => {
                                      const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                      cols[idx].key = e.target.value;
                                      setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                    }} />
                                  </div>
                                </div>
                                
                                {apiPreviewResult && (
                                  <div className="flex flex-wrap gap-1 border-t pt-2 mt-1">
                                    <span className="text-[8px] text-muted-foreground self-center mr-1">DETECTED:</span>
                                    {getDetectedKeys(apiPreviewResult).slice(0, 12).map(k => (
                                      <Badge key={k} variant="outline" className="text-[8px] cursor-pointer hover:bg-primary/5 py-0 px-1" onClick={() => {
                                        const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                        cols[idx].key = k;
                                        setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                      }}>{k}</Badge>
                                    ))}
                                  </div>
                                )}

                                <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white border text-destructive shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                   const cols = editForm.apiConfig!.responseMapping.tableColumns!.filter((_, i) => i !== idx);
                                   setEditForm({ ...editForm, apiConfig: { ...editForm.apiConfig!, responseMapping: { ...editForm.apiConfig!.responseMapping, tableColumns: cols } } });
                                }}>
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Separator />

              <div className="pt-8">
                <Label className="text-sm font-bold flex items-center gap-2 mb-4"><ListTree size={16} /> Attach Related Menus</Label>
                <div className="bg-white rounded-xl border p-4 shadow-sm">{renderBrowserTree(null)}</div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t bg-white sticky bottom-0 z-50">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Save & Localize</Button>
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
