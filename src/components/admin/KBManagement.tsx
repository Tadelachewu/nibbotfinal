'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Brain, RefreshCw, Trash2, Play, Settings, CheckCircle2, XCircle, Clock, Layers, ScrollText, FileText, Plus, Save, X, Eraser, Eye } from 'lucide-react';
import type { KBResult, KBQueryLogRow } from '@/lib/kb';
import type { AppSettings } from '@/lib/types';
import { WysiwygEditor } from './WysiwygEditor';
import { Pagination } from '@/components/ui/pagination';

interface KBArticle {
  id: string;
  title: string;
  body: string;
  titleAm: string | null;
  bodyAm: string | null;
  translations: Record<string, { title?: string; body?: string }> | null;
  enabled: boolean;
  createdBy: string | null;
  updatedAt: string;
  chunkCount: number;
}

type ArticleForm = {
  title: string; body: string;
  titleAm: string; bodyAm: string;
  translations: Record<string, { title?: string; body?: string }>;
  enabled: boolean;
};

interface MenuKBStatus {
  id: string;
  name: string;
  status: string;
  approved: boolean;
  kbEnabled: boolean;
  chunkCount: number;
  lastIndexed: string | null;
}

interface KBSummary {
  totalMenus: number;
  indexedMenus: number;
  totalChunks: number;
  lastIndexed: string | null;
}

interface KBConfig {
  id: number;
  topK: number;
  minScore: number;
  temperature: number;
  enabled: boolean;
  embeddingModel: string;
  generationModel: string;
  rerankerEnabled: boolean;
  rerankerModel: string | null;
  rerankPoolSize: number;
  rerankMinScore: number;
  updatedAt: string | null;
}

export function KBManagement() {
  const { csrfFetch } = useAdminAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'status' | 'test' | 'config' | 'queries' | 'articles'>('status');

  // Status tab
  const [summary, setSummary] = useState<KBSummary | null>(null);
  const [menus, setMenus] = useState<MenuKBStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);

  // Test tab
  const [testQuestion, setTestQuestion] = useState('');
  const [testLang, setTestLang] = useState('en');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<KBResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Queries tab
  const [logs, setLogs] = useState<KBQueryLogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [logsFilter, setLogsFilter] = useState<'today' | '7d' | '30d' | 'custom'>('today');
  const [logsLoading, setLogsLoading] = useState(false);
  // Custom range — same date+time pair pattern as ReportsManagement's "Custom" filter
  const [logsCustomStartDate, setLogsCustomStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [logsCustomStartTime, setLogsCustomStartTime] = useState('00:00');
  const [logsCustomEndDate, setLogsCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logsCustomEndTime, setLogsCustomEndTime] = useState('23:59');
  const [selectedLog, setSelectedLog] = useState<KBQueryLogRow | null>(null);

  // Articles tab
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articleForm, setArticleForm] = useState<ArticleForm | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleSaving, setArticleSaving] = useState(false);
  const [indexingArticleId, setIndexingArticleId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [activeArticleLangTab, setActiveArticleLangTab] = useState('en');

  // Config tab
  const [config, setConfig] = useState<KBConfig | null>(null);
  const [configForm, setConfigForm] = useState<Partial<KBConfig>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await csrfFetch('/api/admin/kb/status', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') {
        setSummary(json.data.summary);
        setMenus(json.data.menus);
      }
    } catch {
      // silently fail — toast below
    } finally {
      setStatusLoading(false);
    }
  }, [csrfFetch]);

  const loadArticles = useCallback(async () => {
    setArticlesLoading(true);
    try {
      const res = await csrfFetch('/api/admin/kb/articles', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setArticles(json.data);
    } catch { /* silently fail */ } finally { setArticlesLoading(false); }
  }, [csrfFetch]);

  const toggleArticleEnabled = async (id: string, nextEnabled: boolean) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, enabled: nextEnabled } : a));
    try {
      const res = await csrfFetch(`/api/admin/kb/articles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        setArticles(prev => prev.map(a => a.id === id ? { ...a, enabled: !nextEnabled } : a));
        toast({ title: 'Update failed', description: 'Could not update article status.', variant: 'destructive' });
      }
    } catch {
      setArticles(prev => prev.map(a => a.id === id ? { ...a, enabled: !nextEnabled } : a));
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    }
  };

  const handleSaveArticle = async () => {
    if (!articleForm || articleSaving) return;
    if (!articleForm.title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for this article.', variant: 'destructive' });
      return;
    }
    setArticleSaving(true);
    try {
      const url = editingArticleId ? `/api/admin/kb/articles/${encodeURIComponent(editingArticleId)}` : '/api/admin/kb/articles';
      const method = editingArticleId ? 'PUT' : 'POST';
      const res = await csrfFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleForm),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: editingArticleId ? 'Article updated' : 'Article created', description: 'Indexing in background…' });
        setArticleForm(null);
        setEditingArticleId(null);
        await loadArticles();
      } else {
        toast({ title: 'Save failed', description: json?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally { setArticleSaving(false); }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Delete this article and all its KB chunks?')) return;
    try {
      const res = await csrfFetch(`/api/admin/kb/articles/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) { toast({ title: 'Article deleted' }); await loadArticles(); }
      else toast({ title: 'Delete failed', variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const handleIndexArticle = async (id: string) => {
    setIndexingArticleId(id);
    try {
      const res = await csrfFetch('/api/admin/kb/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) { toast({ title: 'Article indexed', description: json?.message }); await loadArticles(); }
      else toast({ title: 'Index failed', description: json?.message, variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setIndexingArticleId(null); }
  };

  const handleClearArticleChunks = async (id: string) => {
    if (!window.confirm('Remove all KB chunks for this article? The article itself is kept — use Delete to remove it entirely.')) return;
    setIndexingArticleId(id);
    try {
      const res = await csrfFetch(`/api/admin/kb/index?articleId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (res.ok) { toast({ title: 'Chunks removed', description: 'KB data cleared for this article.' }); await loadArticles(); }
      else toast({ title: 'Clear failed', description: json?.message, variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setIndexingArticleId(null); }
  };

  // Article title/body field mapping mirrors MenuItem's: 'en' is always the
  // title/body columns, 'am' is always titleAm/bodyAm, anything else (any
  // other language configured in Admin → Localization) lives in the generic
  // translations map. Switching the language tab swaps which of these the
  // Title/Content inputs read from and write to — same article row throughout.
  const getArticleTitle = (): string => {
    if (!articleForm) return '';
    if (activeArticleLangTab === 'en') return articleForm.title;
    if (activeArticleLangTab === 'am') return articleForm.titleAm;
    return articleForm.translations[activeArticleLangTab]?.title || '';
  };
  const getArticleBody = (): string => {
    if (!articleForm) return '';
    if (activeArticleLangTab === 'en') return articleForm.body;
    if (activeArticleLangTab === 'am') return articleForm.bodyAm;
    return articleForm.translations[activeArticleLangTab]?.body || '';
  };
  const setArticleTitle = (value: string) => {
    setArticleForm(f => {
      if (!f) return f;
      if (activeArticleLangTab === 'en') return { ...f, title: value };
      if (activeArticleLangTab === 'am') return { ...f, titleAm: value };
      return {
        ...f,
        translations: { ...f.translations, [activeArticleLangTab]: { ...f.translations[activeArticleLangTab], title: value } },
      };
    });
  };
  const setArticleBody = (value: string) => {
    setArticleForm(f => {
      if (!f) return f;
      if (activeArticleLangTab === 'en') return { ...f, body: value };
      if (activeArticleLangTab === 'am') return { ...f, bodyAm: value };
      return {
        ...f,
        translations: { ...f.translations, [activeArticleLangTab]: { ...f.translations[activeArticleLangTab], body: value } },
      };
    });
  };

  const loadLogs = useCallback(async (filter: 'today' | '7d' | '30d' | 'custom', page: number, pageSize: number) => {
    setLogsLoading(true);
    try {
      let from: Date;
      let to: Date;
      if (filter === 'custom') {
        const [startHour, startMin] = logsCustomStartTime.split(':').map(Number);
        const [endHour, endMin] = logsCustomEndTime.split(':').map(Number);
        from = new Date(logsCustomStartDate);
        from.setHours(startHour, startMin, 0, 0);
        to = new Date(logsCustomEndDate);
        to.setHours(endHour, endMin, 59, 999);
      } else {
        const now = new Date();
        if (filter === 'today') {
          from = startOfDay(now);
        } else if (filter === '7d') {
          from = startOfDay(subDays(now, 7));
        } else {
          from = startOfDay(subDays(now, 30));
        }
        to = endOfDay(now);
      }
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        page: String(page),
        limit: String(pageSize),
      });
      const res = await csrfFetch(`/api/admin/kb/logs?${params}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') {
        setLogs(json.data.rows);
        setLogsTotal(json.data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLogsLoading(false);
    }
  }, [csrfFetch, logsCustomStartDate, logsCustomStartTime, logsCustomEndDate, logsCustomEndTime]);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const textToHtml = (value: string) => {
    const safe = escapeHtml(String(value || '').trim());
    if (!safe) return '';
    const paragraphs = safe.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return '';
    return paragraphs
      .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  const createArticleFromLog = async (row: KBQueryLogRow) => {
    const title = String(row.question || '').trim().slice(0, 200);
    const body = row.noAnswer ? '' : textToHtml(String(row.answer || ''));
    if (!title) {
      toast({ title: 'Missing question', description: 'This row has no question text.', variant: 'destructive' });
      return;
    }
    try {
      const res = await csrfFetch('/api/admin/kb/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          titleAm: '',
          bodyAm: '',
          translations: {},
          enabled: false,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.status !== 'success' || !json?.data?.id) {
        toast({ title: 'Create failed', description: json?.message || 'Could not create article.', variant: 'destructive' });
        return;
      }

      const defaultLang = settings.supportedLanguages.find((l: any) => l.isDefault)?.code || 'en';
      setActiveArticleLangTab(defaultLang);
      setEditingArticleId(String(json.data.id));
      setArticleForm({
        title,
        body,
        titleAm: '',
        bodyAm: '',
        translations: {},
        enabled: false,
      });
      setActiveTab('articles');
      await loadArticles();
      toast({ title: 'Draft created', description: 'Saved as a disabled article. Edit and enable when ready.' });
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    }
  };

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await csrfFetch('/api/admin/kb/config', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') {
        setConfig(json.data);
        setConfigForm({ ...json.data });
      }
    } catch {
      // silently fail
    } finally {
      setConfigLoading(false);
    }
  }, [csrfFetch]);

  useEffect(() => {
    loadStatus();
    loadConfig();
    fetch('/api/app-settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (json?.data?.supportedLanguages) {
          setSettings(json.data);
          const defaultLang = json.data.supportedLanguages.find((l: { isDefault?: boolean }) => l.isDefault)?.code || 'en';
          setActiveArticleLangTab(defaultLang);
        }
      })
      .catch(() => { /* silently fail — language tab falls back to English-only editing */ });
  }, [loadStatus, loadConfig]);

  const handleRebuildAll = async () => {
    if (!window.confirm('This will re-index all active approved menus. Continue?')) return;
    setRebuildLoading(true);
    try {
      const res = await csrfFetch('/api/admin/kb/rebuild', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (res.status === 202) {
        toast({ title: 'Rebuild started', description: json?.message || 'Indexing in background. Refresh in a moment.' });
        setTimeout(() => loadStatus(), 5000);
      } else {
        toast({ title: 'Rebuild failed', description: json?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setRebuildLoading(false);
    }
  };

  const handleIndexMenu = async (menuId: string) => {
    setIndexingId(menuId);
    try {
      const res = await csrfFetch('/api/admin/kb/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Indexed', description: json?.message || 'Menu indexed successfully.' });
        await loadStatus();
      } else {
        toast({ title: 'Index failed', description: json?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIndexingId(null);
    }
  };

  const handleDeleteChunks = async (menuId: string) => {
    if (!window.confirm('Remove all KB chunks for this menu?')) return;
    setIndexingId(menuId);
    try {
      const res = await csrfFetch(`/api/admin/kb/index?menuId=${encodeURIComponent(menuId)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Chunks removed', description: json?.message || 'KB data cleared for this menu.' });
        await loadStatus();
      } else {
        toast({ title: 'Delete failed', description: json?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIndexingId(null);
    }
  };

  const handleTestQuery = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = testQuestion.trim();
    if (!q || testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    setTestError(null);

    // Answer streams in token-by-token (see /api/admin/kb/test) instead of
    // arriving as one blocking response after the full ~16-80s generation.
    let answerText = '';
    let settled = false;
    try {
      const url = `/api/admin/kb/test?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(testLang)}`;
      const res = await csrfFetch(url);
      if (!res.body) throw new Error('no_stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let evt: { type: string; text?: string; data?: KBResult; message?: string };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === 'chunk' && evt.text) {
            answerText += evt.text;
            setTestResult({ noAnswer: false, answer: answerText, sources: [], confidence: 'low' });
          } else if (evt.type === 'result' && evt.data) {
            settled = true;
            setTestResult(evt.data);
          } else if (evt.type === 'error') {
            settled = true;
            setTestResult(null);
            setTestError(evt.message || 'Query failed. Check that Ollama is running.');
          }
        }
      }

      if (!settled) {
        setTestResult(null);
        setTestError('Query failed. Check that Ollama is running.');
      }
    } catch {
      setTestResult(null);
      setTestError('Network error. Could not reach the server.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (typeof configForm.topK === 'number') body.topK = configForm.topK;
      if (typeof configForm.minScore === 'number') body.minScore = configForm.minScore;
      if (typeof configForm.temperature === 'number') body.temperature = configForm.temperature;
      if (typeof configForm.enabled === 'boolean') body.enabled = configForm.enabled;
      if (typeof configForm.embeddingModel === 'string') body.embeddingModel = configForm.embeddingModel;
      if (typeof configForm.generationModel === 'string') body.generationModel = configForm.generationModel;
      if (typeof configForm.rerankerEnabled === 'boolean') body.rerankerEnabled = configForm.rerankerEnabled;
      if (typeof configForm.rerankerModel === 'string') body.rerankerModel = configForm.rerankerModel;
      if (typeof configForm.rerankPoolSize === 'number') body.rerankPoolSize = configForm.rerankPoolSize;
      if (typeof configForm.rerankMinScore === 'number') body.rerankMinScore = configForm.rerankMinScore;

      const res = await csrfFetch('/api/admin/kb/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Config saved', description: 'Knowledge base settings updated.' });
        setConfig(json.data ?? configForm as KBConfig);
      } else {
        toast({ title: 'Save failed', description: json?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setConfigSaving(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-[#763717]" />
          <div>
            <h3 className="text-lg font-bold">Knowledge Base</h3>
            <p className="text-xs text-muted-foreground">Manage AI-powered Q&amp;A from your menu content</p>
          </div>
        </div>
        {summary && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{summary.indexedMenus}</strong> / {summary.totalMenus} menus indexed</span>
            <span><strong className="text-foreground">{summary.totalChunks}</strong> chunks</span>
            {summary.lastIndexed && <span>Last: {fmtDate(summary.lastIndexed)}</span>}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full md:w-[650px] bg-muted/20 border">
          <TabsTrigger value="status" className="text-xs flex items-center gap-1">
            <Layers size={13} /> Status
          </TabsTrigger>
          <TabsTrigger value="test" className="text-xs flex items-center gap-1">
            <Play size={13} /> Test AI
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs flex items-center gap-1">
            <Settings size={13} /> Config
          </TabsTrigger>
          <TabsTrigger value="queries" className="text-xs flex items-center gap-1"
            onClick={() => { setActiveTab('queries'); loadLogs(logsFilter, logsPage, logsPageSize); }}>
            <ScrollText size={13} /> Queries
          </TabsTrigger>
          <TabsTrigger value="articles" className="text-xs flex items-center gap-1"
            onClick={() => { setActiveTab('articles'); loadArticles(); }}>
            <FileText size={13} /> Articles
          </TabsTrigger>
        </TabsList>

        {/* ── Status Tab ── */}
        <TabsContent value="status" className="space-y-4 m-0">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadStatus}
              disabled={statusLoading}
              className="text-xs gap-1"
            >
              <RefreshCw size={13} className={statusLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRebuildAll}
              disabled={rebuildLoading || statusLoading}
              className="text-xs gap-1 bg-[#763717] hover:bg-[#763717]/90 text-white"
            >
              <Brain size={13} />
              {rebuildLoading ? 'Starting...' : 'Rebuild All'}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Menu</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">KB</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Chunks</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Indexed</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menus.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          {statusLoading ? 'Loading...' : 'No menus found.'}
                        </td>
                      </tr>
                    )}
                    {menus.map(m => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2 font-medium max-w-[200px] truncate" title={m.name}>{m.name}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge
                            variant="outline"
                            className={
                              m.status === 'active' && m.approved
                                ? 'border-green-400 text-green-700 text-[10px]'
                                : 'border-amber-400 text-amber-700 text-[10px]'
                            }
                          >
                            {m.approved ? m.status : 'pending'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {m.kbEnabled ? (
                            <CheckCircle2 size={14} className="text-green-600 inline-block" />
                          ) : (
                            <XCircle size={14} className="text-muted-foreground inline-block" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-center font-mono">
                          {m.chunkCount > 0 ? (
                            <span className="text-[#763717] font-semibold">{m.chunkCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {m.lastIndexed ? (
                              <><Clock size={11} />{fmtDate(m.lastIndexed)}</>
                            ) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={indexingId === m.id || !m.approved || !m.kbEnabled}
                              onClick={() => handleIndexMenu(m.id)}
                              className="h-6 px-2 text-[10px] gap-1"
                              title={!m.approved ? 'Menu must be approved first' : !m.kbEnabled ? 'KB disabled for this menu' : 'Index this menu'}
                            >
                              {indexingId === m.id ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
                              Index
                            </Button>
                            {m.chunkCount > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={indexingId === m.id}
                                onClick={() => handleDeleteChunks(m.id)}
                                className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                <Trash2 size={11} />
                                Clear
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Test Tab ── */}
        <TabsContent value="test" className="space-y-4 m-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Test Knowledge Base</CardTitle>
              <CardDescription className="text-xs">
                Ask a question as a user would. Results bypass user rate limits and use your admin session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleTestQuery} className="flex flex-col gap-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="kb-test-q" className="text-xs">Question</Label>
                    <Input
                      id="kb-test-q"
                      type="text"
                      value={testQuestion}
                      onChange={e => setTestQuestion(e.target.value)}
                      placeholder="e.g. What are the account opening requirements?"
                      maxLength={500}
                      disabled={testLoading}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kb-test-lang" className="text-xs">Language</Label>
                    <select
                      id="kb-test-lang"
                      value={testLang}
                      onChange={e => setTestLang(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      disabled={testLoading}
                    >
                      <option value="en">English</option>
                      <option value="am">Amharic</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={testLoading || !testQuestion.trim()}
                    className="bg-[#763717] hover:bg-[#763717]/90 text-white gap-1 text-xs"
                  >
                    {testLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    {testLoading ? 'Asking...' : 'Ask'}
                  </Button>
                </div>
              </form>

              {testError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {testError}
                </div>
              )}

              {testResult && (
                <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        testResult.noAnswer
                          ? 'border-amber-400 text-amber-700 text-[10px]'
                          : testResult.confidence === 'high'
                            ? 'border-green-400 text-green-700 text-[10px]'
                            : 'border-yellow-400 text-yellow-700 text-[10px]'
                      }
                    >
                      {testResult.noAnswer ? 'No Answer' : testResult.confidence === 'high' ? 'High Confidence' : 'Moderate'}
                    </Badge>
                    {!testResult.noAnswer && (
                      <span className="text-[10px] text-muted-foreground">
                        {testResult.sources.length} source{testResult.sources.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {testResult.noAnswer ? (
                    <p className="text-sm text-muted-foreground">
                      No confident answer found. Suggested menus: {testResult.suggestedMenus.map(m => m.name).join(', ') || 'none'}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [word-break:break-word]">
                        {testResult.answer}
                      </p>
                      {testResult.sources.length > 0 && (
                        <div className="pt-2 border-t space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
                          <div className="flex flex-wrap gap-1">
                            {testResult.sources.map(s => (
                              <Badge key={s.menuId} variant="outline" className="text-[10px] font-normal">
                                {s.menuName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Queries Tab ── */}
        <TabsContent value="queries" className="space-y-4 m-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Query Audit Log</CardTitle>
              <CardDescription className="text-xs">
                What users asked and how the AI responded. {logsTotal > 0 && <span className="font-medium">{logsTotal} total entries.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(['today', '7d', '30d'] as const).map(f => (
                  <Button
                    key={f}
                    type="button"
                    variant={logsFilter === f ? 'default' : 'outline'}
                    size="sm"
                    className={`text-xs h-7 px-3 ${logsFilter === f ? 'bg-[#763717] hover:bg-[#763717]/90 text-white' : ''}`}
                    onClick={() => {
                      setLogsFilter(f);
                      setLogsPage(1);
                      loadLogs(f, 1, logsPageSize);
                    }}
                  >
                    {f === 'today' ? 'Today' : f === '7d' ? 'Last 7 days' : 'Last 30 days'}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={logsFilter === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs h-7 px-3 ${logsFilter === 'custom' ? 'bg-[#763717] hover:bg-[#763717]/90 text-white' : ''}`}
                  onClick={() => {
                    setLogsFilter('custom');
                    setLogsPage(1);
                    loadLogs('custom', 1, logsPageSize);
                  }}
                >
                  Custom
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-3 ml-auto gap-1"
                  onClick={() => loadLogs(logsFilter, logsPage, logsPageSize)}
                  disabled={logsLoading}
                >
                  <RefreshCw size={11} className={logsLoading ? 'animate-spin' : ''} />
                  Refresh
                </Button>
              </div>

              {logsFilter === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 bg-muted/20 border rounded-lg p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">From</span>
                    <input
                      type="date"
                      value={logsCustomStartDate}
                      onChange={e => setLogsCustomStartDate(e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <input
                      type="time"
                      value={logsCustomStartTime}
                      onChange={e => setLogsCustomStartTime(e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">To</span>
                    <input
                      type="date"
                      value={logsCustomEndDate}
                      onChange={e => setLogsCustomEndDate(e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <input
                      type="time"
                      value={logsCustomEndTime}
                      onChange={e => setLogsCustomEndTime(e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs h-7 px-3 bg-[#763717] hover:bg-[#763717]/90 text-white"
                    onClick={() => { setLogsPage(1); loadLogs('custom', 1, logsPageSize); }}
                    disabled={logsLoading}
                  >
                    Apply
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Time</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Question</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Answer</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Source</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Confidence</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Lang</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">ms</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-44">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!logsLoading && logs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                          No queries in this period.
                        </td>
                      </tr>
                    )}
                    {!logsLoading && logs.map(row => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {fmtDate(row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt))}
                        </td>
                        <td className="px-3 py-2 max-w-[220px]">
                          <span className="block truncate" title={row.question}>{row.question}</span>
                        </td>
                        <td className="px-3 py-2 max-w-[280px]">
                          {row.errorType ? (
                            <span className="text-red-600 italic">
                              {row.errorType === 'timeout' ? 'Timeout — no response' : 'Error — no response'}
                            </span>
                          ) : row.noAnswer ? (
                            <span className="text-amber-600 italic">No answer</span>
                          ) : (
                            <span className="block truncate text-muted-foreground" title={row.answer ?? ''}>
                              {row.answer ?? '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[112px]">
                          {row.sourceNames && row.sourceNames.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap leading-tight">
                              <Badge
                                variant="secondary"
                                className="text-[9px] shrink-0 font-semibold bg-[#f4a61b]/15 text-[#763717] border-0"
                              >
                                {row.sourceNames.length} src
                              </Badge>
                              {row.sourceNames.length === 1 ? (
                                <span className="block truncate text-[10px] text-muted-foreground max-w-[80px]" title={row.sourceNames[0]}>
                                  {row.sourceNames[0]}
                                </span>
                              ) : row.sourceNames.length <= 2 ? (
                                <span className="block truncate text-[10px] text-muted-foreground max-w-[80px]" title={row.sourceNames.join(' · ')}>
                                  {row.sourceNames[0]}
                                  {row.sourceNames[1] ? ` · ${row.sourceNames[1]}` : ''}
                                </span>
                              ) : (
                                <span className="block truncate text-[10px] text-muted-foreground max-w-[80px]" title={row.sourceNames.join(' · ')}>
                                  {row.sourceNames[0]} +{row.sourceNames.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.errorType ? (
                            <Badge variant="outline" className="text-[9px] border-red-400 text-red-700">{row.errorType}</Badge>
                          ) : row.noAnswer ? (
                            <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700">none</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${row.confidence === 'high' ? 'border-green-400 text-green-700' : 'border-yellow-400 text-yellow-700'}`}
                            >
                              {row.confidence ?? '—'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">{row.lang}</td>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                          {row.durationMs != null ? row.durationMs : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] gap-1"
                              onClick={() => setSelectedLog(row)}
                              title="View full question, answer, and source details"
                            >
                              <Eye size={11} />
                              Details
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => createArticleFromLog(row)}
                              disabled={logsLoading || articleSaving}
                              title="Create a disabled KB article draft from this question/answer"
                            >
                              Add to Articles
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logsTotal > logsPageSize && (() => {
                return (
                  <div className="sticky bottom-0 z-10 bg-card border-t pt-2 pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
                    <Pagination
                      currentPage={logsPage - 1}
                      pageSize={logsPageSize}
                      totalItems={logsTotal}
                      onPageChange={(p) => {
                        const next = p + 1;
                        setLogsPage(next);
                        loadLogs(logsFilter, next, logsPageSize);
                      }}
                      onPageSizeChange={(size) => {
                        setLogsPageSize(size);
                        setLogsPage(1);
                        loadLogs(logsFilter, 1, size);
                      }}
                    />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Query Log Detail Drawer ── */}
        <Sheet open={selectedLog !== null} onOpenChange={(o) => { if (!o) setSelectedLog(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
            {selectedLog && (
              <>
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                  <SheetTitle className="text-sm flex items-center gap-2">
                    <ScrollText size={14} className="text-[#763717]" />
                    Query Details
                  </SheetTitle>
                  <SheetDescription className="text-[11px] text-muted-foreground">
                    Logged at {fmtDate(selectedLog.createdAt instanceof Date ? selectedLog.createdAt.toISOString() : String(selectedLog.createdAt))}
                    {' · '}
                    <span className="font-mono uppercase">{selectedLog.lang}</span>
                    {' · '}
                    <span className="font-mono">{selectedLog.durationMs != null ? `${selectedLog.durationMs} ms` : '—'}</span>
                  </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1">
                  <div className="px-5 py-4 space-y-5">
                    {/* Confidence / status row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedLog.errorType ? (
                        <Badge variant="outline" className="text-[10px] border-red-400 text-red-700">
                          {selectedLog.errorType === 'timeout' ? 'Timeout' : 'Error'}
                        </Badge>
                      ) : selectedLog.noAnswer ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">No answer</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${selectedLog.confidence === 'high' ? 'border-green-400 text-green-700' : 'border-yellow-400 text-yellow-700'}`}
                        >
                          Confidence: {selectedLog.confidence ?? '—'}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">ID #{selectedLog.id}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Session: <span className="font-mono">{String(selectedLog.sessionId || '—').slice(0, 12)}…</span>
                      </span>
                    </div>

                    {/* Question */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {selectedLog.question || <span className="italic text-muted-foreground">(empty)</span>}
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Answer</p>
                      {selectedLog.errorType ? (
                        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-700 italic whitespace-pre-wrap break-words">
                          {selectedLog.errorType === 'timeout'
                            ? 'Generation timed out — no response was produced for this query.'
                            : 'An internal error occurred while answering this query.'}
                        </div>
                      ) : selectedLog.noAnswer ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 italic whitespace-pre-wrap break-words">
                          No confident answer found — the KB did not respond to this query.
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
                          {selectedLog.answer || <span className="italic text-muted-foreground">(empty)</span>}
                        </div>
                      )}
                    </div>

                    {/* Sources */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Sources Cited
                        </p>
                        <Badge variant="secondary" className="text-[9px] font-semibold bg-[#f4a61b]/15 text-[#763717] border-0">
                          {(selectedLog.sourceNames?.length ?? 0)} total
                        </Badge>
                      </div>
                      {selectedLog.sourceNames && selectedLog.sourceNames.length > 0 ? (
                        <div className="rounded-lg border divide-y">
                          {selectedLog.sourceNames.map((name, i) => (
                            <div
                              key={i}
                              className="px-3 py-2 flex items-center gap-2.5 hover:bg-muted/20 transition-colors"
                            >
                              <Badge variant="outline" className="shrink-0 text-[9px] font-semibold text-muted-foreground w-8 justify-center">
                                #{i + 1}
                              </Badge>
                              <span className="text-xs truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border px-3 py-3 text-xs text-muted-foreground italic">
                          No sources recorded for this entry.
                        </div>
                      )}
                    </div>

                    {/* Raw source IDs for reference (if any) */}
                    {selectedLog.sourceMenuIds && selectedLog.sourceMenuIds.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Source IDs
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLog.sourceMenuIds.map((id, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-muted/30 border font-mono text-[9px] text-muted-foreground max-w-[180px] truncate"
                              title={id}
                            >
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <SheetFooter className="px-5 py-3 border-t gap-2 flex-col sm:flex-row">
                  <SheetClose asChild>
                    <Button type="button" variant="outline" size="sm" className="text-xs h-8">
                      Close
                    </Button>
                  </SheetClose>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="text-xs h-8 bg-[#763717] hover:bg-[#763717]/90 text-white gap-1.5"
                    onClick={() => {
                      createArticleFromLog(selectedLog);
                      setSelectedLog(null);
                    }}
                    disabled={!!selectedLog.errorType || selectedLog.noAnswer || logsLoading || articleSaving}
                    title={
                      !!selectedLog.errorType || selectedLog.noAnswer
                        ? 'This log has no AI answer to turn into an article.'
                        : 'Create a disabled KB article draft from this question/answer'
                    }
                  >
                    <Plus size={12} />
                    Add to Articles
                  </Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* ── Articles Tab ── */}
        <TabsContent value="articles" className="space-y-4 m-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Knowledge Articles</CardTitle>
                  <CardDescription className="text-xs">
                    Write custom knowledge articles to train the AI using the rich text editor.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#763717] hover:bg-[#763717]/90 text-white text-xs gap-1"
                  onClick={() => {
                    setEditingArticleId(null);
                    setActiveArticleLangTab(settings.supportedLanguages.find(l => l.isDefault)?.code || 'en');
                    setArticleForm({ title: '', body: '', titleAm: '', bodyAm: '', translations: {}, enabled: true });
                  }}
                  disabled={!!articleForm}
                >
                  <Plus size={13} /> New Article
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Inline form — new or edit */}
              {articleForm && (
                <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#763717]">
                    {editingArticleId ? 'Edit Article' : 'New Article'}
                  </p>
                  {/* Language tabs — one article row holds all languages; switching
                      tabs swaps which language's Title/Content you're editing,
                      it does not create a separate article or row. */}
                  <div className="flex items-center gap-1 border-b">
                    {(settings.supportedLanguages.length > 0
                      ? settings.supportedLanguages
                      : [{ code: 'en', name: 'English', isDefault: true }]
                    ).map(l => {
                      const hasContent = l.code === 'en'
                        ? !!(articleForm.title || articleForm.body)
                        : l.code === 'am'
                          ? !!(articleForm.titleAm || articleForm.bodyAm)
                          : !!(articleForm.translations[l.code]?.title || articleForm.translations[l.code]?.body);
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => setActiveArticleLangTab(l.code)}
                          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${activeArticleLangTab === l.code
                            ? 'border-[#763717] text-[#763717]'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {l.name}
                          {hasContent && <span className="ml-1 text-[#f4a61b]">•</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">
                      Title ({activeArticleLangTab})
                    </label>
                    <input
                      type="text"
                      value={getArticleTitle()}
                      onChange={e => setArticleTitle(e.target.value)}
                      placeholder="e.g. Loan Requirements Overview"
                      maxLength={200}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#763717]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">
                      Content ({activeArticleLangTab})
                    </label>
                    <WysiwygEditor
                      key={activeArticleLangTab}
                      title="Article"
                      value={getArticleBody()}
                      onChange={setArticleBody}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={articleForm.enabled}
                        onChange={e => setArticleForm(f => f && ({ ...f, enabled: e.target.checked }))}
                        className="rounded"
                      />
                      Enable (index immediately on save)
                    </label>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 h-7"
                        onClick={() => { setArticleTitle(''); setArticleBody(''); }}
                        disabled={articleSaving}
                        title={`Empty the ${activeArticleLangTab} Title/Content fields without closing the form`}
                      >
                        <Eraser size={12} /> Clear ({activeArticleLangTab})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 h-7"
                        onClick={() => { setArticleForm(null); setEditingArticleId(null); }}
                        disabled={articleSaving}
                      >
                        <X size={12} /> Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs gap-1 h-7 bg-[#763717] hover:bg-[#763717]/90 text-white"
                        onClick={handleSaveArticle}
                        disabled={articleSaving || !articleForm.title.trim()}
                      >
                        {articleSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        {articleSaving ? 'Saving…' : 'Save & Index'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Articles list */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Languages</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Active</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Chunks</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36">Updated</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articlesLoading && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                    )}
                    {!articlesLoading && articles.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No articles yet. Click <strong>New Article</strong> to add your first knowledge note.
                      </td></tr>
                    )}
                    {!articlesLoading && articles.map(a => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2 font-medium max-w-[220px] truncate" title={a.title}>{a.title}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {[
                              a.title || a.body ? 'en' : null,
                              a.titleAm || a.bodyAm ? 'am' : null,
                              ...Object.entries(a.translations || {})
                                .filter(([, v]) => v?.title || v?.body)
                                .map(([code]) => code),
                            ].filter((c): c is string => !!c).map(code => (
                              <Badge key={code} variant="outline" className="text-[9px] font-mono">{code}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={a.enabled}
                              onCheckedChange={(v) => toggleArticleEnabled(a.id, v)}
                              disabled={!!articleForm || indexingArticleId === a.id}
                            />
                            {a.enabled
                              ? <CheckCircle2 size={14} className="text-green-600" />
                              : <XCircle size={14} className="text-muted-foreground" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {a.chunkCount > 0
                            ? <span className="text-[#763717] font-semibold">{a.chunkCount}</span>
                            : <span className="text-muted-foreground">0</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(a.updatedAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button type="button" variant="outline" size="sm"
                              className="h-6 px-2 text-[10px] gap-1"
                              disabled={!!articleForm || indexingArticleId === a.id}
                              onClick={() => {
                                setEditingArticleId(a.id);
                                setActiveArticleLangTab(settings.supportedLanguages.find(l => l.isDefault)?.code || 'en');
                                setArticleForm({
                                  title: a.title, body: a.body,
                                  titleAm: a.titleAm || '', bodyAm: a.bodyAm || '',
                                  translations: a.translations || {},
                                  enabled: a.enabled,
                                });
                              }}>
                              Edit
                            </Button>
                            <Button type="button" variant="outline" size="sm"
                              className="h-6 px-2 text-[10px] gap-1"
                              disabled={indexingArticleId === a.id}
                              onClick={() => handleIndexArticle(a.id)}>
                              {indexingArticleId === a.id ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
                              Index
                            </Button>
                            {a.chunkCount > 0 && (
                              <Button type="button" variant="outline" size="sm"
                                className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={indexingArticleId === a.id}
                                onClick={() => handleClearArticleChunks(a.id)}
                                title="Remove indexed KB chunks without deleting the article">
                                <Trash2 size={11} /> Clear
                              </Button>
                            )}
                            <Button type="button" variant="outline" size="sm"
                              className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                              disabled={indexingArticleId === a.id}
                              onClick={() => handleDeleteArticle(a.id)}>
                              <Trash2 size={11} /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Config Tab ── */}
        <TabsContent value="config" className="space-y-4 m-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Knowledge Base Settings</CardTitle>
              <CardDescription className="text-xs">
                Changes take effect within ~10 seconds. Rebuild index after changing the embedding
                model, chunk size, or chunk overlap. See <code className="font-mono">docs/AI_CONFIG.md</code> for
                what each setting does and why the defaults are set the way they are.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading config...</p>
              ) : (
                <form onSubmit={handleSaveConfig} className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="kb-enabled"
                      checked={configForm.enabled ?? true}
                      onCheckedChange={v => setConfigForm(f => ({ ...f, enabled: v }))}
                    />
                    <Label htmlFor="kb-enabled" className="text-sm cursor-pointer">
                      Enable Knowledge Base
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="kb-top-k" className="text-xs">Top-K results</Label>
                      <Input
                        id="kb-top-k"
                        type="number"
                        min={1}
                        max={20}
                        value={configForm.topK ?? 10}
                        onChange={e => setConfigForm(f => ({ ...f, topK: Number(e.target.value) }))}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">How many chunks to retrieve (1–20)</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kb-min-score" className="text-xs">Minimum confidence score</Label>
                      <Input
                        id="kb-min-score"
                        type="number"
                        step={0.01}
                        min={0.0}
                        max={1.0}
                        value={configForm.minScore ?? 0.5}
                        onChange={e => setConfigForm(f => ({ ...f, minScore: Number(e.target.value) }))}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">RRF threshold (0.0–1.0). Lower = more answers, less precision.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kb-embed-model" className="text-xs">Embedding model</Label>
                      <Input
                        id="kb-embed-model"
                        type="text"
                        value={configForm.embeddingModel ?? 'bge-m3'}
                        onChange={e => setConfigForm(f => ({ ...f, embeddingModel: e.target.value }))}
                        placeholder="bge-m3"
                        maxLength={100}
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">Ollama model for generating embeddings. Rebuild index after changing.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kb-gen-model" className="text-xs">Generation model</Label>
                      <Input
                        id="kb-gen-model"
                        type="text"
                        value={configForm.generationModel ?? 'aya:8b'}
                        onChange={e => setConfigForm(f => ({ ...f, generationModel: e.target.value }))}
                        placeholder="aya:8b"
                        maxLength={100}
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">Ollama model for generating answers.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kb-temperature" className="text-xs">Generation temperature</Label>
                      <Input
                        id="kb-temperature"
                        type="number"
                        step={0.05}
                        min={0}
                        max={2}
                        value={configForm.temperature ?? 0.2}
                        onChange={e => setConfigForm(f => ({ ...f, temperature: Number(e.target.value) }))}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">Lower = more deterministic answers (0–2).</p>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="kb-reranker-enabled"
                        checked={configForm.rerankerEnabled ?? false}
                        onCheckedChange={v => setConfigForm(f => ({ ...f, rerankerEnabled: v }))}
                      />
                      <Label htmlFor="kb-reranker-enabled" className="text-sm cursor-pointer">
                        Enable cross-encoder reranking
                      </Label>
                    </div>
                    <p className="text-[10px] text-muted-foreground -mt-2">
                      Retrieves "Rerank pool size" candidates, sends them to a dedicated reranker
                      service for relevance scoring, then keeps the top "Top-K results" for the
                      answer. Requires the reranker microservice running (see RUNBOOK.md) —
                      queries fall back to plain retrieval order if it's unreachable.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="kb-reranker-model" className="text-xs">Reranker model</Label>
                        <Input
                          id="kb-reranker-model"
                          type="text"
                          value={configForm.rerankerModel ?? ''}
                          onChange={e => setConfigForm(f => ({ ...f, rerankerModel: e.target.value }))}
                          placeholder="bge-reranker-base"
                          maxLength={100}
                          className="text-xs font-mono"
                          disabled={!configForm.rerankerEnabled}
                        />
                        <p className="text-[10px] text-muted-foreground">Informational — the model actually served is set on the reranker service itself.</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="kb-rerank-pool-size" className="text-xs">Rerank pool size</Label>
                        <Input
                          id="kb-rerank-pool-size"
                          type="number"
                          min={1}
                          max={50}
                          value={configForm.rerankPoolSize ?? 15}
                          onChange={e => setConfigForm(f => ({ ...f, rerankPoolSize: Number(e.target.value) }))}
                          className="text-xs"
                          disabled={!configForm.rerankerEnabled}
                        />
                        <p className="text-[10px] text-muted-foreground">Candidates retrieved before reranking (e.g. 15 → rerank → Top-K).</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="kb-rerank-min-score" className="text-xs">Post-rerank confidence threshold</Label>
                        <Input
                          id="kb-rerank-min-score"
                          type="number"
                          step={0.01}
                          min={0.0}
                          max={1.0}
                          value={configForm.rerankMinScore ?? 0.25}
                          onChange={e => setConfigForm(f => ({ ...f, rerankMinScore: Number(e.target.value) }))}
                          className="text-xs"
                          disabled={!configForm.rerankerEnabled}
                        />
                        <p className="text-[10px] text-muted-foreground">Cross-encoder relevance score (0–1). Used instead of "Minimum confidence score" when reranking is enabled.</p>
                      </div>
                    </div>
                  </div>

                  {config?.updatedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Last updated: {fmtDate(config.updatedAt)}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={configSaving}
                    className="bg-[#763717] hover:bg-[#763717]/90 text-white gap-1 text-xs"
                  >
                    {configSaving ? <RefreshCw size={13} className="animate-spin" /> : null}
                    {configSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
