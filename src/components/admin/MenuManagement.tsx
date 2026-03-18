'use client';

import { useState, useEffect } from 'react';
import { MenuItem, KYCField, TableColumn, AuthType, ApiConfig, Language, AppSettings } from '@/lib/types';
import { getStoredMenus, addMenu, updateMenu, deleteMenu, getAppSettings, saveAppSettings } from '@/lib/store';
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
  Languages,
  ShieldCheck,
  Eye,
  FileCode,
  Check,
  Info,
  ChevronRight,
  Wand2,
  Sparkles,
  Type,
  Search,
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
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MenuManagement() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [expandedBrowserFolders, setExpandedBrowserFolders] = useState<Set<string>>(new Set(['root']));
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeLangTab, setActiveLangTab] = useState<string>('en');
  const [apiPreviewResult, setApiPreviewResult] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [sentHeaders, setSentHeaders] = useState<Record<string, string> | null>(null);
  const [sentBody, setSentBody] = useState<any>(null);

  useEffect(() => {
    const data = getStoredMenus();
    setMenus(data);
    const appSettings = getAppSettings();
    setSettings(appSettings);
    const defaultLang = appSettings.supportedLanguages.find(l => l.isDefault)?.code || 'en';
    setActiveLangTab(defaultLang);
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
    setSentHeaders(null);
    setSentBody(null);
    setEditForm(JSON.parse(JSON.stringify(menu))); 
    setIsEditDialogOpen(true);
  };

  const deepUpdate = (path: string[], value: any) => {
    setEditForm(prev => {
      const cloned = JSON.parse(JSON.stringify(prev));
      let current = cloned;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return cloned;
    });
  };

  const handleSaveEdit = async () => {
    if (editingId && editForm) {
      setIsSaving(true);
      try {
        updateMenu(editingId, editForm);
        setIsEditDialogOpen(false);
        setEditingId(null);
        refresh();
        toast({ title: "Saved", description: "Menu updated successfully." });
      } catch (error) {
        toast({ title: "Save Error", description: "Could not save menu item.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveSettings = () => {
    saveAppSettings(settings);
    toast({ title: "Settings Saved", description: "Languages and app settings updated." });
  };

  const addLanguage = () => {
    const newLang: Language = { code: 'new' + Math.random().toString(36).substr(2, 4), name: 'New Language' };
    setSettings({ ...settings, supportedLanguages: [...settings.supportedLanguages, newLang] });
  };

  const updateLanguage = (index: number, field: keyof Language, value: string) => {
    const newLangs = [...settings.supportedLanguages];
    (newLangs[index] as any)[field] = value;
    setSettings({ ...settings, supportedLanguages: newLangs });
  };

  const removeLanguage = (index: number) => {
    if (settings.supportedLanguages[index].isDefault) {
      toast({ title: "Error", description: "Cannot remove default language.", variant: "destructive" });
      return;
    }
    const newLangs = settings.supportedLanguages.filter((_, i) => i !== index);
    setSettings({ ...settings, supportedLanguages: newLangs });
  };

  const testApi = async () => {
    if (!editForm.apiConfig?.endpoint) {
      toast({ title: "Missing Endpoint", description: "Please enter an API URL first.", variant: "destructive" });
      return;
    }
    setIsTestingApi(true);
    setApiPreviewResult(null);
    setSentHeaders(null);
    setSentBody(null);

    try {
      const rawEndpoint = editForm.apiConfig.endpoint;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...editForm.apiConfig.headers
      };

      const sampleKyc: Record<string, string> = { 
        account_id: '88991122', 
        account_number: '12345',
        verification_code: '9988',
        phone: '251911223344', 
      };

      const resolve = (str: string) => str.replace(/{{\s*(.*?)\s*}}/g, (match, p1) => {
        const key = p1.trim();
        if (key === 'user_token') return 'talktree_static_token_778899';
        if (key === 'user_id') return 'user_123';
        return sampleKyc[key] || match;
      });

      const endpoint = resolve(rawEndpoint);

      const auth = editForm.apiConfig.authConfig;
      if (auth && auth.type !== 'none') {
        const headerName = auth.apiKey?.header || auth.basicAuth?.header || auth.bearer?.header || 'Authorization';
        
        if (auth.type === 'apiKey' && auth.apiKey) {
          headers[headerName] = resolve(auth.apiKey.value);
        } else if (auth.type === 'basic' && auth.basicAuth) {
          const user = auth.basicAuth.user || 'admin';
          const pass = auth.basicAuth.pass || 'password123';
          headers[headerName] = `Basic ${btoa(`${user}:${pass}`)}`;
        } else if (auth.type === 'bearer' && auth.bearer) {
          headers[headerName] = resolve(auth.bearer.template);
        }
      }

      const requestPayload: Record<string, any> = {};
      editForm.apiConfig.requestParameters?.forEach(param => {
        if (param.sourceType === 'kyc') requestPayload[param.apiKey] = sampleKyc[param.sourceValue] || `{{${param.sourceValue}}}`;
        else if (param.sourceValue === 'user.id') requestPayload[param.apiKey] = 'user_123';
        else if (param.sourceValue === 'user.token') requestPayload[param.apiKey] = 'talktree_static_token_778899';
        else if (param.sourceType === 'static') requestPayload[param.apiKey] = param.sourceValue;
      });

      setSentHeaders(headers);
      if (editForm.apiConfig.method === 'POST') setSentBody(requestPayload);

      const fetchUrl = editForm.apiConfig.method === 'GET' && Object.keys(requestPayload).length > 0
        ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${new URLSearchParams(requestPayload).toString()}`
        : endpoint;

      const response = await fetch(fetchUrl, {
        method: editForm.apiConfig.method,
        headers,
        body: editForm.apiConfig.method === 'POST' ? JSON.stringify(requestPayload) : undefined,
        cache: 'no-store'
      });
      
      const data = await response.json().catch(() => ({ 
        status: 'error', 
        message: 'The API returned a non-JSON response.' 
      }));
      
      setApiPreviewResult(data);
      if (response.ok) toast({ title: "API Test Successful" });
      else toast({ title: "API Warning", description: `Status ${response.status}`, variant: "destructive" });
    } catch (e) {
      toast({ title: "API Network Error", variant: "destructive" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const getAvailableFields = (obj: any, prefix = ''): string[] => {
    if (!obj || typeof obj !== 'object' || obj === null) return [];
    let fields: string[] = [];
    
    for (const key in obj) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(obj[key])) {
        if (obj[key].length > 0 && typeof obj[key][0] === 'object') {
          fields.push(...getAvailableFields(obj[key][0], currentPath));
        } else {
          fields.push(currentPath);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        fields.push(...getAvailableFields(obj[key], currentPath));
      } else {
        fields.push(currentPath);
      }
    }
    return fields;
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
    
    if (items.length === 0 && parentId !== null) return null;

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-6 border-l pl-3' : ''}`}>
        {items.map(item => {
          const isSelected = editForm.attachedMenuIds?.includes(item.id);
          const isExpanded = expandedBrowserFolders.has(item.id);
          const hasChildren = menus.some(m => m.parentId === item.id);

          return (
            <div key={item.id} className="space-y-1">
              <div className={cn("flex items-center gap-1 p-1 rounded-md transition-all hover:bg-muted/50 group", isSelected && "bg-primary/5 ring-1 ring-primary/10")}>
                <button onClick={(e) => { e.stopPropagation(); const next = new Set(expandedBrowserFolders); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); setExpandedBrowserFolders(next); }} className={cn("text-muted-foreground hover:text-primary transition-transform h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted", !hasChildren && "opacity-0 cursor-default pointer-events-none", isExpanded ? 'rotate-0' : '-rotate-90')} disabled={!hasChildren}><ChevronDown size={16} /></button>
                <div className="flex items-center gap-2 flex-1 cursor-pointer py-1 pr-2" onClick={() => { const currentIds = editForm.attachedMenuIds || []; if (!isSelected) setEditForm({ ...editForm, attachedMenuIds: [...currentIds, item.id] }); else setEditForm({ ...editForm, attachedMenuIds: currentIds.filter(id => id !== item.id) }); }}>
                  <Checkbox checked={isSelected} className="h-4 w-4 rounded-sm" />
                  <div className="flex flex-col min-w-0"><span className="text-xs font-medium truncate">{item.name}</span>{item.nameAm && <span className="text-[9px] text-muted-foreground truncate italic">{item.nameAm}</span>}</div>
                </div>
              </div>
              {isExpanded && renderBrowserTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const kycFieldsList = (editForm.apiConfig?.kycFields || []).filter(f => f.name);

  const FieldPicker = ({ onSelect, currentFields, mode = 'path' }: { onSelect: (field: string) => void, currentFields: string[], mode?: 'path' | 'placeholder' }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 shrink-0">
          <Wand2 size={12} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Sparkles size={10} className="text-primary" />
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Detected Data Fields</span>
        </div>
        <ScrollArea className="h-56">
          <div className="space-y-1 pr-2">
            {currentFields.length > 0 ? (
              currentFields.map(field => (
                <Button 
                  key={field} 
                  variant="ghost" 
                  className="w-full justify-start h-8 text-[11px] px-2 font-mono truncate"
                  onClick={() => onSelect(mode === 'placeholder' ? `{{response.${field}}}` : field)}
                >
                  {field}
                </Button>
              ))
            ) : (
              <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                Test API first to see fields.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  const getCurrentLanguage = () => settings.supportedLanguages.find(l => l.code === activeLangTab) || settings.supportedLanguages.find(l => l.isDefault) || settings.supportedLanguages[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Tabs defaultValue="menus">
        <TabsList className="mb-4">
          <TabsTrigger value="menus" className="flex items-center gap-2"><ListTree size={16} /> Menu Hierarchy</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2"><Globe size={16} /> App Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="menus">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
              <div><CardTitle>Menu Hierarchy</CardTitle></div>
              <Button onClick={() => handleAdd(null)}><Plus size={16} className="mr-2" /> Add Main Menu</Button>
            </CardHeader>
            <CardContent className="p-6">{renderTree(null)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Language Management</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase">Supported Languages</Label>
                  <Button variant="outline" size="sm" onClick={addLanguage}><Plus className="mr-2 h-4 w-4" /> Add Language</Button>
                </div>
                <div className="grid gap-3">
                  {settings.supportedLanguages.map((lang, idx) => (
                    <div key={lang.code} className="flex gap-3 items-center p-3 border rounded-lg bg-muted/5 group">
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Language Name</Label>
                          <Input value={lang.name} onChange={e => updateLanguage(idx, 'name', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Code (e.g. fr)</Label>
                          <Input value={lang.code} onChange={e => updateLanguage(idx, 'code', e.target.value)} />
                        </div>
                      </div>
                      <div className="pt-5 flex gap-1">
                        {lang.isDefault ? <Badge className="h-10 px-3">Default</Badge> : (
                          <Button variant="ghost" size="icon" onClick={() => removeLanguage(idx)} className="text-destructive opacity-0 group-hover:opacity-100"><Trash2 size={16} /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveSettings}><Save className="mr-2" /> Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="flex items-center gap-2"><Settings2 size={18} /> Configure {editForm.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8 pb-20">
              <div className="grid gap-6 sm:grid-cols-2 bg-muted/10 p-4 rounded-xl border">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                  <Select value={editForm.responseType} onValueChange={(v: any) => setEditForm({ ...editForm, responseType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="static">Static Response</SelectItem><SelectItem value="api">API Action</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Display Order</Label>
                  <Input type="number" value={editForm.order || 0} onChange={e => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold flex items-center gap-2"><Languages size={16} className="text-primary" /> Localization & Label</Label>
                <Tabs value={activeLangTab} onValueChange={setActiveLangTab} className="w-full border rounded-xl overflow-hidden bg-white shadow-sm">
                  <TabsList className="w-full justify-start rounded-none border-b h-12 bg-muted/20 px-4 gap-2">
                    {settings.supportedLanguages.map(lang => (
                      <TabsTrigger key={lang.code} value={lang.code} className="data-[state=active]:bg-white data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-4 text-xs">
                        {lang.name} {lang.isDefault && <span className="ml-2 text-[10px] opacity-50 font-normal">(Default)</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {settings.supportedLanguages.map(lang => (
                    <TabsContent key={lang.code} value={lang.code} className="p-6 space-y-6 mt-0 animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Menu Label ({lang.name})</Label>
                        <Input 
                          value={lang.isDefault ? (editForm.name || '') : (lang.code === 'am' ? (editForm.nameAm || '') : (editForm.translations?.[lang.code]?.name || ''))} 
                          onChange={e => {
                            if (lang.isDefault) setEditForm({ ...editForm, name: e.target.value });
                            else if (lang.code === 'am') setEditForm({ ...editForm, nameAm: e.target.value });
                            else {
                              const translations = { ...(editForm.translations || {}) };
                              translations[lang.code] = { ...(translations[lang.code] || {}), name: e.target.value };
                              setEditForm({ ...editForm, translations });
                            }
                          }} 
                          placeholder={`${lang.name} translation`} 
                        />
                      </div>

                      {editForm.responseType === 'static' && (
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Response Content ({lang.name})</Label>
                          <WysiwygEditor 
                            title={`${lang.name} Content`} 
                            value={lang.isDefault ? (editForm.content || '') : (lang.code === 'am' ? (editForm.contentAm || '') : (editForm.translations?.[lang.code]?.content || ''))} 
                            onChange={v => {
                              if (lang.isDefault) setEditForm({ ...editForm, content: v });
                              else if (lang.code === 'am') setEditForm({ ...editForm, contentAm: v });
                              else {
                                const translations = { ...(editForm.translations || {}) };
                                translations[lang.code] = { ...(translations[lang.code] || {}), content: v };
                                setEditForm({ ...editForm, translations });
                              }
                            }} 
                          />
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {editForm.responseType === 'api' && (
                <div className="space-y-8 pt-4">
                  <Card>
                    <CardHeader className="bg-muted/10 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">API Connectivity</CardTitle>
                      <Button variant="outline" size="sm" onClick={testApi} disabled={isTestingApi}>
                        {isTestingApi ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />} Live Preview
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                      <div className="flex gap-4">
                        <Select value={editForm.apiConfig?.method} onValueChange={v => deepUpdate(['apiConfig', 'method'], v)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                        </Select>
                        <div className="flex-1 space-y-2">
                          <Input value={editForm.apiConfig?.endpoint} onChange={e => deepUpdate(['apiConfig', 'endpoint'], e.target.value)} placeholder="e.g. /api/test/profile/{{account_id}}" />
                        </div>
                      </div>

                      <Separator />
                      
                      <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Authorization</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Auth Type</Label>
                            <Select 
                              value={editForm.apiConfig?.authConfig?.type || 'none'} 
                              onValueChange={v => {
                                const authType = v as AuthType;
                                deepUpdate(['apiConfig', 'authConfig'], {
                                  type: authType,
                                  apiKey: authType === 'apiKey' ? { header: 'X-API-KEY', value: '' } : undefined,
                                  basicAuth: authType === 'basic' ? { header: 'Authorization', user: '', pass: '' } : undefined,
                                  bearer: authType === 'bearer' ? { header: 'Authorization', template: 'Bearer {{user_token}}' } : undefined,
                                });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (Public API)</SelectItem>
                                <SelectItem value="apiKey">API Key</SelectItem>
                                <SelectItem value="basic">Basic Auth</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {editForm.apiConfig?.authConfig?.type === 'apiKey' && (
                            <div className="space-y-3 p-3 border rounded-md bg-muted/5">
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                                <Input placeholder="X-API-KEY" value={editForm.apiConfig?.authConfig?.apiKey?.header} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'apiKey', 'header'], e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold">Key Value</Label>
                                <Input placeholder="secret-123" value={editForm.apiConfig?.authConfig?.apiKey?.value} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'apiKey', 'value'], e.target.value)} />
                              </div>
                            </div>
                          )}

                          {editForm.apiConfig?.authConfig?.type === 'basic' && (
                            <div className="space-y-4 p-4 border rounded-md bg-muted/5">
                              <div className="space-y-1 mb-2">
                                <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                                <Input placeholder="Authorization" value={editForm.apiConfig?.authConfig?.basicAuth?.header} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'header'], e.target.value)} />
                              </div>
                              <div className="space-y-3">
                                <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Username</Label><Input value={editForm.apiConfig?.authConfig?.basicAuth?.user} onChange={e => { deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'user'], e.target.value); }} /></div>
                                <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Password</Label><Input type="password" value={editForm.apiConfig?.authConfig?.basicAuth?.pass} onChange={e => { deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'pass'], e.target.value); }} /></div>
                              </div>
                            </div>
                          )}

                          {editForm.apiConfig?.authConfig?.type === 'bearer' && (
                            <div className="space-y-3 p-3 border rounded-md bg-muted/5">
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                                <Input placeholder="Authorization" value={editForm.apiConfig?.authConfig?.bearer?.header} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'bearer', 'header'], e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold">Token Template</Label>
                                <Input placeholder="Bearer {{user_token}}" value={editForm.apiConfig?.authConfig?.bearer?.template} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'bearer', 'template'], e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {(sentHeaders || sentBody || apiPreviewResult) && (
                        <div className="space-y-3 pt-2">
                          {sentHeaders && (
                            <div className="bg-slate-900 p-3 rounded-md border border-slate-700">
                              <span className="text-[9px] text-amber-400 font-bold uppercase flex items-center gap-2"><Eye size={10} /> Client Headers:</span>
                              <pre className="text-[10px] text-slate-300 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(sentHeaders, null, 2)}</pre>
                            </div>
                          )}
                          {sentBody && (
                            <div className="bg-slate-900 p-3 rounded-md border border-slate-700">
                              <span className="text-[9px] text-primary font-bold uppercase flex items-center gap-2"><FileCode size={10} /> Client Body:</span>
                              <pre className="text-[10px] text-slate-300 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(sentBody, null, 2)}</pre>
                            </div>
                          )}
                          {apiPreviewResult && (
                            <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] text-emerald-400 font-bold uppercase">Latest API Response:</span>
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] text-muted-foreground hover:text-white" onClick={() => setApiPreviewResult(null)}>Clear</Button>
                              </div>
                              <ScrollArea className="h-48"><pre className={cn("text-[10px] font-mono whitespace-pre-wrap", apiPreviewResult.status === 'error' ? 'text-red-400' : 'text-emerald-400')}>{JSON.stringify(apiPreviewResult, null, 2)}</pre></ScrollArea>
                            </div>
                          )}
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
                            deepUpdate(['apiConfig', 'kycFields'], [...fields, { id: Math.random().toString(36).substr(2, 9), name: '', prompt: '', promptAm: '', type: 'text', order: fields.length }]);
                          }}><Plus className="mr-1" /> Add KYC</Button>
                        </div>
                        {editForm.apiConfig?.kycFields?.map((field, idx) => (
                          <div key={field.id} className="flex flex-col gap-3 p-4 border rounded-md bg-muted/5 group relative">
                            <div className="grid grid-cols-4 gap-3">
                              <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Field Key</Label><Input value={field.name} onChange={e => { const fields = [...editForm.apiConfig!.kycFields]; fields[idx].name = e.target.value; deepUpdate(['apiConfig', 'kycFields'], fields); }} /></div>
                              <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Type</Label><Select value={field.type} onValueChange={v => { const fields = [...editForm.apiConfig!.kycFields]; fields[idx].type = v as any; deepUpdate(['apiConfig', 'kycFields'], fields); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="tel">Phone</SelectItem><SelectItem value="number">Number</SelectItem><SelectItem value="password">Password</SelectItem></SelectContent></Select></div>
                              <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold">English Prompt</Label><Input value={field.prompt} onChange={e => { const fields = [...editForm.apiConfig!.kycFields]; fields[idx].prompt = e.target.value; deepUpdate(['apiConfig', 'kycFields'], fields); }} /></div>
                            </div>
                            <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white border text-destructive opacity-0 group-hover:opacity-100" onClick={() => { const fields = editForm.apiConfig!.kycFields.filter((_, i) => i !== idx); deepUpdate(['apiConfig', 'kycFields'], fields); }}><Trash2 size={12} /></Button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase">2. API Request Mapping</Label><Button variant="ghost" size="sm" onClick={() => { const params = editForm.apiConfig?.requestParameters || []; deepUpdate(['apiConfig', 'requestParameters'], [...params, { apiKey: '', sourceType: 'kyc', sourceValue: '' }]); }}><Link2 className="mr-1" /> Map Parameter</Button></div>
                        <div className="space-y-2">
                          {editForm.apiConfig?.requestParameters?.map((param, idx) => (
                            <div key={idx} className="flex gap-2 items-center group">
                              <Input placeholder="API Param Key" value={param.apiKey} onChange={e => { const params = [...editForm.apiConfig!.requestParameters]; params[idx].apiKey = e.target.value; deepUpdate(['apiConfig', 'requestParameters'], params); }} className="flex-1" />
                              <Select value={param.sourceValue} onValueChange={v => { 
                                const params = [...editForm.apiConfig!.requestParameters]; 
                                params[idx].sourceValue = v; 
                                if (v === 'user.id' || v === 'user.token') params[idx].sourceType = 'user_profile';
                                else params[idx].sourceType = 'kyc';
                                deepUpdate(['apiConfig', 'requestParameters'], params); 
                              }}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Source Field" /></SelectTrigger>
                                <SelectContent>{kycFieldsList.map(f => <SelectItem key={f.id} value={f.name}>KYC: {f.name}</SelectItem>)}<SelectItem value="user.id">User ID (System)</SelectItem><SelectItem value="user.token">User Token (System)</SelectItem></SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 shrink-0" onClick={() => { const params = editForm.apiConfig!.requestParameters.filter((_, i) => i !== idx); deepUpdate(['apiConfig', 'requestParameters'], params); }}><Trash2 size={14} /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="bg-muted/10"><CardTitle className="text-sm">Response View Mapping</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Tabs value={editForm.apiConfig?.responseMapping?.type} onValueChange={v => deepUpdate(['apiConfig', 'responseMapping', 'type'], v)}>
                        <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-muted/50 h-10">
                          <TabsTrigger value="message" className="data-[state=active]:bg-white rounded-none border-r"><Type size={14} className="mr-2" /> Message</TabsTrigger>
                          <TabsTrigger value="table" className="data-[state=active]:bg-white rounded-none"><TableIcon size={14} className="mr-2" /> Table</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="message" className="p-4 space-y-4 mt-0">
                          {(() => {
                            const lang = getCurrentLanguage();
                            const isDefault = lang.code === settings.supportedLanguages.find(l => l.isDefault)?.code || lang.isDefault;
                            
                            const templateVal = isDefault 
                              ? (editForm.apiConfig?.responseMapping?.template || '') 
                              : (lang.code === 'am' ? (editForm.apiConfig?.responseMapping?.templateAm || '') : (editForm.translations?.[lang.code]?.responseTemplate || ''));
                            
                            const errorVal = isDefault 
                              ? (editForm.apiConfig?.responseMapping?.errorFallback || '') 
                              : (lang.code === 'am' ? (editForm.apiConfig?.responseMapping?.errorFallbackAm || '') : (editForm.translations?.[lang.code]?.errorFallback || ''));

                            const handleTemplateChange = (val: string) => {
                              if (isDefault) deepUpdate(['apiConfig', 'responseMapping', 'template'], val);
                              else if (lang.code === 'am') deepUpdate(['apiConfig', 'responseMapping', 'templateAm'], val);
                              else {
                                const translations = { ...(editForm.translations || {}) };
                                translations[lang.code] = { ...(translations[lang.code] || {}), responseTemplate: val };
                                setEditForm({ ...editForm, translations });
                              }
                            };

                            const handleErrorChange = (val: string) => {
                              if (isDefault) deepUpdate(['apiConfig', 'responseMapping', 'errorFallback'], val);
                              else if (lang.code === 'am') deepUpdate(['apiConfig', 'responseMapping', 'errorFallbackAm'], val);
                              else {
                                const translations = { ...(editForm.translations || {}) };
                                translations[lang.code] = { ...(translations[lang.code] || {}), errorFallback: val };
                                setEditForm({ ...editForm, translations });
                              }
                            };

                            return (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Success Message ({lang.name})</Label>
                                    <FieldPicker 
                                      mode="placeholder"
                                      currentFields={getAvailableFields(apiPreviewResult)}
                                      onSelect={(val) => handleTemplateChange(templateVal + val)}
                                    />
                                  </div>
                                  <Input value={templateVal} onChange={e => handleTemplateChange(e.target.value)} placeholder="e.g. Your balance is {{response.balance}}" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Fallback ({lang.name})</Label>
                                  <Input value={errorVal} onChange={e => handleErrorChange(e.target.value)} placeholder="Service unavailable." />
                                </div>
                              </div>
                            );
                          })()}
                        </TabsContent>

                        <TabsContent value="table" className="p-4 space-y-4 mt-0">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase"><TableIcon size={14} /> Structure Mapping</Label>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => { const cols = editForm.apiConfig?.responseMapping?.tableColumns || []; deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], [...cols, { header: 'New Column', key: '' }]); }}><Plus className="mr-1 h-3 w-3" /> Add Column</Button>
                          </div>
                          <div className="space-y-2">
                            {editForm.apiConfig?.responseMapping?.tableColumns?.map((col, idx) => {
                              const lang = getCurrentLanguage();
                              const isDefault = lang.code === settings.supportedLanguages.find(l => l.isDefault)?.code || lang.isDefault;
                              const headerVal = isDefault ? (col.header || '') : (lang.code === 'am' ? (col.headerAm || '') : (editForm.translations?.[lang.code]?.tableHeaders?.[col.key] || ''));

                              return (
                                <div key={idx} className="flex gap-3 p-3 border rounded-md bg-white group relative shadow-sm items-end animate-in fade-in slide-in-from-top-1">
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Label ({lang.name})</Label>
                                    <Input className="h-8 text-xs" value={headerVal} onChange={e => {
                                      const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                      if (isDefault) cols[idx].header = e.target.value;
                                      else if (lang.code === 'am') cols[idx].headerAm = e.target.value;
                                      else {
                                        const translations = { ...(editForm.translations || {}) };
                                        translations[lang.code] = { ...(translations[lang.code] || {}), tableHeaders: { ...(translations[lang.code]?.tableHeaders || {}), [col.key]: e.target.value } };
                                        setEditForm({ ...editForm, translations });
                                        return;
                                      }
                                      deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols);
                                    }} />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[9px] uppercase font-bold text-muted-foreground">Data Key</Label>
                                      <FieldPicker 
                                        currentFields={getAvailableFields(apiPreviewResult)}
                                        onSelect={(field) => {
                                          const cols = [...editForm.apiConfig!.responseMapping.tableColumns!];
                                          cols[idx].key = field;
                                          deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols);
                                        }}
                                      />
                                    </div>
                                    <Input className="h-8 text-xs font-mono" value={col.key} onChange={e => { const cols = [...editForm.apiConfig!.responseMapping.tableColumns!]; cols[idx].key = e.target.value; deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols); }} />
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => { const cols = editForm.apiConfig!.responseMapping.tableColumns!.filter((_, i) => i !== idx); deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols); }}><Trash2 size={14} /></Button>
                                </div>
                              );
                            })}
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
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="relative mb-4">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search menus..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
                  </div>
                  {renderBrowserTree(null)}
                </div>
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
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => { deleteMenu(itemToDelete!); refresh(); setItemToDelete(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
