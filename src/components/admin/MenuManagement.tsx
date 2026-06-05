'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MenuItem, KYCField, TableColumn, AuthType, ApiConfig, Language, AppSettings, ReportPriority, ReportIdConfig } from '@/lib/types';
import { defaultReportIdConfig } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Edit2,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Save,
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
  FileText,
  Hash,
  ChevronRight,
  Wand2,
  Sparkles,
  Type,
  Search,
  Link as LinkIcon,
  ClipboardList,
  ShieldAlert,
  Fingerprint,
  Calendar,
  UserCircle,
  Info,
  X
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WysiwygEditor } from './WysiwygEditor';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAdminAuth } from './AdminAuthContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePerMenuDrafts } from '@/hooks/usePerMenuDrafts';

export function MenuManagement() {
  const { csrfFetch, currentRole, currentUsername } = useAdminAuth();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [supportUsers, setSupportUsers] = useState<Array<{ username: string; email?: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [expandedBrowserFolders, setExpandedBrowserFolders] = useState<Set<string>>(new Set(['root']));
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { activeDraftIds, getDraft, discardDraft } = usePerMenuDrafts(editingId, editForm, isEditDialogOpen);

  const [activeLangTab, setActiveLangTab] = useState<string>('en');
  const [apiPreviewResult, setApiPreviewResult] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [sentHeaders, setSentHeaders] = useState<Record<string, string> | null>(null);
  const [sentBody, setSentBody] = useState<any>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [botAvatarImageSource, setBotAvatarImageSource] = useState<'upload' | 'url'>('upload');
  const [userAvatarImageSource, setUserAvatarImageSource] = useState<'upload' | 'url'>('upload');
  const [appLogoSource, setAppLogoSource] = useState<'upload' | 'url'>('upload');

  useEffect(() => {
    const load = async () => {
      const [menusRes, settingsRes] = await Promise.all([
        csrfFetch('/api/menus?includeInactive=1', { cache: 'no-store' }),
        fetch('/api/app-settings', { cache: 'no-store' })
      ]);
      const [menusJson, settingsJson] = await Promise.all([
        menusRes.json().catch(() => null),
        settingsRes.json().catch(() => null)
      ]);

      const loadedMenus = Array.isArray(menusJson?.data) ? menusJson.data : [];
      const loadedSettings = settingsJson?.data as AppSettings | undefined;

      setMenus(loadedMenus);
      if (loadedSettings) {
        setSettings(loadedSettings);
        const resolveSource = (img?: string) =>
          typeof img === 'string' && /^https?:\/\//i.test(img) ? 'url' : 'upload';
        setBotAvatarImageSource(resolveSource(loadedSettings.botAvatarImage));
        setUserAvatarImageSource(resolveSource(loadedSettings.userAvatarImage));
        setAppLogoSource(resolveSource(loadedSettings.appLogo));
        const defaultLang = loadedSettings.supportedLanguages.find(l => l.isDefault)?.code || 'en';
        setActiveLangTab(defaultLang);
      }
    };

    load();
  }, [csrfFetch]);

  useEffect(() => {
    if (currentRole !== 'admin') return;
    let active = true;
    (async () => {
      try {
        const res = await csrfFetch('/api/admin/users', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!active) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        setSupportUsers(list.filter((u: any) => u?.role === 'support'));
      } catch {
        if (!active) return;
        setSupportUsers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [csrfFetch, currentRole]);

  const refresh = () => {
    (async () => {
      const res = await csrfFetch('/api/menus?includeInactive=1', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      setMenus(Array.isArray(json?.data) ? json.data : []);
    })();
  };

  const updateOrders = async (updates: Array<{ id: string; order: number }>) => {
    if (!updates.length) return;
    setIsReordering(true);
    try {
      await Promise.all(updates.map(u =>
        csrfFetch(`/api/menus/${encodeURIComponent(u.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: u.order })
        })
      ));
      refresh();
      toast({ title: "Order updated successfully." });
    } catch {
      toast({ title: "Error", description: "Could not update menu order.", variant: "destructive" });
    } finally {
      setIsReordering(false);
    }
  };

  const getEffectiveMenu = (m: MenuItem): MenuItem => {
    const hasPending = (m.pendingStatus === 'pending' || m.pendingStatus === 'rejected') && m.pendingUpdate && typeof m.pendingUpdate === 'object';
    if (!hasPending) return m;
    const update = m.pendingUpdate as any;
    const merged = { ...m };
    if ('name' in update) merged.name = update.name;
    if ('nameAm' in update) merged.nameAm = update.nameAm;
    if ('responseType' in update) merged.responseType = update.responseType;
    if ('content' in update) merged.content = update.content;
    if ('contentAm' in update) merged.contentAm = update.contentAm;
    if ('supportAssignee' in update) merged.supportAssignee = update.supportAssignee;
    if ('order' in update) merged.order = update.order;
    if ('isActive' in update) merged.isActive = update.isActive;
    if ('trackClicks' in update) merged.trackClicks = update.trackClicks;
    if ('parentId' in update) merged.parentId = update.parentId;
    return merged;
  };

  const normalizeSiblings = (parentId: string | null) => {
    return menus
      .map(getEffectiveMenu)
      .filter(m => m.parentId === parentId)
      .slice()
      .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')));
  };

  const swapWithNeighbor = async (menuId: string, direction: -1 | 1) => {
    const original = menus.find(m => m.id === menuId);
    if (!original) return;
    const current = getEffectiveMenu(original);
    const siblings = normalizeSiblings(current.parentId ?? null);
    const idx = siblings.findIndex(s => s.id === menuId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= siblings.length) return;

    const a = siblings[idx];
    const b = siblings[targetIdx];
    const aOrder = Number.isFinite(a.order) ? (a.order as number) : idx;
    const bOrder = Number.isFinite(b.order) ? (b.order as number) : targetIdx;

    if (aOrder !== bOrder) {
      await updateOrders([{ id: a.id, order: bOrder }, { id: b.id, order: aOrder }]);
      return;
    }

    const reordered = siblings.slice();
    reordered[idx] = b;
    reordered[targetIdx] = a;
    await updateOrders(reordered.map((m, i) => ({ id: m.id, order: i })));
  };


  const swapWithOther = async (menuId: string, otherId: string) => {
    const effectiveMenus = menus.map(getEffectiveMenu);
    const a = effectiveMenus.find(m => m.id === menuId);
    const b = effectiveMenus.find(m => m.id === otherId);
    if (!a || !b) return;

    await updateOrders([
      { id: a.id, order: b.order },
      { id: b.id, order: a.order }
    ]);
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await csrfFetch(`/api/menus/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (!res.ok || json?.status === 'error') {
        const verifyRes = await csrfFetch('/api/menus?includeInactive=1', { cache: 'no-store' });
        const verifyJson = await verifyRes.json().catch(() => null);
        const list = Array.isArray(verifyJson?.data) ? verifyJson.data : [];
        const updated = list.find((m: any) => m?.id === id);
        const isApproved =
          !!updated &&
          (updated.approvalStatus || 'approved') === 'approved' &&
          (updated.pendingStatus ?? null) === null;
        if (isApproved) {
          setMenus(list);
          toast({ title: "Approved", description: "Menu approved successfully." });
          return;
        }
        throw new Error(json?.message || 'Approval failed.');
      }
      refresh();
      toast({ title: "Approved", description: "Menu approved successfully." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not approve menu.';
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await csrfFetch(`/api/menus/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason })
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (!res.ok || json?.status === 'error') {
        throw new Error(json?.message || 'Rejection failed.');
      }
      refresh();
      toast({ title: "Rejected", description: "Menu rejected." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reject menu.';
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleAdd = (parentId: string | null = null) => {
    (async () => {
      try {
        const payload: Partial<MenuItem> = {
          name: parentId ? 'Sub Menu' : 'Main Menu',
          parentId,
          responseType: 'static',
          content: '<p>Enter your response message here...</p>',
          order: menus.filter(m => m.parentId === parentId).length,
          attachedMenuIds: [],
          trackClicks: false,
          clickCount: 0,
          sessionClickCount: 0
        };

        const res = await csrfFetch('/api/menus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.status === 'error' || !json?.data) {
          throw new Error(json?.message || 'Failed to create menu.');
        }

        refresh();
        handleStartEdit(json.data);
        if (parentId) setExpandedFolders(prev => new Set([...prev, parentId]));
      } catch {
        toast({ title: "Error", description: "Could not create menu item.", variant: "destructive" });
      }
    })();
  };

  const handleStartEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setApiPreviewResult(null);
    setSentHeaders(null);
    setSentBody(null);

    const draft = getDraft(menu.id);
    if (draft) {
      setEditForm(draft);
      setIsEditDialogOpen(true);
      return;
    }

    const cloned = JSON.parse(JSON.stringify(menu));
    const hasPending = (menu.pendingStatus === 'pending' || menu.pendingStatus === 'rejected') && menu.pendingUpdate && typeof menu.pendingUpdate === 'object';
    const merged = hasPending ? { ...cloned, ...(menu.pendingUpdate as any) } : cloned;
    setEditForm(merged);
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
        const res = await csrfFetch(`/api/menus/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.status === 'error') {
          throw new Error(json?.message || 'Failed to save menu.');
        }
        discardDraft(editingId);
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
    (async () => {
      try {
        const res = await csrfFetch('/api/app-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const contentType = res.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
          ? await res.json().catch(() => null)
          : null;
        const text = payload ? '' : await res.text().catch(() => '');

        if (!res.ok || payload?.status === 'error') {
          const msg = payload?.message || payload?.error || text || `Failed to save settings (HTTP ${res.status}).`;
          throw new Error(msg);
        }
        if (!payload?.data) {
          throw new Error('Failed to save settings.');
        }
        setSettings(payload.data);
        const resolveSource = (img?: string) =>
          typeof img === 'string' && /^https?:\/\//i.test(img) ? 'url' : 'upload';
        setBotAvatarImageSource(resolveSource(payload.data?.botAvatarImage));
        setUserAvatarImageSource(resolveSource(payload.data?.userAvatarImage));
        setAppLogoSource(resolveSource(payload.data?.appLogo));
        toast({ title: "Settings Saved", description: "Languages and app settings updated." });
      } catch (err: any) {
        toast({ title: "Error", description: err?.message || "Failed to save settings.", variant: "destructive" });
      }
    })();
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

  const handleReportIdConfigChange = (key: keyof ReportIdConfig, value: any) => {
    setSettings(prev => ({
      ...prev,
      reportId: {
        ...(prev.reportId || defaultReportIdConfig),
        [key]: value
      }
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'botAvatarImage' | 'userAvatarImage' | 'appLogo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, [field]: reader.result as string }));
        if (field === 'botAvatarImage') setBotAvatarImageSource('upload');
        if (field === 'userAvatarImage') setUserAvatarImageSource('upload');
        if (field === 'appLogo') setAppLogoSource('upload');
      };
      reader.readAsDataURL(file);
    }
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
        category: 'fruit'
      };

      const rootKey = editForm.apiConfig.rootKey || 'data';

      const resolve = (str: string) => str.replace(/{{\s*(.*?)\s*}}/g, (match, p1) => {
        const key = p1.trim();
        if (key === 'user_token') return 'nib_static_token_778899';
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
          const pass = auth.basicAuth.pass || '1234';
          headers[headerName] = `Basic ${btoa(`${user}:${pass}`)}`;
        } else if (auth.type === 'bearer' && auth.bearer) {
          headers[headerName] = resolve(auth.bearer.template);
        }
      }

      const requestPayload: Record<string, any> = {};
      editForm.apiConfig.requestParameters?.forEach(param => {
        if (param.sourceType === 'kyc') requestPayload[param.apiKey] = sampleKyc[param.sourceValue] || `{{${param.sourceValue}}}`;
        else if (param.sourceValue === 'user.id') requestPayload[param.apiKey] = 'user_123';
        else if (param.sourceValue === 'user.token') requestPayload[param.apiKey] = 'nib_static_token_778899';
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

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = {
          status: 'error',
          message: 'The API returned a non-JSON response.',
          debug: {
            status: response.status,
            statusText: response.statusText,
            preview: responseText.substring(0, 300) + (responseText.length > 300 ? '...' : '')
          }
        };
      }

      setApiPreviewResult(data);
      if (response.ok && data.status !== 'error') toast({ title: "API Test Successful" });
      else toast({ title: "API Warning", description: `Status ${response.status}`, variant: "destructive" });
    } catch (e) {
      toast({ title: "API Network Error", variant: "destructive" });
    } finally {
      setIsTestingApi(false);
    }
  };

  const getAvailableFields = (obj: any, prefix = '', arraysOnly = false): string[] => {
    if (!obj || typeof obj !== 'object' || obj === null) return [];
    let fields: string[] = [];
    for (const key in obj) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const isArray = Array.isArray(obj[key]);

      if (isArray) {
        fields.push(currentPath);
        if (obj[key].length > 0 && typeof obj[key][0] === 'object') {
          fields.push(...getAvailableFields(obj[key][0], currentPath, arraysOnly));
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        fields.push(...getAvailableFields(obj[key], currentPath, arraysOnly));
      } else if (!arraysOnly) {
        fields.push(currentPath);
      }
    }
    return arraysOnly ? fields.filter(f => {
      const val = f.split('.').reduce((acc, part) => acc && acc[part], obj);
      return Array.isArray(val);
    }) : fields;
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    const effectiveMenus = menus.map(getEffectiveMenu);
    const items = effectiveMenus.filter(m => m.parentId === parentId).sort((a, b) => a.order - b.order);
    if (items.length === 0 && parentId !== null) return null;
    const isChecker = currentRole === 'checker';

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l pl-2 mt-1' : ''}`}>
        {items.map(item => {
          const originalItem = menus.find(m => m.id === item.id)!;
          const hasChildren = effectiveMenus.some(m => m.parentId === item.id);
          const approvalStatus = originalItem.approvalStatus || 'approved';
          const pendingStatus = originalItem.pendingStatus || null;
          const hasPendingUpdate = (pendingStatus === 'pending' || pendingStatus === 'rejected') && !!originalItem.pendingUpdate;

          const siblings = items;
          const otherSiblings = siblings.filter(s => s.id !== item.id);

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
                  {item.responseType === 'api' ? <Zap size={16} className="text-amber-500 shrink-0" /> : item.responseType === 'report' ? <ClipboardList size={16} className="text-emerald-500 shrink-0" /> : <MenuIcon size={16} className="text-primary shrink-0" />}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm font-medium">{item.name}</span>
                      {item.isActive === false && <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0">Suspended</Badge>}
                      {approvalStatus === 'pending' && <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-amber-600">Pending Approval</Badge>}
                      {approvalStatus === 'rejected' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-destructive cursor-help">Rejected</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Reason: {originalItem.rejectionReason || 'No reason provided.'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {approvalStatus === 'approved' && hasPendingUpdate && pendingStatus === 'pending' && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-sky-700">Pending Update</Badge>
                      )}
                      {approvalStatus === 'approved' && hasPendingUpdate && pendingStatus === 'rejected' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-destructive cursor-help">Update Rejected</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">Update Reason: {originalItem.pendingRejectionReason || 'No reason provided.'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {item.nameAm && <span className="truncate text-[10px] text-muted-foreground">{item.nameAm}</span>}
                    {(approvalStatus === 'rejected' || (approvalStatus === 'approved' && pendingStatus === 'rejected')) && (
                      <span className="truncate text-[9px] text-destructive/80 italic font-mono block mt-0.5">
                        REJECTED: {approvalStatus === 'rejected' ? originalItem.rejectionReason : originalItem.pendingRejectionReason}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isChecker && (approvalStatus === 'pending' || (approvalStatus === 'approved' && pendingStatus === 'pending')) && originalItem.createdBy !== currentUsername && originalItem.pendingCreatedBy !== currentUsername && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleApprove(item.id)} title="Approve Changes"><ShieldCheck size={14} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setRejectingId(item.id); setRejectReason(''); }} title="Reject Changes"><ShieldAlert size={14} /></Button>
                    </>
                  )}
                  {!isChecker && (
                    <>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isReordering}
                          onClick={() => swapWithNeighbor(item.id, -1)}
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isReordering}
                          onClick={() => swapWithNeighbor(item.id, 1)}
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </Button>
                        {otherSiblings.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                disabled={isReordering}
                                title="Swap with..."
                              >
                                <ListTree size={14} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-1" align="end">
                              <div className="text-[10px] font-bold px-2 py-1.5 text-muted-foreground uppercase border-b mb-1 flex items-center gap-2">
                                <ListTree size={12} />
                                <span>Swap "{item.name}" with:</span>
                              </div>
                              <ScrollArea className="h-64">
                                <div className="space-y-0.5 p-1">
                                  {otherSiblings.map((sibling, sIdx) => (
                                    <Button
                                      key={sibling.id}
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-2 px-3 text-xs group/item"
                                      onClick={() => swapWithOther(item.id, sibling.id)}
                                    >
                                      <div className="flex flex-col items-start min-w-0 flex-1">
                                        <span className="font-medium truncate w-full group-hover/item:text-primary transition-colors">{sibling.name}</span>
                                        {sibling.nameAm && <span className="text-[10px] text-muted-foreground truncate w-full italic">{sibling.nameAm}</span>}
                                      </div>
                                      <Badge variant="outline" className="ml-2 shrink-0 text-[9px] h-5 px-1.5 bg-muted/30">
                                        #{sibling.order + 1}
                                      </Badge>
                                    </Button>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </>
                  )}
                  {activeDraftIds.includes(item.id) && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => handleStartEdit(originalItem)} title="Resume Draft">
                         <FileCode size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => discardDraft(item.id)} title="Discard Draft">
                         <X size={14} />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleAdd(item.id)} title="Add Sub-menu"><FolderPlus size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(originalItem)} title="Edit Configuration"><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItemToDelete(item.id)} title="Delete Item"><Trash2 size={14} /></Button>
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
    const effectiveMenus = menus.map(getEffectiveMenu);
    const items = effectiveMenus.filter(m => m.parentId === parentId && m.id !== editingId)
      .filter(m => searchQuery === '' || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.order - b.order);

    if (items.length === 0 && parentId !== null) return null;

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-6 border-l pl-3' : ''}`}>
        {items.map(item => {
          const isSelected = editForm.attachedMenuIds?.includes(item.id);
          const isExpanded = expandedBrowserFolders.has(item.id);
          const hasChildren = effectiveMenus.some(m => m.parentId === item.id);

          return (
            <div key={item.id} className="space-y-1">
              <div className={cn("flex items-center gap-1 p-1 rounded-md transition-all hover:bg-muted/50 group", isSelected && "bg-primary/5 ring-1 ring-primary/10")}>
                <button onClick={(e) => { e.stopPropagation(); const next = new Set(expandedBrowserFolders); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); setExpandedBrowserFolders(next); }} className={cn("text-muted-foreground hover:text-primary transition-transform h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted", !hasChildren && "opacity-0 cursor-default pointer-events-none", isExpanded ? 'rotate-0' : '-rotate-90')} disabled={!hasChildren}><ChevronDown size={16} /></button>
                <div className="flex items-center gap-2 flex-1 cursor-pointer py-1 pr-2" onClick={() => { const currentIds = editForm.attachedMenuIds || []; if (!isSelected) setEditForm({ ...editForm, attachedMenuIds: [...currentIds, item.id] }); else setEditForm({ ...editForm, attachedMenuIds: currentIds.filter(id => id !== item.id) }); }}>
                  <Checkbox checked={isSelected} className="h-4 w-4 rounded-sm" />
                  <div className="flex flex-col min-w-0"><span className="text-xs font-medium truncate">{item.name}</span></div>
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

  const FieldPicker = ({ onSelect, currentFields, mode = 'path', title = 'Detected Fields' }: { onSelect: (field: string) => void, currentFields: string[], mode?: 'path' | 'placeholder', title?: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 shrink-0">
          <Wand2 size={12} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Sparkles size={10} className="text-primary" />
          <span className="text-[10px] font-bold uppercase text-muted-foreground">{title}</span>
        </div>
        <ScrollArea className="h-56">
          <div className="space-y-1 pr-2">
            {currentFields.length > 0 ? (
              currentFields.map(field => {
                const rootKey = editForm.apiConfig?.rootKey || 'data';
                const finalField = mode === 'placeholder' ? `{{${rootKey}.${field}}}` : field;
                return (
                  <Button
                    key={field}
                    variant="ghost"
                    className="w-full justify-start h-8 text-[11px] px-2 font-mono truncate"
                    onClick={() => onSelect(finalField)}
                  >
                    {field}
                  </Button>
                );
              })
            ) : (
              <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                {editForm.responseType === 'report' ? (
                  <div className="space-y-1">
                    {mode === 'placeholder' && <Button variant="ghost" className="w-full justify-start h-8 text-[11px] px-2 font-mono truncate" onClick={() => onSelect(`{{${editForm.apiConfig?.rootKey || 'data'}.id}}`)}>id (Reference ID)</Button>}
                    {kycFieldsList.map(f => (
                      <Button key={f.id} variant="ghost" className="w-full justify-start h-8 text-[11px] px-2 font-mono truncate" onClick={() => onSelect(mode === 'placeholder' ? `{{${f.name}}}` : f.name)}>{f.name}</Button>
                    ))}
                  </div>
                ) : 'Test API first to see fields.'}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  const getCurrentLanguage = () => settings.supportedLanguages.find(l => l.code === activeLangTab) || settings.supportedLanguages.find(l => l.isDefault) || settings.supportedLanguages[0];

  const closeEditor = () => {
    setIsEditDialogOpen(false);
    setEditingId(null);
    setEditForm({});
    setApiPreviewResult(null);
    setSentHeaders(null);
    setSentBody(null);
    setSearchQuery('');
  };

  return (
    <div className="w-full">
      {isEditDialogOpen ? (
        <div className="min-h-[100dvh] bg-background">
          <div className="sticky top-16 z-40 bg-card border-b shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
              <Button variant="ghost" onClick={closeEditor} className="shrink-0">
                <ChevronRight size={16} className="mr-2 rotate-180" />
                Back
              </Button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">Configure {editForm.name || 'Menu'}</div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="space-y-8 pb-24">
              {(() => {
                const item = menus.find(m => m.id === editingId);
                const isItemRejected = item?.approvalStatus === 'rejected';
                const isUpdateRejected = item?.approvalStatus === 'approved' && item?.pendingStatus === 'rejected';
                const reason = isItemRejected ? item?.rejectionReason : (isUpdateRejected ? item?.pendingRejectionReason : null);

                if (reason) {
                  return (
                    <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                      <ShieldAlert className="text-destructive shrink-0 mt-0.5" size={20} />
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-destructive">This configuration was rejected by a checker.</div>
                        <div className="text-xs text-destructive/90 bg-card/50 p-3 rounded-lg border border-destructive/10 leading-relaxed">
                          <strong>Reason:</strong> {reason}
                        </div>
                        <div className="text-[10px] text-muted-foreground pt-1 italic font-medium">
                          Review the reason above, make changes, and save to resubmit for approval.
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="grid gap-6 sm:grid-cols-4 bg-muted/10 p-4 rounded-xl border">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                  <Select value={editForm.responseType} onValueChange={(v: any) => setEditForm({ ...editForm, responseType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static Response</SelectItem>
                      <SelectItem value="api">API Action</SelectItem>
                      <SelectItem value="report">Internal Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Display Order</Label>
                  <Input type="number" value={editForm.order || 0} onChange={e => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex flex-col justify-center space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <ShieldCheck size={12} className="text-primary" /> Visible To Users
                  </Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editForm.isActive !== false}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: Boolean(checked) })}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">
                      {editForm.isActive === false ? 'Suspended' : 'Enabled'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Fingerprint size={12} className="text-primary" /> Enable Click Tracking
                  </Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editForm.trackClicks || false}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, trackClicks: checked })}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">
                      {editForm.trackClicks ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold flex items-center gap-2"><Languages size={16} className="text-primary" /> Localization & Label</Label>
                <Tabs value={activeLangTab} onValueChange={setActiveLangTab} className="w-full border rounded-xl overflow-hidden bg-card shadow-sm">
                  <TabsList className="w-full justify-start rounded-none border-b h-12 bg-muted/20 px-4 gap-2">
                    {settings.supportedLanguages.map(lang => (
                      <TabsTrigger key={lang.code} value={lang.code} className="data-[state=active]:bg-card rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 text-xs">
                        {lang.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {settings.supportedLanguages.map(lang => (
                    <TabsContent key={lang.code} value={lang.code} className="p-6 space-y-6 mt-0">
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
                        />
                      </div>

                      <Accordion type="single" collapsible className="w-full pt-2">
                        <AccordionItem value="content-editor" className="border rounded-xl px-4 py-0 bg-muted/5">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer flex items-center gap-2">
                              <FileText size={14} className="text-primary" />
                              {editForm.responseType === 'static' ? 'Response Content' : 'Introductory Content'} ({lang.name})
                            </Label>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-4">
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
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {(editForm.responseType === 'api' || editForm.responseType === 'report') && (
                <div className="space-y-8 pt-4">
                  {editForm.responseType === 'api' && (
                    <Card>
                      <CardHeader className="bg-muted/10 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">API Connectivity</CardTitle>
                        <Button variant="outline" size="sm" onClick={testApi} disabled={isTestingApi}>
                          {isTestingApi ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />} Live Preview
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Method</Label>
                            <Select value={editForm.apiConfig?.method} onValueChange={v => deepUpdate(['apiConfig', 'method'], v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              Root Mapping Key
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild><Info size={10} className="text-muted-foreground cursor-help" /></TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-[10px]">Define the root variable for your templates. E.g., if you set this to <b>data</b>, your placeholders should be <b>{`{{data.status}}`}</b>.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                            <Input
                              value={editForm.apiConfig?.rootKey || 'data'}
                              placeholder="e.g. data"
                              onChange={e => deepUpdate(['apiConfig', 'rootKey'], e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Endpoint URL</Label>
                            <Input value={editForm.apiConfig?.endpoint || ''} onChange={e => deepUpdate(['apiConfig', 'endpoint'], e.target.value)} placeholder="e.g. /api/test/profile/{{account_id}}" />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-6">
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
                                    <Input placeholder="X-API-KEY" value={editForm.apiConfig?.authConfig?.apiKey?.header || ''} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'apiKey', 'header'], e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold">Key Value</Label>
                                    <Input placeholder="secret-123" value={editForm.apiConfig?.authConfig?.apiKey?.value || ''} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'apiKey', 'value'], e.target.value)} />
                                  </div>
                                </div>
                              )}

                              {editForm.apiConfig?.authConfig?.type === 'basic' && (
                                <div className="space-y-4 p-4 border rounded-md bg-muted/5">
                                  <div className="space-y-1 mb-2">
                                    <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                                    <Input placeholder="Authorization" value={editForm.apiConfig?.authConfig?.basicAuth?.header || ''} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'header'], e.target.value)} />
                                  </div>
                                  <div className="space-y-3">
                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Username</Label><Input value={editForm.apiConfig?.authConfig?.basicAuth?.user || ''} onChange={e => { deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'user'], e.target.value); }} /></div>
                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Password</Label><Input type="password" value={editForm.apiConfig?.authConfig?.basicAuth?.pass || ''} onChange={e => { deepUpdate(['apiConfig', 'authConfig', 'basicAuth', 'pass'], e.target.value); }} /></div>
                                  </div>
                                </div>
                              )}

                              {editForm.apiConfig?.authConfig?.type === 'bearer' && (
                                <div className="space-y-3 p-3 border rounded-md bg-muted/5">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                                    <Input placeholder="Authorization" value={editForm.apiConfig?.authConfig?.bearer?.header || ''} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'bearer', 'header'], e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold">Token Template</Label>
                                    <Input placeholder="Bearer {{user_token}}" value={editForm.apiConfig?.authConfig?.bearer?.template || ''} onChange={e => deepUpdate(['apiConfig', 'authConfig', 'bearer', 'template'], e.target.value)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold uppercase flex items-center gap-2"><LinkIcon size={14} className="text-primary" /> Custom Headers</Label>
                              <Button variant="ghost" size="sm" onClick={() => {
                                const currentHeaders = { ...(editForm.apiConfig?.headers || {}) };
                                currentHeaders['New-Header-' + Math.random().toString(36).substr(2, 4)] = '';
                                deepUpdate(['apiConfig', 'headers'], currentHeaders);
                              }}><Plus className="mr-1 h-3 w-3" /> Add Header</Button>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(editForm.apiConfig?.headers || {}).map(([key, value]) => (
                                <div key={key} className="flex gap-2 items-center group">
                                  <Input
                                    value={key || ''}
                                    onChange={e => {
                                      const h = { ...(editForm.apiConfig?.headers || {}) };
                                      const val = h[key];
                                      delete h[key];
                                      h[e.target.value] = val;
                                      deepUpdate(['apiConfig', 'headers'], h);
                                    }}
                                    className="flex-1 font-mono text-xs"
                                  />
                                  <Input
                                    value={value || ''}
                                    onChange={e => {
                                      const h = { ...(editForm.apiConfig?.headers || {}) };
                                      h[key] = e.target.value;
                                      deepUpdate(['apiConfig', 'headers'], h);
                                    }}
                                    className="flex-1 font-mono text-xs"
                                  />
                                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 shrink-0" onClick={() => {
                                    const h = { ...(editForm.apiConfig?.headers || {}) };
                                    delete h[key];
                                    deepUpdate(['apiConfig', 'headers'], h);
                                  }}><Trash2 size={14} /></Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {apiPreviewResult && (
                          <div className="bg-slate-950 p-3 rounded-md border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] text-emerald-400 font-bold uppercase">Latest API Response:</span>
                              <Button variant="ghost" size="sm" className="h-6 text-[9px] text-muted-foreground hover:text-white" onClick={() => setApiPreviewResult(null)}>Clear</Button>
                            </div>
                            <ScrollArea className="h-48">
                              <pre className={cn("text-[10px] font-mono whitespace-pre-wrap", apiPreviewResult.status === 'error' ? 'text-red-400' : 'text-emerald-400')}>
                                {JSON.stringify(apiPreviewResult, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="bg-muted/10">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{editForm.responseType === 'report' ? 'Report Configuration' : 'User Input & Mapping'}</CardTitle>
                        {editForm.responseType === 'report' && (
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 border-r pr-6 border-muted/20">
                              <Label htmlFor="hide-id" className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Show ID to User</Label>
                              <Switch
                                id="hide-id"
                                checked={!editForm.apiConfig?.responseMapping?.hideReportId}
                                onCheckedChange={checked => deepUpdate(['apiConfig', 'responseMapping', 'hideReportId'], !checked)}
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Priority</Label>
                              <Select
                                value={editForm.apiConfig?.defaultPriority || 'medium'}
                                onValueChange={v => deepUpdate(['apiConfig', 'defaultPriority'], v)}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Support</Label>
                              <Select
                                value={typeof editForm.supportAssignee === 'string' && editForm.supportAssignee ? editForm.supportAssignee : '__none__'}
                                onValueChange={v => deepUpdate(['supportAssignee'], v === '__none__' ? null : v)}
                              >
                                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Unassigned</SelectItem>
                                  {supportUsers.map(u => (
                                    <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">1. Collected Fields</Label>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const fields = editForm.apiConfig?.kycFields || [];
                            deepUpdate(['apiConfig', 'kycFields'], [...fields, { id: Math.random().toString(36).substr(2, 9), name: '', prompt: '', promptAm: '', type: 'text', order: fields.length, required: true }]);
                          }}><Plus className="mr-1" /> Add Field</Button>
                        </div>
                        {editForm.apiConfig?.kycFields?.map((field, idx) => {
                          const lang = getCurrentLanguage();
                          const isDefault = lang.code === settings.supportedLanguages.find(l => l.isDefault)?.code || lang.isDefault;
                          const currentPrompt = isDefault ? (field.prompt || '') : (lang.code === 'am' ? (field.promptAm || '') : (field.prompt || ''));

                          return (
                            <div key={field.id} className="flex flex-col gap-3 p-4 border rounded-md bg-muted/5 group relative">
                              <div className="grid grid-cols-4 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Field Key</Label><Input value={field.name || ''} onChange={e => { const fields = [...editForm.apiConfig!.kycFields]; fields[idx].name = e.target.value; deepUpdate(['apiConfig', 'kycFields'], fields); }} /></div>
                                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Type</Label><Select value={field.type} onValueChange={v => { const fields = [...editForm.apiConfig!.kycFields]; fields[idx].type = v as any; deepUpdate(['apiConfig', 'kycFields'], fields); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="tel">Phone</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="number">Number</SelectItem><SelectItem value="password">Password</SelectItem><SelectItem value="boolean">Boolean (Switch)</SelectItem></SelectContent></Select></div>
                                <div className="col-span-2 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase font-bold">Prompt ({lang.name})</Label>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-[9px] uppercase font-bold text-muted-foreground">{field.required ? 'Mandatory' : 'Optional'}</Label>
                                      <Switch checked={field.required} onCheckedChange={checked => {
                                        const fields = [...editForm.apiConfig!.kycFields];
                                        fields[idx].required = checked;
                                        deepUpdate(['apiConfig', 'kycFields'], fields);
                                      }} />
                                    </div>
                                  </div>
                                  <Input value={currentPrompt} onChange={e => {
                                    const fields = [...editForm.apiConfig!.kycFields];
                                    if (isDefault) fields[idx].prompt = e.target.value;
                                    else if (lang.code === 'am') fields[idx].promptAm = e.target.value;
                                    deepUpdate(['apiConfig', 'kycFields'], fields);
                                  }} />
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-card border text-destructive opacity-0 group-hover:opacity-100" onClick={() => { const fields = editForm.apiConfig!.kycFields.filter((_, i) => i !== idx); deepUpdate(['apiConfig', 'kycFields'], fields); }}><Trash2 size={12} /></Button>
                            </div>
                          );
                        })}
                      </div>

                      {editForm.responseType === 'api' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase">2. API Request Mapping</Label><Button variant="ghost" size="sm" onClick={() => { const params = editForm.apiConfig?.requestParameters || []; deepUpdate(['apiConfig', 'requestParameters'], [...params, { apiKey: '', sourceType: 'kyc', sourceValue: '', isEnabled: true, isUserConfigurable: true }]); }}><Link2 className="mr-1" /> Map Parameter</Button></div>
                          <div className="space-y-3">
                            {editForm.apiConfig?.requestParameters?.map((param, idx) => (
                              <div key={idx} className="p-3 border rounded-lg space-y-3 bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={param.isEnabled !== false}
                                    onCheckedChange={(checked) => {
                                      const params = [...editForm.apiConfig!.requestParameters];
                                      params[idx].isEnabled = checked;
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                  />
                                  <Label className="text-sm font-medium">Enabled</Label>
                                  {param.sourceType === 'admin_default' && (
                                    <Badge variant="outline" className="ml-auto">Admin Default</Badge>
                                  )}
                                </div>

                                <div className="flex gap-2 items-center">
                                  <Input
                                    placeholder="API Param Key"
                                    value={param.apiKey}
                                    onChange={e => {
                                      const params = [...editForm.apiConfig!.requestParameters];
                                      params[idx].apiKey = e.target.value;
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                    className="flex-1"
                                    disabled={param.isEnabled === false}
                                  />

                                  <Select
                                    value={param.sourceType}
                                    onValueChange={v => {
                                      const params = [...editForm.apiConfig!.requestParameters];
                                      params[idx].sourceType = v as any;
                                      if (v === 'user_profile') {
                                        params[idx].sourceValue = 'user.id';
                                      } else if (v === 'admin_default') {
                                        params[idx].sourceValue = '';
                                        params[idx].isUserConfigurable = false;
                                      } else if (v === 'kyc') {
                                        params[idx].sourceValue = kycFieldsList[0]?.name || '';
                                        params[idx].isUserConfigurable = true;
                                      }
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                    disabled={param.isEnabled === false}
                                  >
                                    <SelectTrigger className="w-40"><SelectValue placeholder="Source Type" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="kyc">KYC Field</SelectItem>
                                      <SelectItem value="static">Static Value</SelectItem>
                                      <SelectItem value="user_profile">User Profile</SelectItem>
                                      <SelectItem value="admin_default">Admin Default</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive h-8 w-8 shrink-0"
                                    onClick={() => {
                                      const params = editForm.apiConfig!.requestParameters.filter((_, i) => i !== idx);
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>

                                {param.sourceType === 'kyc' && (
                                  <Select
                                    value={param.sourceValue}
                                    onValueChange={v => {
                                      const params = [...editForm.apiConfig!.requestParameters];
                                      params[idx].sourceValue = v;
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                    disabled={param.isEnabled === false}
                                  >
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select KYC Field" /></SelectTrigger>
                                    <SelectContent>{kycFieldsList.map(f => <SelectItem key={f.id} value={f.name}>KYC: {f.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                )}

                                {param.sourceType === 'static' && (
                                  <Input
                                    placeholder="Static Value"
                                    value={param.sourceValue}
                                    onChange={e => {
                                      const params = [...editForm.apiConfig!.requestParameters];
                                      params[idx].sourceValue = e.target.value;
                                      deepUpdate(['apiConfig', 'requestParameters'], params);
                                    }}
                                    disabled={param.isEnabled === false}
                                  />
                                )}

                                {param.sourceType === 'admin_default' && (
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="Default Value (Admin Configured)"
                                      value={param.sourceValue}
                                      onChange={e => {
                                        const params = [...editForm.apiConfig!.requestParameters];
                                        params[idx].sourceValue = e.target.value;
                                        deepUpdate(['apiConfig', 'requestParameters'], params);
                                      }}
                                      disabled={param.isEnabled === false}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={param.isUserConfigurable !== false}
                                        onCheckedChange={(checked) => {
                                          const params = [...editForm.apiConfig!.requestParameters];
                                          params[idx].isUserConfigurable = checked;
                                          deepUpdate(['apiConfig', 'requestParameters'], params);
                                        }}
                                        disabled={param.isEnabled === false}
                                      />
                                      <Label className="text-xs text-muted-foreground">Allow user override</Label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="bg-muted/10"><CardTitle className="text-sm">Response View Mapping</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Tabs value={editForm.apiConfig?.responseMapping?.type || 'message'} onValueChange={v => deepUpdate(['apiConfig', 'responseMapping', 'type'], v)}>
                        <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-muted/50 h-10">
                          <TabsTrigger value="message" className="data-[state=active]:bg-card rounded-none border-r"><Type size={14} className="mr-2" /> Message Template</TabsTrigger>
                          <TabsTrigger value="table" disabled={editForm.responseType === 'report'} className="data-[state=active]:bg-card rounded-none"><TableIcon size={14} className="mr-2" /> Result Table</TabsTrigger>
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
                                  <WysiwygEditor
                                    title="Success Message"
                                    value={templateVal || ''}
                                    onChange={handleTemplateChange}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Fallback ({lang.name})</Label>
                                    <FieldPicker
                                      mode="placeholder"
                                      currentFields={getAvailableFields(apiPreviewResult)}
                                      onSelect={(val) => handleErrorChange(errorVal + val)}
                                    />
                                  </div>
                                  <Input value={errorVal || ''} onChange={e => handleErrorChange(e.target.value)} />
                                </div>
                              </div>
                            );
                          })()}
                        </TabsContent>

                        <TabsContent value="table" className="p-4 space-y-4 mt-0">
                          {(() => {
                            const lang = getCurrentLanguage();
                            const isDefault = lang.code === settings.supportedLanguages.find(l => l.isDefault)?.code || lang.isDefault;

                            const tableIntroVal = isDefault
                              ? (editForm.apiConfig?.responseMapping?.tableIntro || '')
                              : (lang.code === 'am' ? (editForm.apiConfig?.responseMapping?.tableIntroAm || '') : (editForm.translations?.[lang.code]?.tableIntro || ''));

                            const errorVal = isDefault
                              ? (editForm.apiConfig?.responseMapping?.errorFallback || '')
                              : (lang.code === 'am' ? (editForm.apiConfig?.responseMapping?.errorFallbackAm || '') : (editForm.translations?.[lang.code]?.errorFallback || ''));

                            const handleTableIntroChange = (val: string) => {
                              if (isDefault) deepUpdate(['apiConfig', 'responseMapping', 'tableIntro'], val);
                              else if (lang.code === 'am') deepUpdate(['apiConfig', 'responseMapping', 'tableIntroAm'], val);
                              else {
                                const translations = { ...(editForm.translations || {}) };
                                translations[lang.code] = { ...(translations[lang.code] || {}), tableIntro: val };
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
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Intro Message / Template ({lang.name})</Label>
                                    <FieldPicker
                                      mode="placeholder"
                                      currentFields={getAvailableFields(apiPreviewResult)}
                                      onSelect={(val) => handleTableIntroChange(tableIntroVal + val)}
                                    />
                                  </div>
                                  <WysiwygEditor
                                    title="Intro Message"
                                    value={tableIntroVal || ''}
                                    onChange={handleTableIntroChange}
                                  />
                                  <p className="text-[9px] text-muted-foreground italic">If left empty, the system defaults to "Here are the results:"</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Fallback ({lang.name})</Label>
                                    <FieldPicker
                                      mode="placeholder"
                                      currentFields={getAvailableFields(apiPreviewResult)}
                                      onSelect={(val) => handleErrorChange(errorVal + val)}
                                    />
                                  </div>
                                  <Input value={errorVal || ''} onChange={e => handleErrorChange(e.target.value)} />
                                </div>

                                <Separator />

                                <div className="space-y-3 p-4 border rounded-xl bg-muted/5">
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground border-b pb-2 flex items-center gap-2">Table Mapping Mode</Label>
                                  <Select
                                    value={editForm.apiConfig?.responseMapping?.tableMappingMode || 'array_path'}
                                    onValueChange={v => deepUpdate(['apiConfig', 'responseMapping', 'tableMappingMode'], v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="array_path">Array Path (Legacy Engine)</SelectItem>
                                      <SelectItem value="exact_path">Exact Path (Unified Engine)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-[9px] text-muted-foreground">
                                    {(editForm.apiConfig?.responseMapping?.tableMappingMode || 'array_path') === 'array_path'
                                      ? 'Define a path to an array (e.g. data.items) to loop rows automatically.'
                                      : 'Map each column to an exact full path (e.g. data.rates[0].currency) without automatic array looping.'}
                                  </p>
                                </div>

                                {(editForm.apiConfig?.responseMapping?.tableMappingMode || 'array_path') === 'array_path' && (
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Table Data Key (Array Path)</Label>
                                        <FieldPicker
                                          title="Array Paths Found"
                                          currentFields={getAvailableFields(apiPreviewResult, '', true)}
                                          onSelect={(field) => {
                                            const root = editForm.apiConfig?.rootKey || 'data';
                                            deepUpdate(['apiConfig', 'responseMapping', 'tableDataKey'], `${root}.${field}`);
                                          }}
                                        />
                                      </div>
                                      <Input
                                        placeholder={`e.g. ${editForm.apiConfig?.rootKey || 'data'}.items`}
                                        value={editForm.apiConfig?.responseMapping?.tableDataKey || ''}
                                        onChange={e => deepUpdate(['apiConfig', 'responseMapping', 'tableDataKey'], e.target.value)}
                                      />
                                    </div>
                                    <Separator />
                                  </div>
                                )}

                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase"><TableIcon size={14} /> Column Mapping</Label>
                                  <Button variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => { const cols = editForm.apiConfig?.responseMapping?.tableColumns || []; deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], [...cols, { header: 'New Column', key: '' }]); }}><Plus className="mr-1 h-3 w-3" /> Add Column</Button>
                                </div>
                                <div className="space-y-2">
                                  {editForm.apiConfig?.responseMapping?.tableColumns?.map((col, idx) => {
                                    const lang = getCurrentLanguage();
                                    const isDefault = lang.code === settings.supportedLanguages.find(l => l.isDefault)?.code || lang.isDefault;
                                    const headerVal = isDefault ? (col.header || '') : (lang.code === 'am' ? (col.headerAm || '') : (editForm.translations?.[lang.code]?.tableHeaders?.[col.key] || ''));

                                    return (
                                      <div key={idx} className="flex gap-3 p-3 border rounded-md bg-card group relative shadow-sm items-end">
                                        <div className="flex-1 space-y-1">
                                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Header ({lang.name})</Label>
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
                                          <Input className="h-8 text-xs font-mono" value={col.key || ''} onChange={e => { const cols = [...editForm.apiConfig!.responseMapping.tableColumns!]; cols[idx].key = e.target.value; deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols); }} />
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => { const cols = editForm.apiConfig!.responseMapping.tableColumns!.filter((_, i) => i !== idx); deepUpdate(['apiConfig', 'responseMapping', 'tableColumns'], cols); }}><Trash2 size={14} /></Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Separator />

              <div className="pt-8">
                <Label className="text-sm font-bold flex items-center gap-2 mb-4"><ListTree size={16} /> Attach Related Menus</Label>
                <div className="bg-card rounded-xl border p-4 shadow-sm">
                  <div className="mb-4">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Attachments Description (displayed above related items)</Label>
                    <Input value={editForm.attachmentDescription || ''} onChange={(e) => setEditForm({ ...editForm, attachmentDescription: e.target.value })} placeholder="e.g. Related" />
                  </div>
                  <div className="relative mb-4">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search menus..." value={searchQuery || ''} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
                  </div>
                  {renderBrowserTree(null)}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-40 bg-card border-t">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={closeEditor}>Back</Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Save Changes
              </Button>
            </div>
          </div>
        </div>
      ) : (
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
              <Tabs defaultValue="languages">
                <TabsList className="grid grid-cols-5 mb-6">
                  <TabsTrigger value="general" className="flex items-center gap-2">
                    <Settings2 size={14} /> General
                  </TabsTrigger>
                  <TabsTrigger value="languages" className="flex items-center gap-2">
                    <Languages size={14} /> Languages
                  </TabsTrigger>
                  <TabsTrigger value="report-id" className="flex items-center gap-2">
                    <Hash size={14} /> Report ID
                  </TabsTrigger>
                  <TabsTrigger value="avatars" className="flex items-center gap-2">
                    <UserCircle size={14} /> Avatars
                  </TabsTrigger>
                  <TabsTrigger value="logos" className="flex items-center gap-2">
                    <LinkIcon size={14} /> Logos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                  <div className="space-y-4 border p-4 rounded-lg bg-card shadow-sm">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Settings2 className="text-primary" size={18} />
                      General Settings
                    </h3>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/5">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold">Show Admin Settings Icon (User UI)</Label>
                        <p className="text-[10px] text-muted-foreground italic">Controls whether the settings icon appears between Home and Back for users.</p>
                      </div>
                      <Switch
                        checked={settings.showAdminPanelIcon ?? true}
                        onCheckedChange={(val) => setSettings(prev => ({ ...prev, showAdminPanelIcon: val }))}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="languages">
                  <Card className="border-none shadow-none">
                    <CardHeader className="px-0 pt-0">
                      <CardTitle className="text-sm font-bold">Language Management</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase">Supported Languages</Label>
                          <Button variant="outline" size="sm" onClick={addLanguage}><Plus className="mr-2 h-4 w-4" /> Add Language</Button>
                        </div>
                        <div className="grid gap-3">
                          {settings.supportedLanguages.map((lang, idx) => (
                            <div key={idx} className="flex gap-3 items-center p-3 border rounded-lg bg-muted/5 group">
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
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="report-id" className="space-y-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                        <Hash className="text-primary" size={18} />
                        Report ID Formatting
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="prefix" className="text-xs font-bold uppercase text-muted-foreground">System Prefix</Label>
                            <Input
                              id="prefix"
                              value={settings.reportId?.prefix || ''}
                              onChange={(e) => handleReportIdConfigChange('prefix', e.target.value.toUpperCase())}
                              placeholder="e.g., NIB"
                              className="font-bold uppercase"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/5">
                            <div className="space-y-0.5">
                              <Label className="text-xs font-bold">Include Current Year</Label>
                              <p className="text-[10px] text-muted-foreground italic">Appends -{new Date().getFullYear()} after the prefix.</p>
                            </div>
                            <Switch
                              checked={settings.reportId?.yearEnabled || false}
                              onCheckedChange={(val) => handleReportIdConfigChange('yearEnabled', val)}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="numberLength" className="text-xs font-bold uppercase text-muted-foreground">Digit Length</Label>
                              <Input
                                id="numberLength"
                                type="number"
                                min={1}
                                max={20}
                                value={settings.reportId?.numberLength || 6}
                                onChange={(e) => handleReportIdConfigChange('numberLength', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="startValue" className="text-xs font-bold uppercase text-muted-foreground">Start Value</Label>
                              <Input
                                id="startValue"
                                type="number"
                                value={settings.reportId?.startValue || 100000}
                                onChange={(e) => handleReportIdConfigChange('startValue', parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/5">
                            <div className="space-y-0.5">
                              <Label className="text-xs font-bold">Yearly Reset</Label>
                              <p className="text-[10px] text-muted-foreground italic">Reset to start value on Jan 1st.</p>
                            </div>
                            <Switch
                              checked={settings.reportId?.resetEveryYear || false}
                              onCheckedChange={(val) => handleReportIdConfigChange('resetEveryYear', val)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Live ID Preview</p>
                          <div className="text-2xl font-mono font-bold tracking-tighter text-primary">
                            {settings.reportId?.prefix || 'NIB'}
                            {settings.reportId?.yearEnabled ? `-${new Date().getFullYear()}` : ''}
                            -{String(settings.reportId?.startValue || 100000).padStart(settings.reportId?.numberLength || 6, '0')}
                          </div>
                        </div>
                        <Info size={24} className="text-primary/20" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="avatars" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bot Avatar Config */}
                    <div className="space-y-4 border p-4 rounded-lg bg-card shadow-sm">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Bot</Badge>
                        Bot Avatar
                      </h3>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Avatar Type</Label>
                        <Select
                          value={settings.botAvatarType || 'text'}
                          onValueChange={(val: any) => setSettings({ ...settings, botAvatarType: val })}
                        >
                          <SelectTrigger className="bg-muted/5">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text (Initials)</SelectItem>
                            <SelectItem value="image">Image / Local Upload</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {settings.botAvatarType === 'image' ? (
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Image Source</Label>
                            <Select
                              value={botAvatarImageSource}
                              onValueChange={(val: any) => {
                                const next = val === 'url' ? 'url' : 'upload';
                                setBotAvatarImageSource(next);
                                setSettings(prev => ({
                                  ...prev,
                                  botAvatarImage: next === 'url'
                                    ? (typeof prev.botAvatarImage === 'string' && /^https?:\/\//i.test(prev.botAvatarImage) ? prev.botAvatarImage : '')
                                    : (typeof prev.botAvatarImage === 'string' && (prev.botAvatarImage.startsWith('data:image/') || prev.botAvatarImage.startsWith('/uploads/')) ? prev.botAvatarImage : '')
                                }));
                              }}
                            >
                              <SelectTrigger className="bg-muted/5">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="upload">Local Upload</SelectItem>
                                <SelectItem value="url">Image URL</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {botAvatarImageSource === 'upload' ? (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Local Image Upload</Label>
                              <Input
                                key="bot-avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'botAvatarImage')}
                                className="text-xs h-9 bg-muted/5 border-dashed"
                              />
                              {typeof settings.botAvatarImage === 'string' && settings.botAvatarImage.startsWith('/uploads/') ? (
                                <div className="text-[10px] text-muted-foreground font-mono truncate">Saved: {settings.botAvatarImage}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Image URL</Label>
                              <Input
                                key="bot-avatar-url"
                                placeholder="https://example.com/bot-avatar.png"
                                value={(typeof settings.botAvatarImage === 'string' && /^https?:\/\//i.test(settings.botAvatarImage)) ? settings.botAvatarImage : ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBotAvatarImageSource('url');
                                  setSettings(prev => ({ ...prev, botAvatarImage: v }));
                                }}
                                className="text-xs h-9 font-mono bg-muted/5"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Initials Text</Label>
                          <Input
                            placeholder="TT"
                            value={settings.botAvatarText || ''}
                            onChange={(e) => setSettings({ ...settings, botAvatarText: e.target.value })}
                            className="bg-muted/5 font-bold uppercase tracking-widest h-10"
                          />
                          <p className="text-[10px] text-muted-foreground italic">Will fallback to 'TT' if not provided.</p>
                        </div>
                      )}
                    </div>

                    {/* User Avatar Config */}
                    <div className="space-y-4 border p-4 rounded-lg bg-card shadow-sm">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">User</Badge>
                        User Avatar
                      </h3>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Avatar Type</Label>
                        <Select
                          value={settings.userAvatarType || 'text'}
                          onValueChange={(val: any) => setSettings({ ...settings, userAvatarType: val })}
                        >
                          <SelectTrigger className="bg-muted/5">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text (Initials)</SelectItem>
                            <SelectItem value="image">Image / Local Upload</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {settings.userAvatarType === 'image' ? (
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Image Source</Label>
                            <Select
                              value={userAvatarImageSource}
                              onValueChange={(val: any) => {
                                const next = val === 'url' ? 'url' : 'upload';
                                setUserAvatarImageSource(next);
                                setSettings(prev => ({
                                  ...prev,
                                  userAvatarImage: next === 'url'
                                    ? (typeof prev.userAvatarImage === 'string' && /^https?:\/\//i.test(prev.userAvatarImage) ? prev.userAvatarImage : '')
                                    : (typeof prev.userAvatarImage === 'string' && (prev.userAvatarImage.startsWith('data:image/') || prev.userAvatarImage.startsWith('/uploads/')) ? prev.userAvatarImage : '')
                                }));
                              }}
                            >
                              <SelectTrigger className="bg-muted/5">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="upload">Local Upload</SelectItem>
                                <SelectItem value="url">Image URL</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {userAvatarImageSource === 'upload' ? (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Local Image Upload</Label>
                              <Input
                                key="user-avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'userAvatarImage')}
                                className="text-xs h-9 bg-muted/5 border-dashed"
                              />
                              {typeof settings.userAvatarImage === 'string' && settings.userAvatarImage.startsWith('/uploads/') ? (
                                <div className="text-[10px] text-muted-foreground font-mono truncate">Saved: {settings.userAvatarImage}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Image URL</Label>
                              <Input
                                key="user-avatar-url"
                                placeholder="https://example.com/user-avatar.png"
                                value={(typeof settings.userAvatarImage === 'string' && /^https?:\/\//i.test(settings.userAvatarImage)) ? settings.userAvatarImage : ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setUserAvatarImageSource('url');
                                  setSettings(prev => ({ ...prev, userAvatarImage: v }));
                                }}
                                className="text-xs h-9 font-mono bg-muted/5"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Initials Text</Label>
                          <Input
                            placeholder="ME"
                            value={settings.userAvatarText || ''}
                            onChange={(e) => setSettings({ ...settings, userAvatarText: e.target.value })}
                            className="bg-muted/5 font-bold uppercase tracking-widest h-10"
                          />
                          <p className="text-[10px] text-muted-foreground italic">Will fallback to 'ME' if not provided.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logos" className="space-y-6">
                  <div className="space-y-6">
                    <div className="space-y-4 border p-4 rounded-lg bg-card shadow-sm">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <LinkIcon className="text-primary" size={18} />
                        Branding Logo
                      </h3>
                      <p className="text-xs text-muted-foreground italic">Update the official bank logo used across the application header and welcome screen.</p>

                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Logo Source</Label>
                          <Select
                            value={appLogoSource}
                            onValueChange={(val: any) => {
                              const next = val === 'url' ? 'url' : 'upload';
                              setAppLogoSource(next);
                              setSettings(prev => ({
                                ...prev,
                                appLogo: next === 'url'
                                  ? (typeof prev.appLogo === 'string' && /^https?:\/\//i.test(prev.appLogo) ? prev.appLogo : '')
                                  : (typeof prev.appLogo === 'string' && (prev.appLogo.startsWith('data:image/') || prev.appLogo.startsWith('/uploads/')) ? prev.appLogo : '')
                              }));
                            }}
                          >
                            <SelectTrigger className="bg-muted/5">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upload">Local Upload</SelectItem>
                              <SelectItem value="url">Image URL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {appLogoSource === 'upload' ? (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Local Logo Upload</Label>
                            <Input
                              key="app-logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'appLogo')}
                              className="text-xs h-9 bg-muted/5 border-dashed"
                            />
                            {typeof settings.appLogo === 'string' && settings.appLogo.startsWith('/uploads/') ? (
                              <div className="text-[10px] text-muted-foreground font-mono truncate">Saved: {settings.appLogo}</div>
                            ) : null}
                            <p className="text-[10px] text-muted-foreground italic">Recommended: Transparent PNG, 512x512px.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Logo URL</Label>
                            <Input
                              key="app-logo-url"
                              placeholder="https://example.com/logo.png"
                              value={(typeof settings.appLogo === 'string' && /^https?:\/\//i.test(settings.appLogo)) ? settings.appLogo : ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAppLogoSource('url');
                                setSettings(prev => ({ ...prev, appLogo: v }));
                              }}
                              className="text-xs h-9 font-mono bg-muted/5"
                            />
                          </div>
                        )}

                        {settings.appLogo && (
                          <div className="pt-4 border-t">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Logo Preview</Label>
                            <div className="relative w-24 h-24 rounded-lg border bg-muted/5 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                              <Image
                                src={settings.appLogo}
                                alt="Logo Preview"
                                fill
                                sizes="96px"
                                className="object-contain"
                                loader={({ src }) => src}
                                unoptimized
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-8 pt-6 border-t font-mono">
                <Button className="w-full h-11 text-sm font-bold" onClick={handleSaveSettings}><Save className="mr-2" /> Save System Settings</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Delete this menu and all its descendants?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => {
            (async () => {
              try {
                const id = itemToDelete!;
                const res = await csrfFetch(`/api/menus/${encodeURIComponent(id)}`, { method: 'DELETE' });
                const json = await res.json().catch(() => null);
                if (!res.ok || json?.status === 'error') throw new Error(json?.message || 'Delete failed.');
                refresh();
              } catch {
                toast({ title: "Error", description: "Could not delete menu item.", variant: "destructive" });
              } finally {
                setItemToDelete(null);
              }
            })();
          }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectingId} onOpenChange={() => { setRejectingId(null); setRejectReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Menu</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason to reject this menu.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold">Reason</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Incorrect content, missing translations..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                (async () => {
                  const id = rejectingId!;
                  const reason = rejectReason.trim();
                  if (!reason) {
                    toast({ title: "Missing Reason", description: "Rejection reason is required.", variant: "destructive" });
                    return;
                  }
                  await handleReject(id, reason);
                  setRejectingId(null);
                  setRejectReason('');
                })();
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CheckerMenuReview() {
  const { csrfFetch, currentRole, currentUsername } = useAdminAuth();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [activeLangTab, setActiveLangTab] = useState<string>('en');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const [menusRes, settingsRes] = await Promise.all([
        csrfFetch('/api/menus?adminPreview=1', { cache: 'no-store' }),
        fetch('/api/app-settings', { cache: 'no-store' })
      ]);
      const [menusJson, settingsJson] = await Promise.all([
        menusRes.json().catch(() => null),
        settingsRes.json().catch(() => null)
      ]);
      setMenus(Array.isArray(menusJson?.data) ? menusJson.data : []);

      const loadedSettings = settingsJson?.data as AppSettings | undefined;
      if (loadedSettings) {
        setSettings(loadedSettings);
        const defaultLang = loadedSettings.supportedLanguages.find(l => l.isDefault)?.code || 'en';
        setActiveLangTab(defaultLang);
      }
    };
    load();
  }, [csrfFetch]);

  const refresh = () => {
    (async () => {
      const res = await csrfFetch('/api/menus?adminPreview=1', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      setMenus(Array.isArray(json?.data) ? json.data : []);
    })();
  };

  const byId = new Map(menus.map(m => [m.id, m]));

  const previewMenus = menus.map(m => {
    const hasPendingUpdate = (m.pendingStatus === 'pending' || m.pendingStatus === 'rejected') && !!m.pendingUpdate;
    return hasPendingUpdate ? mergeMenuWithUpdate(m, m.pendingUpdate) : m;
  });
  const previewById = new Map(previewMenus.map(m => [m.id, m]));

  const pending = menus
    .filter(m =>
      (m.approvalStatus || 'approved') === 'pending' ||
      (m.pendingStatus || null) === 'pending' ||
      (m.pendingStatus || null) === 'rejected'
    )
    .map(m => previewById.get(m.id) || m);
  const isChecker = currentRole === 'checker';

  function mergeMenuWithUpdate(menu: MenuItem, update: any) {
    const merged: any = { ...(menu as any), ...(update || {}) };
    if (Object.prototype.hasOwnProperty.call(update || {}, 'apiConfig')) {
      merged.apiConfig = update?.apiConfig ?? undefined;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'attachedMenuIds')) {
      merged.attachedMenuIds = update?.attachedMenuIds ?? [];
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'content')) {
      merged.content = update?.content ?? undefined;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'contentAm')) {
      merged.contentAm = update?.contentAm ?? undefined;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'nameAm')) {
      merged.nameAm = update?.nameAm ?? undefined;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'parentId')) {
      merged.parentId = update?.parentId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'translations')) {
      merged.translations = update?.translations ?? undefined;
    }
    if (Object.prototype.hasOwnProperty.call(update || {}, 'attachmentDescription')) {
      merged.attachmentDescription = update?.attachmentDescription ?? undefined;
    }
    return merged as MenuItem;
  }

  const getLanguages = () => {
    if (Array.isArray(settings.supportedLanguages) && settings.supportedLanguages.length) return settings.supportedLanguages;
    return [{ code: 'en', name: 'English', isDefault: true }, { code: 'am', name: 'Amharic' }] as Language[];
  };

  const getCurrentLanguage = () => getLanguages().find(l => l.code === activeLangTab) || getLanguages().find(l => l.isDefault) || getLanguages()[0];

  const handleApprove = async (id: string) => {
    try {
      const res = await csrfFetch(`/api/menus/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (!res.ok || json?.status === 'error') {
        const verifyRes = await csrfFetch('/api/menus?adminPreview=1', { cache: 'no-store' });
        const verifyJson = await verifyRes.json().catch(() => null);
        const list = Array.isArray(verifyJson?.data) ? verifyJson.data : [];
        const updated = list.find((m: any) => m?.id === id);
        const isApproved =
          !!updated &&
          (updated.approvalStatus || 'approved') === 'approved' &&
          (updated.pendingStatus ?? null) === null;
        if (isApproved) {
          setMenus(list);
          toast({ title: "Approved", description: "Menu approved successfully." });
          return;
        }
        throw new Error(json?.message || 'Approval failed.');
      }
      refresh();
      toast({ title: "Approved", description: "Menu approved successfully." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not approve menu.';
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await csrfFetch(`/api/menus/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason })
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      if (!res.ok || json?.status === 'error') throw new Error(json?.message || 'Rejection failed.');
      refresh();
      toast({ title: "Rejected", description: "Menu rejected." });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reject menu.';
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openDetails = (id: string) => {
    const original = byId.get(id);
    if (!original) return;
    setSelected(original);
    setIsDetailsOpen(true);
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    const items = previewMenus.filter(m => m.parentId === parentId).sort((a, b) => a.order - b.order);
    if (items.length === 0 && parentId !== null) return null;
    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l pl-2 mt-1' : ''}`}>
        {items.map(item => {
          const hasChildren = previewMenus.some(m => m.parentId === item.id);
          const isExpanded = expanded.has(item.id);
          const approvalStatus = item.approvalStatus || 'approved';
          const pendingStatus = item.pendingStatus || null;
          const hasPendingUpdate = (pendingStatus === 'pending' || pendingStatus === 'rejected') && !!item.pendingUpdate;
          return (
            <div key={item.id} className="group">
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      const next = new Set(expanded);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      setExpanded(next);
                    }}
                    className={cn("text-muted-foreground hover:text-primary shrink-0 transition-transform", !hasChildren && "opacity-0 cursor-default", isExpanded ? 'rotate-0' : '-rotate-90')}
                    disabled={!hasChildren}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm font-medium">{item.name}</span>
                      {approvalStatus === 'pending' && <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-amber-600">Pending Approval</Badge>}
                      {approvalStatus === 'rejected' && <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-destructive">Rejected</Badge>}
                      {approvalStatus === 'approved' && hasPendingUpdate && pendingStatus === 'pending' && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-sky-700">Pending Update</Badge>
                      )}
                      {approvalStatus === 'approved' && hasPendingUpdate && pendingStatus === 'rejected' && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-destructive">Update Rejected</Badge>
                      )}
                    </div>
                    {item.nameAm && <span className="truncate text-[10px] text-muted-foreground">{item.nameAm}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetails(item.id)}><Eye size={14} /></Button>
                </div>
              </div>
              {isExpanded && renderTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderReadonlyMenuForm = (menu: MenuItem) => {
    const langs = getLanguages();
    const defaultLangCode = langs.find(l => l.isDefault)?.code || 'en';

    const resolveName = (lang: Language) => {
      if (lang.isDefault || lang.code === defaultLangCode) return menu.name || '';
      if (lang.code === 'am') return menu.nameAm || '';
      return menu.translations?.[lang.code]?.name || '';
    };

    const resolveContent = (lang: Language) => {
      if (lang.isDefault || lang.code === defaultLangCode) return menu.content || '';
      if (lang.code === 'am') return menu.contentAm || '';
      return menu.translations?.[lang.code]?.content || '';
    };

    const resolveResponseTemplate = (lang: Language) => {
      if (lang.isDefault || lang.code === defaultLangCode) return menu.apiConfig?.responseMapping?.template || '';
      if (lang.code === 'am') return menu.apiConfig?.responseMapping?.templateAm || '';
      return menu.translations?.[lang.code]?.responseTemplate || '';
    };

    const resolveTableIntro = (lang: Language) => {
      if (lang.isDefault || lang.code === defaultLangCode) return menu.apiConfig?.responseMapping?.tableIntro || '';
      if (lang.code === 'am') return menu.apiConfig?.responseMapping?.tableIntroAm || '';
      return menu.translations?.[lang.code]?.tableIntro || '';
    };

    const resolveErrorFallback = (lang: Language) => {
      if (lang.isDefault || lang.code === defaultLangCode) return menu.apiConfig?.responseMapping?.errorFallback || '';
      if (lang.code === 'am') return menu.apiConfig?.responseMapping?.errorFallbackAm || '';
      return menu.translations?.[lang.code]?.errorFallback || '';
    };

    const attachedNames = (menu.attachedMenuIds || [])
      .map(id => menus.find(m => m.id === id)?.name || id)
      .filter(Boolean);

    return (
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-4 bg-muted/10 p-4 rounded-xl border">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
            <Select value={menu.responseType} onValueChange={() => { }}>
              <SelectTrigger disabled><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static Response</SelectItem>
                <SelectItem value="api">API Action</SelectItem>
                <SelectItem value="report">Internal Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Display Order</Label>
            <Input type="number" value={menu.order || 0} disabled />
          </div>
          <div className="flex flex-col justify-center space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
              <ShieldCheck size={12} className="text-primary" /> Visible To Users
            </Label>
            <div className="flex items-center gap-3">
              <Switch checked={menu.isActive !== false} disabled />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">
                {menu.isActive === false ? 'Suspended' : 'Enabled'}
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Fingerprint size={12} className="text-primary" /> Enable Click Tracking
            </Label>
            <div className="flex items-center gap-3">
              <Switch checked={menu.trackClicks || false} disabled />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">
                {menu.trackClicks ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold flex items-center gap-2"><Languages size={16} className="text-primary" /> Localization & Label</Label>
          <Tabs value={activeLangTab} onValueChange={setActiveLangTab} className="w-full border rounded-xl overflow-hidden bg-card shadow-sm">
            <TabsList className="w-full justify-start rounded-none border-b h-12 bg-muted/20 px-4 gap-2">
              {langs.map(lang => (
                <TabsTrigger key={lang.code} value={lang.code} className="data-[state=active]:bg-card rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 text-xs">
                  {lang.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {langs.map(lang => (
              <TabsContent key={lang.code} value={lang.code} className="p-6 space-y-6 mt-0">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Menu Label ({lang.name})</Label>
                  <Input value={resolveName(lang)} disabled />
                </div>

                <Accordion type="single" collapsible className="w-full pt-2">
                  <AccordionItem value="content-editor" className="border rounded-xl px-4 py-0 bg-muted/5">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer flex items-center gap-2">
                        <FileText size={14} className="text-primary" />
                        {(menu.responseType === 'static' ? 'Response Content' : 'Introductory Content')} ({lang.name})
                      </Label>
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-4">
                      <WysiwygEditor
                        title={`${lang.name} Content`}
                        value={resolveContent(lang)}
                        onChange={() => { }}
                        readOnly
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {(menu.responseType === 'api' || menu.responseType === 'report') && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="bg-muted/10">
                <CardTitle className="text-sm">API Connectivity</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Method</Label>
                    <Select value={menu.apiConfig?.method || 'GET'} onValueChange={() => { }}>
                      <SelectTrigger disabled><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Root Mapping Key</Label>
                    <Input value={menu.apiConfig?.rootKey || 'data'} disabled className="font-mono text-xs" />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Endpoint URL</Label>
                    <Input value={menu.apiConfig?.endpoint || ''} disabled className="font-mono text-xs" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Authorization</Label>
                  <Select value={menu.apiConfig?.authConfig?.type || 'none'} onValueChange={() => { }}>
                    <SelectTrigger disabled><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Public API)</SelectItem>
                      <SelectItem value="apiKey">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                    </SelectContent>
                  </Select>

                  {menu.apiConfig?.authConfig?.type === 'apiKey' && (
                    <div className="space-y-3 p-3 border rounded-md bg-muted/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                        <Input value={menu.apiConfig?.authConfig?.apiKey?.header || ''} disabled />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Key Value</Label>
                        <Input type="password" value={menu.apiConfig?.authConfig?.apiKey?.value || ''} disabled />
                      </div>
                    </div>
                  )}

                  {menu.apiConfig?.authConfig?.type === 'basic' && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/5">
                      <div className="space-y-1 mb-2">
                        <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                        <Input value={menu.apiConfig?.authConfig?.basicAuth?.header || ''} disabled />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Username</Label><Input value={menu.apiConfig?.authConfig?.basicAuth?.user || ''} disabled /></div>
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-bold">Password</Label><Input type="password" value={menu.apiConfig?.authConfig?.basicAuth?.pass || ''} disabled /></div>
                      </div>
                    </div>
                  )}

                  {menu.apiConfig?.authConfig?.type === 'bearer' && (
                    <div className="space-y-3 p-3 border rounded-md bg-muted/5">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Header Name</Label>
                        <Input value={menu.apiConfig?.authConfig?.bearer?.header || ''} disabled />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Token Template</Label>
                        <Input value={menu.apiConfig?.authConfig?.bearer?.template || ''} disabled className="font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase flex items-center gap-2"><LinkIcon size={14} className="text-primary" /> Custom Headers</Label>
                  <div className="space-y-2">
                    {Object.entries(menu.apiConfig?.headers || {}).length === 0 ? (
                      <div className="text-xs text-muted-foreground">No custom headers.</div>
                    ) : (
                      Object.entries(menu.apiConfig?.headers || {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2 items-center">
                          <Input value={k} disabled className="flex-1 font-mono text-xs" />
                          <Input value={v || ''} disabled className="flex-1 font-mono text-xs" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-muted/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{menu.responseType === 'report' ? 'Report Configuration' : 'User Input & Mapping'}</CardTitle>
                  {menu.responseType === 'report' && (
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 border-r pr-6 border-muted/20">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Show ID to User</Label>
                        <Switch checked={!(menu.apiConfig?.responseMapping?.hideReportId)} disabled />
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Priority</Label>
                        <Select value={menu.apiConfig?.defaultPriority || 'medium'} onValueChange={() => { }}>
                          <SelectTrigger disabled className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase">Collected Fields</Label>
                  {(menu.apiConfig?.kycFields || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground">No KYC fields.</div>
                  ) : (
                    (menu.apiConfig?.kycFields || []).map((field) => (
                      <div key={field.id} className="flex flex-col gap-3 p-4 border rounded-md bg-muted/5">
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold">Field Key</Label>
                            <Input value={field.name || ''} disabled />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold">Type</Label>
                            <Select value={field.type} onValueChange={() => { }}>
                              <SelectTrigger disabled><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="tel">Phone</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="password">Password</SelectItem>
                                <SelectItem value="boolean">Boolean (Switch)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] uppercase font-bold">Prompt ({getCurrentLanguage().name})</Label>
                              <div className="flex items-center gap-2">
                                <Label className="text-[9px] uppercase font-bold text-muted-foreground">{field.required ? 'Mandatory' : 'Optional'}</Label>
                                <Switch checked={field.required} disabled />
                              </div>
                            </div>
                            <Input
                              value={(() => {
                                const lang = getCurrentLanguage();
                                const isDefault = lang.code === defaultLangCode || lang.isDefault;
                                if (isDefault) return field.prompt || '';
                                if (lang.code === 'am') return field.promptAm || '';
                                return field.prompt || '';
                              })()}
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {menu.responseType === 'api' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase">API Request Mapping</Label>
                      </div>
                      <div className="space-y-2">
                        {(menu.apiConfig?.requestParameters || []).length === 0 ? (
                          <div className="text-xs text-muted-foreground">No request parameters.</div>
                        ) : (
                          (menu.apiConfig?.requestParameters || []).map((param, idx) => (
                            <div key={idx} className={`p-3 border rounded-lg space-y-2 ${param.isEnabled === false ? 'opacity-50' : ''}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${param.isEnabled === false ? 'bg-gray-400' : param.sourceType === 'admin_default' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                <span className="text-xs font-medium">{param.apiKey}</span>
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {param.sourceType === 'admin_default' ? 'Admin Default' :
                                    param.sourceType === 'kyc' ? 'KYC Field' :
                                      param.sourceType === 'static' ? 'Static' : 'User Profile'}
                                </Badge>
                                {param.isEnabled === false && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {param.sourceType === 'admin_default' ? (
                                  <>
                                    Default: "{param.sourceValue}"
                                    {param.isUserConfigurable !== false && <span className="text-blue-600"> • User can override</span>}
                                  </>
                                ) : param.sourceType === 'kyc' ? (
                                  `Maps to: ${param.sourceValue}`
                                ) : param.sourceType === 'static' ? (
                                  `Value: "${param.sourceValue}"`
                                ) : (
                                  `System: ${param.sourceValue}`
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase">Response Mapping</Label>
                  <Tabs defaultValue={menu.apiConfig?.responseMapping?.type || 'message'}>
                    <TabsList className="grid w-full grid-cols-2 rounded-none border bg-muted/50 h-10">
                      <TabsTrigger value="message" className="data-[state=active]:bg-card rounded-none border-r"><Type size={14} className="mr-2" /> Message Template</TabsTrigger>
                      <TabsTrigger value="table" disabled={menu.responseType === 'report'} className="data-[state=active]:bg-card rounded-none"><TableIcon size={14} className="mr-2" /> Result Table</TabsTrigger>
                    </TabsList>

                    <TabsContent value="message" className="p-4 space-y-4 mt-0 border border-t-0">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Success Message ({getCurrentLanguage().name})</Label>
                        <WysiwygEditor
                          title="Success Message"
                          value={resolveResponseTemplate(getCurrentLanguage())}
                          onChange={() => { }}
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Fallback ({getCurrentLanguage().name})</Label>
                        <Input value={resolveErrorFallback(getCurrentLanguage())} disabled />
                      </div>
                    </TabsContent>

                    <TabsContent value="table" className="p-4 space-y-4 mt-0 border border-t-0">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Intro Message / Template ({getCurrentLanguage().name})</Label>
                        <WysiwygEditor
                          title="Intro Message"
                          value={resolveTableIntro(getCurrentLanguage())}
                          onChange={() => { }}
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Error Fallback ({getCurrentLanguage().name})</Label>
                        <Input value={resolveErrorFallback(getCurrentLanguage())} disabled />
                      </div>

                      <Separator />

                      <div className="space-y-3 p-4 border rounded-xl bg-muted/5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground border-b pb-2 flex items-center gap-2">Table Mapping Mode</Label>
                        <Select value={menu.apiConfig?.responseMapping?.tableMappingMode || 'array_path'} onValueChange={() => { }}>
                          <SelectTrigger disabled className="h-8 text-xs bg-card"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="array_path">Array Path (Legacy Engine)</SelectItem>
                            <SelectItem value="exact_path">Exact Path (Unified Engine)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(menu.apiConfig?.responseMapping?.tableMappingMode || 'array_path') === 'array_path' && (
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Table Data Key (Array Path)</Label>
                          <Input value={menu.apiConfig?.responseMapping?.tableDataKey || ''} disabled className="font-mono text-xs" />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase"><TableIcon size={14} /> Column Mapping</Label>
                        {(menu.apiConfig?.responseMapping?.tableColumns || []).length === 0 ? (
                          <div className="text-xs text-muted-foreground">No columns.</div>
                        ) : (
                          <div className="space-y-2">
                            {(menu.apiConfig?.responseMapping?.tableColumns || []).map((col, idx) => {
                              const lang = getCurrentLanguage();
                              const isDefault = lang.code === defaultLangCode || lang.isDefault;
                              const headerVal = isDefault
                                ? (col.header || '')
                                : (lang.code === 'am'
                                  ? (col.headerAm || '')
                                  : (menu.translations?.[lang.code]?.tableHeaders?.[col.key] || ''));

                              return (
                                <div key={idx} className="flex gap-3 p-3 border rounded-md bg-card shadow-sm items-end">
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Header ({lang.name})</Label>
                                    <Input className="h-8 text-xs" value={headerVal} disabled />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Data Key</Label>
                                    <Input className="h-8 text-xs font-mono" value={col.key || ''} disabled />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-bold flex items-center gap-2"><ListTree size={16} /> Attach Related Menus</Label>
          <div className="bg-card rounded-xl border p-4 shadow-sm">
            <div className="relative mb-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search menus..." value="" disabled className="pl-8 h-9 text-sm" />
            </div>
            {attachedNames.length === 0 ? (
              <div className="text-sm text-muted-foreground">No attached menus.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attachedNames.map((n, idx) => (
                  <Badge key={`${n}-${idx}`} variant="secondary" className="text-[10px] h-5 px-2">{n}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Tabs defaultValue="approvals">
        <TabsList className="grid grid-cols-2 w-full bg-muted/20 p-1 border shadow-sm">
          <TabsTrigger value="approvals" className="flex items-center gap-2 text-xs md:text-sm">
            <ShieldCheck size={14} />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="menus" className="flex items-center gap-2 text-xs md:text-sm">
            <ListTree size={14} />
            Menu List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="m-0 border-none p-0 outline-none">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
              <div className="space-y-1">
                <CardTitle>Pending Menus</CardTitle>
                <div className="text-[11px] text-muted-foreground">{pending.length} pending items</div>
              </div>
              <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {pending.length === 0 ? (
                <div className="text-sm text-muted-foreground">No pending menus.</div>
              ) : (
                pending
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{((m.pendingStatus === 'pending' || m.pendingStatus === 'rejected') && m.pendingUpdate?.name) ? m.pendingUpdate.name : m.name}</span>
                          {((m.approvalStatus || 'approved') === 'pending') ? (
                            <Badge variant="secondary" className="text-[10px] h-4 px-2 text-amber-600">Pending Approval</Badge>
                          ) : (m.pendingStatus === 'pending') ? (
                            <Badge variant="secondary" className="text-[10px] h-4 px-2 text-sky-700">Pending Update</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-4 px-2 text-destructive">Update Rejected</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Created by: {(m.approvalStatus === 'pending' ? m.createdBy : m.pendingCreatedBy) || '-'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(m.pendingStatus === 'pending' || m.pendingStatus === 'rejected') && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-2 shrink-0 text-sky-700">Edit Request</Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openDetails(m.id)} className="h-8">
                          <Eye size={14} className="mr-2" /> View
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleApprove(m.id)}
                          disabled={!isChecker || (m.approvalStatus === 'pending' ? m.createdBy === currentUsername : m.pendingCreatedBy === currentUsername)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => { setRejectingId(m.id); setRejectReason(''); }}
                          disabled={!isChecker || (m.approvalStatus === 'pending' ? m.createdBy === currentUsername : m.pendingCreatedBy === currentUsername)}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menus" className="m-0 border-none p-0 outline-none">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
              <div><CardTitle>Menu Hierarchy (Read Only)</CardTitle></div>
              <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
            </CardHeader>
            <CardContent className="p-6">{renderTree(null)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-card">
            <DialogTitle className="flex items-center gap-2"><Eye size={18} /> Menu Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {selected ? (() => {
                const hasPendingUpdate = (selected.pendingStatus === 'pending' || selected.pendingStatus === 'rejected') && !!selected.pendingUpdate;
                const pendingView = hasPendingUpdate ? mergeMenuWithUpdate(selected, selected.pendingUpdate) : null;
                const pendingMaker = selected.pendingCreatedBy || '-';
                const pendingReviewer = selected.pendingReviewedBy || '-';
                const pendingReason = selected.pendingRejectionReason || '';

                const newMenuMaker = selected.createdBy || '-';
                const newMenuReviewer = selected.reviewedBy || '-';
                const newMenuReason = selected.rejectionReason || '';

                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Type</div>
                        <div className="text-sm font-medium">{hasPendingUpdate ? 'Edit Request' : 'Menu'}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Status</div>
                        <div className="text-sm font-medium">
                          {hasPendingUpdate
                            ? (selected.pendingStatus === 'pending' ? 'Pending Update' : selected.pendingStatus === 'rejected' ? 'Update Rejected' : (selected.pendingStatus || '-'))
                            : ((selected.approvalStatus || 'approved') === 'pending' ? 'Pending Approval' : (selected.approvalStatus || 'approved') === 'rejected' ? 'Rejected' : 'Approved')}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">{hasPendingUpdate ? 'Edited By' : 'Created By'}</div>
                        <div className="text-sm font-medium">{hasPendingUpdate ? pendingMaker : newMenuMaker}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Reviewed By</div>
                        <div className="text-sm font-medium">{hasPendingUpdate ? pendingReviewer : newMenuReviewer}</div>
                      </div>
                    </div>

                    {(hasPendingUpdate ? pendingReason : newMenuReason) ? (
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Rejection Reason</div>
                        <div className="text-sm">{hasPendingUpdate ? pendingReason : newMenuReason}</div>
                      </div>
                    ) : null}

                    {hasPendingUpdate && pendingView ? (
                      <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="grid grid-cols-2 w-full bg-muted/20 p-1 border shadow-sm">
                          <TabsTrigger value="pending" className="text-xs">Pending Edit</TabsTrigger>
                          <TabsTrigger value="live" className="text-xs">Current Live</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="m-0 border-none p-0 outline-none mt-4">
                          {renderReadonlyMenuForm(pendingView)}
                        </TabsContent>
                        <TabsContent value="live" className="m-0 border-none p-0 outline-none mt-4">
                          {renderReadonlyMenuForm(selected)}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      renderReadonlyMenuForm(selected)
                    )}
                  </>
                );
              })() : (
                <div className="text-sm text-muted-foreground">No menu selected.</div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t bg-card sticky bottom-0 z-50">
            <Button onClick={() => setIsDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectingId} onOpenChange={() => { setRejectingId(null); setRejectReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Menu</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason to reject this menu.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold">Reason</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Incorrect content, missing translations..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                (async () => {
                  const id = rejectingId!;
                  const reason = rejectReason.trim();
                  if (!reason) {
                    toast({ title: "Missing Reason", description: "Rejection reason is required.", variant: "destructive" });
                    return;
                  }
                  await handleReject(id, reason);
                  setRejectingId(null);
                  setRejectReason('');
                })();
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
