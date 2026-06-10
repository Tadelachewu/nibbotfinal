'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  User,
  FileText,
  ChevronRight,
  ClipboardList,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Database,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  Download,
  NotebookPen,
  Filter,
  CheckCircle,
  Eye,
  Send,
  Star,
  FileCode,
  X
} from 'lucide-react';
import { usePerEntityDrafts } from '@/hooks/usePerEntityDrafts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserReport, ReportPriority } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useAdminAuth } from './AdminAuthContext';
import { Activity } from 'lucide-react';

export function ReportsManagement() {
  const { csrfFetch, currentRole, currentUsername } = useAdminAuth();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsMeta, setReportsMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [loadingMoreReports, setLoadingMoreReports] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [supportUsers, setSupportUsers] = useState<Array<{ username: string }>>([]);
  const [ratingSortKey, setRatingSortKey] = useState<'avg' | 'count' | 'lastRatedAt'>('avg');
  const [ratingTopN, setRatingTopN] = useState<number>(10);

  const [editingResponse, setEditingResponse] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingStatus, setEditingStatus] = useState<UserReport['status']>('pending');
  const [editingPriority, setEditingPriority] = useState<ReportPriority>('medium');
  const [editingSupportAssignee, setEditingSupportAssignee] = useState<string>('__none__');
  const [editingSupportAssignmentType, setEditingSupportAssignmentType] = useState<'first_assignment' | 'escalation'>('first_assignment');
  const [editingSupportAssignmentReason, setEditingSupportAssignmentReason] = useState<string>('');
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const inspectForm = useMemo(() => ({
    editingResponse, editingNotes, editingStatus, editingPriority, editingSupportAssignee, editingSupportAssignmentType, editingSupportAssignmentReason
  }), [editingResponse, editingNotes, editingStatus, editingPriority, editingSupportAssignee, editingSupportAssignmentType, editingSupportAssignmentReason]);

  const { activeDraftIds: activeReportDrafts, getDraft: getReportDraft, discardDraft: discardReportDraft } = usePerEntityDrafts('report', selectedReportId, inspectForm, isInspectOpen);

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activityMeta, setActivityMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);

  const REPORTS_PAGE_SIZE = 50;
  const ACTIVITY_PAGE_SIZE = 100;

  const fetchReports = useCallback(async (opts?: { page?: number; append?: boolean }) => {
    const page = Number.isFinite(opts?.page) && (opts?.page as number) >= 0 ? Math.floor(opts!.page as number) : 0;
    const append = Boolean(opts?.append);
    if (append) setLoadingMoreReports(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(REPORTS_PAGE_SIZE));
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      const res = await csrfFetch(`/api/reports?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const meta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setReportsMeta(meta);
      setReports(prev => append ? [...prev, ...next] : next);
    } finally {
      if (append) setLoadingMoreReports(false);
      else setLoading(false);
    }
  }, [csrfFetch, search, statusFilter, priorityFilter]);

  const fetchActivityLogs = useCallback(async (opts?: { page?: number; append?: boolean }) => {
    const page = Number.isFinite(opts?.page) && (opts?.page as number) >= 0 ? Math.floor(opts!.page as number) : 0;
    const append = Boolean(opts?.append);
    if (append) setLoadingMoreActivity(true);
    else setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(ACTIVITY_PAGE_SIZE));
      const res = await csrfFetch(`/api/reports/activities?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const meta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setActivityMeta(meta);
      setActivityLogs(prev => append ? [...prev, ...next] : next);
    } finally {
      if (append) setLoadingMoreActivity(false);
      else setLoadingLogs(false);
    }
  }, [csrfFetch]);

  useEffect(() => {
    fetchActivityLogs({ page: 0, append: false });
  }, [fetchActivityLogs]);

  useEffect(() => {
    fetchReports({ page: 0, append: false });
  }, [search, statusFilter, priorityFilter, fetchReports]);

  useEffect(() => {
    if (currentRole !== 'admin') return;
    let active = true;
    (async () => {
      try {
        const res = await csrfFetch('/api/admin/users?role=support&pageSize=200', { cache: 'no-store' });
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

  const supportRatings = useMemo(() => {
    const byUser = new Map<string, {
      username: string;
      total: number;
      count: number;
      feedbackCount: number;
      lastRatedAt?: string;
    }>();

    for (const r of reports) {
      if (typeof r.serviceRating !== 'number') continue;
      const username =
        (typeof r.serviceRatedSupportAssignee === 'string' && r.serviceRatedSupportAssignee.trim())
          ? r.serviceRatedSupportAssignee.trim()
          : (typeof r.supportAssignee === 'string' && r.supportAssignee.trim())
            ? r.supportAssignee.trim()
            : '__unassigned__';

      const entry = byUser.get(username) || { username, total: 0, count: 0, feedbackCount: 0 };
      entry.total += r.serviceRating;
      entry.count += 1;
      if (typeof r.serviceFeedback === 'string' && r.serviceFeedback.trim()) entry.feedbackCount += 1;
      if (typeof r.serviceRatedAt === 'string' && r.serviceRatedAt) {
        if (!entry.lastRatedAt || new Date(r.serviceRatedAt).getTime() > new Date(entry.lastRatedAt).getTime()) {
          entry.lastRatedAt = r.serviceRatedAt;
        }
      }
      byUser.set(username, entry);
    }

    if (currentRole === 'admin') {
      for (const u of supportUsers) {
        const name = typeof u.username === 'string' ? u.username.trim() : '';
        if (!name) continue;
        if (!byUser.has(name)) byUser.set(name, { username: name, total: 0, count: 0, feedbackCount: 0 });
      }
    }

    const rows = Array.from(byUser.values()).map(e => ({
      username: e.username,
      avg: e.count ? e.total / e.count : 0,
      count: e.count,
      feedbackCount: e.feedbackCount,
      lastRatedAt: e.lastRatedAt
    }));

    rows.sort((a, b) => {
      if (ratingSortKey === 'count') return (b.count - a.count) || (b.avg - a.avg);
      if (ratingSortKey === 'lastRatedAt') {
        const at = a.lastRatedAt ? new Date(a.lastRatedAt).getTime() : 0;
        const bt = b.lastRatedAt ? new Date(b.lastRatedAt).getTime() : 0;
        return (bt - at) || (b.avg - a.avg);
      }
      return (b.avg - a.avg) || (b.count - a.count);
    });

    const cleanTopN = Number.isFinite(ratingTopN) && ratingTopN > 0 ? Math.floor(ratingTopN) : 10;
    return rows.slice(0, Math.min(cleanTopN, rows.length));
  }, [reports, supportUsers, currentRole, ratingSortKey, ratingTopN]);

  const filteredReports = reports;

  const handleSaveAdminData = (overrideStatus?: UserReport['status']) => {
    if (selectedReportId) {
      const finalStatus = overrideStatus || editingStatus;

      (async () => {
        try {
          const res = await csrfFetch(`/api/reports/${encodeURIComponent(selectedReportId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: finalStatus,
              ...(currentRole === 'admin' ? { priority: editingPriority } : {}),
              adminResponse: editingResponse,
              internalNotes: editingNotes,
              ...(finalStatus === 'resolved' && !selectedReport?.resolvedBy ? { resolvedBy: currentUsername } : {}),
              ...(currentRole === 'admin'
                ? {
                  supportAssignee: editingSupportAssignee === '__none__' ? null : editingSupportAssignee,
                  ...(editingSupportAssignee !== '__none__' ? { supportAssignmentType: editingSupportAssignmentType, supportAssignmentReason: editingSupportAssignmentReason } : {})
                }
                : {})
            })
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.status === 'error') {
            throw new Error(json?.message || 'Failed to update report.');
          }

          setEditingStatus(finalStatus);
          discardReportDraft(selectedReportId);
          setReports(prev => prev.map(r => (r.id === selectedReportId ? json.data : r)));

          toast({
            title: overrideStatus ? `Marked as ${overrideStatus}` : "Changes Saved",
            description: "Submission has been updated successfully."
          });

          if (overrideStatus === 'resolved') {
            setIsInspectOpen(false);
          }
          fetchActivityLogs({ page: 0, append: false });
        } catch {
          toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        }
      })();
    }
  };

  const handleDeleteReport = (reportId: string) => {
    (async () => {
      try {
        const res = await csrfFetch(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.status === 'error') {
          throw new Error(json?.message || 'Failed to delete report.');
        }
        setReports(prev => prev.filter(r => r.id !== reportId));
        toast({ title: "Report Deleted" });
        fetchActivityLogs({ page: 0, append: false });
      } catch {
        toast({ title: "Error", description: "Failed to delete report.", variant: "destructive" });
      }
    })();
  };

  const downloadJson = (report: UserReport) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `report_${report.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="text-emerald-500" size={14} />;
      case 'reviewed': return <Clock className="text-blue-500" size={14} />;
      default: return <AlertCircle className="text-amber-500" size={14} />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'low': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-800';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-800';
    }
  };

  const prettifyKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const selectedReport = useMemo(() =>
    reports.find(r => r.id === selectedReportId),
    [reports, selectedReportId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-muted-foreground animate-pulse">Synchronizing submissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isInspectOpen && selectedReport ? (
        <div className="min-h-[100dvh] bg-background -mt-6 -mx-6 px-6 py-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="sticky top-16 z-40 bg-card border-b shadow-sm -mx-6 px-6 mb-6">
            <div className="max-w-6xl mx-auto py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setIsInspectOpen(false)} className="shrink-0">
                  <ChevronRight size={16} className="mr-2 rotate-180" />
                  Back
                </Button>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold truncate">{selectedReport.menuName}</h2>
                  <p className="text-xs text-muted-foreground font-mono">Reference: {selectedReport.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadJson(selectedReport)}>
                  <Download size={14} className="mr-2" /> Export JSON
                </Button>
                {currentRole === 'admin' && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { handleDeleteReport(selectedReport.id); setIsInspectOpen(false); }}>
                    <Trash2 size={18} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto space-y-6">
            {/* ADMIN ACTION BAR */}
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border rounded-xl p-4 flex flex-wrap items-center gap-4 justify-between shadow-sm">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Status</span>
                  <Badge className={cn("text-[10px] capitalize",
                    editingStatus === 'resolved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
                      editingStatus === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                  )}>
                    {editingStatus}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Set Priority</span>
                  <Select
                    value={editingPriority}
                    onValueChange={(val: any) => setEditingPriority(val)}
                  >
                    <SelectTrigger disabled={currentRole === 'support'} className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Support</span>
                  {currentRole === 'admin' ? (
                    <div className="flex items-center gap-3">
                      <Select value={editingSupportAssignee} onValueChange={(val) => {
                        setEditingSupportAssignee(val);
                        const existing = selectedReport?.supportAssignee;
                        const hadAssignee = typeof existing === 'string' && existing.trim().length > 0;
                        if (val === '__none__') {
                          setEditingSupportAssignmentType('first_assignment');
                          setEditingSupportAssignmentReason('');
                          return;
                        }
                        // If it was unassigned and we're assigning for first time
                        if (!hadAssignee) {
                          setEditingSupportAssignmentType('first_assignment');
                        }
                      }}>
                        <SelectTrigger className="h-7 w-44 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {supportUsers.map(u => (
                            <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editingSupportAssignee !== '__none__' && (
                        <Select value={editingSupportAssignmentType} onValueChange={(val: any) => setEditingSupportAssignmentType(val)}>
                          <SelectTrigger className="h-7 w-40 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first_assignment">First Assignment</SelectItem>
                            <SelectItem value="escalation">Escalation</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {editingSupportAssignmentType === 'escalation' && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Escalation Reason</Label>
                          <Input
                            value={editingSupportAssignmentReason}
                            onChange={(e) => setEditingSupportAssignmentReason(e.target.value)}
                            placeholder="Why was this escalated?"
                            className="h-7 text-[11px] w-64 bg-card"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {editingSupportAssignee === '__none__' ? 'Unassigned' : (editingSupportAssignee === currentUsername ? 'Assigned to you' : editingSupportAssignee)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("h-8 text-[11px] font-bold", editingStatus === 'reviewed' && "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800")}
                  onClick={() => handleSaveAdminData('reviewed')}
                >
                  <Clock size={14} className="mr-2 text-blue-500" /> Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleSaveAdminData('resolved')}
                >
                  <CheckCircle size={14} className="mr-2" /> Mark Resolved
                </Button>
              </div>
            </div>

            <div className="pb-24">
              <Tabs defaultValue="response" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/20 border-b rounded-none px-0">
                  <TabsTrigger value="response" className="text-xs gap-2 data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 shadow-none">
                    <MessageSquare size={14} /> User Response
                  </TabsTrigger>
                  <TabsTrigger value="data" className="text-xs gap-2 data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 shadow-none">
                    <Database size={14} /> Collected Data
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs gap-2 data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 shadow-none">
                    <NotebookPen size={14} /> Internal Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="response" className="pt-6 space-y-4 animate-in fade-in-50 duration-500">
                  {typeof selectedReport.serviceRating === 'number' && (
                    <div className="p-4 border rounded-xl bg-amber-50/40 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-900/50">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-400">User Rating</div>
                          <div className="flex items-center gap-1 text-amber-600">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={14} className={i < selectedReport.serviceRating! ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'} />
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold">{selectedReport.serviceRating} / 5</div>
                          {selectedReport.serviceRatedAt && (
                            <div className="text-[10px] text-muted-foreground">
                              {format(new Date(selectedReport.serviceRatedAt), 'MMM dd, HH:mm')}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedReport.serviceFeedback && (
                        <div className="mt-3 text-sm text-muted-foreground italic break-words">
                          "{selectedReport.serviceFeedback}"
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4 bg-[#f4a61b]/10 p-6 rounded-xl border border-dashed border-[#f4a61b]/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold flex items-center gap-2 text-[#763717]">
                          <Send size={16} className="text-[#763717]" />
                          Official Written Response
                        </Label>
                        <p className="text-[11px] text-muted-foreground">This message will be visible to the user when they check their report status.</p>
                      </div>
                    </div>
                    <Textarea
                      value={editingResponse}
                      onChange={(e) => setEditingResponse(e.target.value)}
                      placeholder="Type your official message to the user here..."
                      className="min-h-[150px] text-sm bg-card shadow-inner border-[#f4a61b]/20 focus-visible:ring-[#f4a61b]"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-muted-foreground italic max-w-md">
                        Use the primary save button at the bottom of the page to commit this response and notify the user.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="data" className="pt-6 animate-in fade-in-50 duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(selectedReport.data || {}).map(([key, value]) => (
                      <div key={key} className="p-4 border rounded-xl bg-slate-50/50 dark:bg-muted/20 hover:bg-card transition-all shadow-sm group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{prettifyKey(key)}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground font-mono break-all">{String(value || 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="pt-6 space-y-4 animate-in fade-in-50 duration-500">
                  <div className="space-y-3 p-6 border rounded-xl bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold flex items-center gap-2 text-amber-900 dark:text-amber-400">
                        <NotebookPen size={16} />
                        Private Internal Notes
                      </Label>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500/70 italic">These notes are strictly for internal review and are NEVER shared with the user.</p>
                    </div>
                    <Textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Add internal investigation notes, findings, or team observations..."
                      className="min-h-[150px] text-sm border-amber-200 dark:border-amber-900/50 focus-visible:ring-amber-500 bg-card"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-amber-700 dark:text-amber-500/70 italic max-w-md">
                        Internal notes are persistent and will be saved along with all other status changes.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="sticky bottom-0 z-40 bg-card border-t -mx-6 px-6 py-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User size={14} />
              <span className="text-[11px] font-mono">Submitter: {selectedReport.userId}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="h-10 px-6 font-bold" onClick={() => setIsInspectOpen(false)}>Cancel</Button>
              <Button
                className="h-10 px-8 font-bold bg-[#f4a61b] text-[#763717] hover:bg-[#f4a61b]/90 border-none shadow-lg active:scale-[0.98] transition-all"
                onClick={() => handleSaveAdminData()}
              >
                Save All Changes
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary">Pending</span>
                <AlertCircle size={16} className="text-primary" />
              </div>
              <p className="text-2xl font-bold mt-1">{reports.filter(r => r.status === 'pending').length}</p>
            </Card>
            <Card className="p-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400">Reviewed</span>
                <Clock size={16} className="text-blue-700 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold mt-1">{reports.filter(r => r.status === 'reviewed').length}</p>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">High/Urgent</span>
                <ShieldAlert size={16} className="text-amber-700 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-bold mt-1">{reports.filter(r => r.priority === 'high' || r.priority === 'urgent').length}</p>
            </Card>
            <Card className="p-4 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">Resolved Total</span>
                <CheckCircle2 size={16} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-bold mt-1">{reports.filter(r => r.status === 'resolved').length}</p>
            </Card>
          </div>

          <Tabs defaultValue="submissions" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="submissions" className="gap-2">
                <ClipboardList size={14} /> Submissions
              </TabsTrigger>
              {currentRole === 'admin' && (
                <TabsTrigger value="ratings" className="gap-2">
                  <Star size={14} /> Support Ratings
                </TabsTrigger>
              )}
              <TabsTrigger value="logs" className="gap-2">
                <Activity size={14} /> Activity Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submissions">
              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="border-b bg-muted/5 p-6">
                  <div className="flex flex-col space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <ClipboardList className="text-primary" size={20} />
                          Operational Console
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Manage, triage, and respond to user-submitted reports.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchReports({ page: 0, append: false })} disabled={loading}>
                          <RefreshCw size={14} className="mr-2" /> Refresh
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search submissions..."
                          className="pl-10 bg-card"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-10 bg-card">
                          <Filter size={14} className="mr-2" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[140px] h-10 bg-card">
                          <ShieldAlert size={14} className="mr-2" />
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priority</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px]">
                    <Table>
                      <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-0 z-20 border-b">
                        <TableRow>
                          <TableHead className="w-[100px] font-bold uppercase text-[10px]">Priority</TableHead>
                          <TableHead className="w-[100px] font-bold uppercase text-[10px]">Status</TableHead>
                          <TableHead className="w-[90px] font-bold uppercase text-[10px]">Rating</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Submitter</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Data Preview</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Timestamp</TableHead>
                          <TableHead className="text-right font-bold uppercase text-[10px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report) => (
                          <TableRow key={report.id} className="group hover:bg-muted/20 transition-colors">
                            <TableCell>
                              <Badge variant="outline" className={cn("capitalize text-[9px] px-2", getPriorityColor(report.priority))}>
                                {report.priority || 'medium'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(report.status)}
                                <span className="capitalize text-[10px] font-medium text-muted-foreground">{report.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {typeof report.serviceRating === 'number' ? (
                                <div className="flex items-center gap-1 text-amber-600">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} size={12} className={i < report.serviceRating! ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'} />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-xs">{report.menuName}</div>
                              <div className="text-[9px] text-muted-foreground font-mono">#{report.id.split('_')[1] || report.id}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User size={12} className="text-muted-foreground" />
                                <span className="text-[11px] font-mono">{report.userId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px] italic">
                                {Object.entries(report.data || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[10px]">
                              {format(new Date(report.timestamp), 'MMM dd, HH:mm')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-1">
                                {activeReportDrafts.includes(report.id) && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => {
                                      setSelectedReportId(report.id);
                                      const draft = getReportDraft(report.id) as any;
                                      if (draft) {
                                        setEditingResponse(draft.editingResponse || '');
                                        setEditingNotes(draft.editingNotes || '');
                                        setEditingStatus(draft.editingStatus || 'pending');
                                        setEditingPriority(draft.editingPriority || 'medium');
                                        setEditingSupportAssignee(draft.editingSupportAssignee || '__none__');
                                        setEditingSupportAssignmentType(draft.editingSupportAssignmentType || 'first_assignment');
                                        setEditingSupportAssignmentReason(draft.editingSupportAssignmentReason || '');
                                      }
                                      setIsInspectOpen(true);
                                    }} title="Resume Draft">
                                      <FileCode size={14} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => discardReportDraft(report.id)} title="Discard Draft">
                                      <X size={14} />
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-primary" onClick={() => {
                                  setSelectedReportId(report.id);
                                  const draft = getReportDraft(report.id) as any;
                                  if (draft) {
                                    setEditingResponse(draft.editingResponse || '');
                                    setEditingNotes(draft.editingNotes || '');
                                    setEditingStatus(draft.editingStatus || 'pending');
                                    setEditingPriority(draft.editingPriority || 'medium');
                                    setEditingSupportAssignee(draft.editingSupportAssignee || '__none__');
                                    setEditingSupportAssignmentType(draft.editingSupportAssignmentType || 'first_assignment');
                                    setEditingSupportAssignmentReason(draft.editingSupportAssignmentReason || '');
                                  } else {
                                    setEditingResponse(report.adminResponse || '');
                                    setEditingNotes(report.internalNotes || '');
                                    setEditingStatus(report.status);
                                    setEditingPriority(report.priority || 'medium');
                                    setEditingSupportAssignee(report.supportAssignee || '__none__');
                                    setEditingSupportAssignmentType(report.supportAssignmentType || 'first_assignment');
                                    setEditingSupportAssignmentReason(report.supportAssignmentReason || '');
                                  }
                                  setIsInspectOpen(true);
                                }}>
                                  Inspect <ChevronRight size={14} className="ml-1" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredReports.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                                <ClipboardList size={48} />
                                <p className="italic text-sm">No submissions matching current filters.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {reportsMeta?.hasMore && (
                          <TableRow>
                            <TableCell colSpan={8} className="py-6">
                              <div className="flex items-center justify-center gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={loadingMoreReports}
                                  onClick={() => fetchReports({ page: (reportsMeta?.page ?? 0) + 1, append: true })}
                                  className="gap-2"
                                >
                                  <Loader2 size={14} className={cn(loadingMoreReports && 'animate-spin')} />
                                  Load more
                                </Button>
                                {typeof reportsMeta.total === 'number' && (
                                  <span className="text-xs text-muted-foreground">
                                    Showing {filteredReports.length} of {reportsMeta.total}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {currentRole === 'admin' && (
              <TabsContent value="ratings">
                <Card className="border-none shadow-md overflow-hidden">
                  <CardHeader className="border-b bg-muted/5 p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Star className="text-primary" size={20} />
                            Support Performance (Ratings)
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">Aggregated user ratings captured after reports are resolved.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Sort</span>
                          <Select value={ratingSortKey} onValueChange={(v: any) => setRatingSortKey(v)}>
                            <SelectTrigger className="w-[200px] h-10 bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="avg">Highest average</SelectItem>
                              <SelectItem value="count">Most ratings</SelectItem>
                              <SelectItem value="lastRatedAt">Most recent rating</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Top N</span>
                          <Input
                            type="number"
                            value={ratingTopN}
                            onChange={(e) => setRatingTopN(parseInt(e.target.value || '0', 10))}
                            className="w-[120px] h-10 bg-card"
                            min={1}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[550px]">
                      <Table>
                        <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-0 z-20 border-b">
                          <TableRow>
                            <TableHead className="font-bold uppercase text-[10px]">Support User</TableHead>
                            <TableHead className="w-[140px] font-bold uppercase text-[10px]">Avg Rating</TableHead>
                            <TableHead className="w-[120px] font-bold uppercase text-[10px]">Ratings</TableHead>
                            <TableHead className="w-[140px] font-bold uppercase text-[10px]">Feedback</TableHead>
                            <TableHead className="w-[180px] font-bold uppercase text-[10px]">Last Rated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supportRatings.map((row) => (
                            <TableRow key={row.username} className="group hover:bg-muted/20 transition-colors">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold">{row.username === '__unassigned__' ? 'Unassigned' : row.username}</span>
                                  {row.username !== '__unassigned__' && (
                                    <span className="text-[10px] text-muted-foreground font-mono">support</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-1 text-amber-600">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        size={14}
                                        className={i < Math.round(row.avg) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs font-semibold">{row.count ? row.avg.toFixed(2) : '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-mono">{row.count}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-mono">{row.feedbackCount}</Badge>
                              </TableCell>
                              <TableCell className="text-[10px] text-muted-foreground font-mono">
                                {row.lastRatedAt ? format(new Date(row.lastRatedAt), 'MMM dd, HH:mm') : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {supportRatings.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic text-sm">
                                No ratings available yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="logs">
              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="border-b bg-muted/5 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Activity className="text-primary" size={20} />
                        Support Activity Stream
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Audit trail for assignments, escalations, and official responses.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => fetchActivityLogs({ page: 0, append: false })} disabled={loadingLogs}>
                        <RefreshCw size={12} className={cn("mr-2", loadingLogs && "animate-spin")} /> Refresh Log
                      </Button>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full font-medium">
                        <Clock size={12} /> Database tracking
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <div className="p-0">
                      <Table>
                        <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-0 z-20 border-b">
                          <TableRow>
                            <TableHead className="w-[180px] font-bold uppercase text-[10px]">Timestamp</TableHead>
                            <TableHead className="w-[140px] font-bold uppercase text-[10px]">Event</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                            <TableHead className="w-[120px] font-bold uppercase text-[10px]">Report Ref</TableHead>
                            <TableHead className="text-right font-bold uppercase text-[10px]">Actor/Target</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activityLogs.map((log) => (
                            <TableRow key={log.id} className="group hover:bg-muted/10 transition-colors">
                              <TableCell className="text-[10px] text-muted-foreground font-mono">
                                {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                              </TableCell>
                              <TableCell>
                                {log.type === 'assignment' ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] uppercase">Assignment</Badge>
                                ) : log.type === 'response' ? (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] uppercase">Response</Badge>
                                ) : log.type === 'resolution' ? (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[9px] uppercase">Resolved</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-primary/5 text-primary/70 border-primary/10 text-[9px] uppercase">Submission</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-xs font-medium">{log.content || 'Activity recorded'}</p>
                                  {log.type === 'assignment' && log.target && (
                                    <p className="text-[9px] text-muted-foreground italic">Assigned to {log.target}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-[10px] font-mono text-primary cursor-pointer hover:underline" onClick={() => {
                                  setSelectedReportId(log.reportId);
                                  const r = reports.find(x => x.id === log.reportId);
                                  if (r) {
                                    setEditingResponse(r.adminResponse || '');
                                    setEditingNotes(r.internalNotes || '');
                                    setEditingStatus(r.status);
                                    setEditingPriority(r.priority || 'medium');
                                    setEditingSupportAssignee(r.supportAssignee || '__none__');
                                    setEditingSupportAssignmentType(r.supportAssignee ? 'escalation' : 'first_assignment');
                                    setIsInspectOpen(true);
                                  }
                                }}>
                                  #{log.reportId.split('_')[1] || log.reportId}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold">{log.actor}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {activityLogs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic text-sm">
                                No activities recorded yet.
                              </TableCell>
                            </TableRow>
                          )}
                          {activityMeta?.hasMore && (
                            <TableRow>
                              <TableCell colSpan={5} className="py-6">
                                <div className="flex items-center justify-center gap-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={loadingMoreActivity}
                                    onClick={() => fetchActivityLogs({ page: (activityMeta?.page ?? 0) + 1, append: true })}
                                    className="gap-2"
                                  >
                                    <Loader2 size={14} className={cn(loadingMoreActivity && 'animate-spin')} />
                                    Load more
                                  </Button>
                                  {typeof activityMeta.total === 'number' && (
                                    <span className="text-xs text-muted-foreground">
                                      Showing {activityLogs.length} of {activityMeta.total}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
