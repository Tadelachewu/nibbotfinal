'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { UserReport, ReportPriority } from '@/lib/types';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useAdminAuth } from './AdminAuthContext';
import { Activity } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

export function ReportsManagement() {
  const { csrfFetch, currentRole, currentUsername } = useAdminAuth();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportsMeta, setReportsMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsCurrentPage, setReportsCurrentPage] = useState(0);
  const [reportsPageSize, setReportsPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const submissionsSearchInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Time Range State
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndTime, setCustomEndTime] = useState('23:59');

  // Function to get start and end dates based on time range
  const getTimeRangeDates = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    if (timeRange === 'today') {
      start = startOfDay(now);
    } else if (timeRange === 'week') {
      start = startOfWeek(now);
    } else if (timeRange === 'month') {
      start = startOfMonth(now);
    } else {
      // Custom range with date and time
      const [startHour, startMin] = customStartTime.split(':').map(Number);
      const [endHour, endMin] = customEndTime.split(':').map(Number);
      start = new Date(customStartDate);
      start.setHours(startHour, startMin, 0, 0);
      end = new Date(customEndDate);
      end.setHours(endHour, endMin, 59, 999);
    }

    return { start, end };
  }, [timeRange, customStartDate, customStartTime, customEndDate, customEndTime]);
  const [supportUsers, setSupportUsers] = useState<Array<{ username: string }>>([]);
  const [ratingSortKey, setRatingSortKey] = useState<'avg' | 'count' | 'lastRatedAt'>('avg');
  const [ratingsCurrentPage, setRatingsCurrentPage] = useState(0);
  const [ratingsPageSize, setRatingsPageSize] = useState(10);
  const [supportRatings, setSupportRatings] = useState<any[]>([]);
  const [ratingsMeta, setRatingsMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);

  const [editingResponse, setEditingResponse] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingStatus, setEditingStatus] = useState<UserReport['status']>('pending');
  const [editingPriority, setEditingPriority] = useState<ReportPriority>('medium');
  const [editingSupportAssignee, setEditingSupportAssignee] = useState<string>('__none__');
  const [editingSupportAssignmentType, setEditingSupportAssignmentType] = useState<'first_assignment' | 'escalation'>('first_assignment');
  const [editingSupportAssignmentReason, setEditingSupportAssignmentReason] = useState<string>('');
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [pendingReportDelete, setPendingReportDelete] = useState<string | null>(null);
  const [loadingSelectedReport, setLoadingSelectedReport] = useState(false);

  const inspectForm = useMemo(() => ({
    editingResponse, editingNotes, editingStatus, editingPriority, editingSupportAssignee, editingSupportAssignmentType, editingSupportAssignmentReason
  }), [editingResponse, editingNotes, editingStatus, editingPriority, editingSupportAssignee, editingSupportAssignmentType, editingSupportAssignmentReason]);

  const { activeDraftIds: activeReportDrafts, getDraft: getReportDraft, discardDraft: discardReportDraft } = usePerEntityDrafts('report', selectedReportId, inspectForm, isInspectOpen, csrfFetch);

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activityMeta, setActivityMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityCurrentPage, setActivityCurrentPage] = useState(0);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [activitySearch, setActivitySearch] = useState('');
  const debouncedActivitySearch = useDebounce(activitySearch, 300);
  const activitySearchInputRef = useRef<HTMLInputElement>(null);

  const fetchReports = useCallback(async (page: number = 0, pageSize: number = reportsPageSize) => {
    setReportsError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      const { start, end } = getTimeRangeDates();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const res = await csrfFetch(`/api/reports?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const meta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setReportsMeta(meta);
      setReports(next);
    } catch (e: any) {
      setReportsError(e?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [csrfFetch, debouncedSearch, statusFilter, priorityFilter, getTimeRangeDates, reportsPageSize]);

  const fetchActivityLogs = useCallback(async (page: number = 0, pageSize: number = activityPageSize) => {
    setActivityError(null);
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedActivitySearch.trim()) params.set('q', debouncedActivitySearch.trim());
      const { start, end } = getTimeRangeDates();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const res = await csrfFetch(`/api/reports/activities?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const meta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setActivityMeta(meta);
      setActivityLogs(next);
    } catch (e: any) {
      setActivityError(e?.message || 'Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  }, [csrfFetch, debouncedActivitySearch, getTimeRangeDates, activityPageSize]);

  const handleReportsPageChange = useCallback((page: number) => {
    setReportsCurrentPage(page);
    fetchReports(page, reportsPageSize);
  }, [fetchReports, reportsPageSize]);

  const handleReportsPageSizeChange = useCallback((pageSize: number) => {
    setReportsPageSize(pageSize);
    setReportsCurrentPage(0);
    fetchReports(0, pageSize);
  }, [fetchReports]);

  const handleActivityPageChange = useCallback((page: number) => {
    setActivityCurrentPage(page);
    fetchActivityLogs(page, activityPageSize);
  }, [fetchActivityLogs, activityPageSize]);

  const handleActivityPageSizeChange = useCallback((pageSize: number) => {
    setActivityPageSize(pageSize);
    setActivityCurrentPage(0);
    fetchActivityLogs(0, pageSize);
  }, [fetchActivityLogs]);

  useEffect(() => {
    fetchActivityLogs(0, activityPageSize);
  }, [fetchActivityLogs]);

  useEffect(() => {
    setReportsCurrentPage(0);
    fetchReports(0, reportsPageSize);
  }, [debouncedSearch, statusFilter, priorityFilter, fetchReports, timeRange, customStartDate, customStartTime, customEndDate, customEndTime]);

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

  const fetchRatings = useCallback(async (page: number = 0, pageSize: number = ratingsPageSize) => {
    setIsLoadingRatings(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortKey', ratingSortKey);
      const res = await csrfFetch(`/api/reports/ratings?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      setSupportRatings(Array.isArray(json?.data) ? json.data : []);
      setRatingsMeta(json?.meta && typeof json.meta === 'object' ? json.meta : null);
    } catch (err) {
      console.error('Failed to load ratings:', err);
      setSupportRatings([]);
    } finally {
      setIsLoadingRatings(false);
    }
  }, [csrfFetch, ratingSortKey, ratingsPageSize]);

  useEffect(() => {
    setRatingsCurrentPage(0);
    fetchRatings(0, ratingsPageSize);
  }, [ratingSortKey, fetchRatings]);

  const handleRatingsPageChange = (page: number) => {
    setRatingsCurrentPage(page);
    fetchRatings(page, ratingsPageSize);
  };

  const handleRatingsPageSizeChange = (size: number) => {
    setRatingsPageSize(size);
    setRatingsCurrentPage(0);
    fetchRatings(0, size);
  };

  const filteredReports = reports;

  // Fetch full report when opening inspect modal
  const openInspect = useCallback(async (reportId: string, listReport: UserReport) => {
    setSelectedReportId(reportId);
    setIsInspectOpen(true);
    setLoadingSelectedReport(true);

    try {
      const draft = await getReportDraft(reportId) as any;
      if (draft) {
        setEditingResponse(draft.editingResponse || '');
        setEditingNotes(draft.editingNotes || '');
        setEditingStatus(draft.editingStatus || 'pending');
        setEditingPriority(draft.editingPriority || 'medium');
        setEditingSupportAssignee(draft.editingSupportAssignee || '__none__');
        setEditingSupportAssignmentType(draft.editingSupportAssignmentType || 'first_assignment');
        setEditingSupportAssignmentReason(draft.editingSupportAssignmentReason || '');
      } else {
        setEditingResponse(listReport.adminResponse || '');
        setEditingNotes(listReport.internalNotes || '');
        setEditingStatus(listReport.status);
        setEditingPriority(listReport.priority || 'medium');
        setEditingSupportAssignee(listReport.supportAssignee || '__none__');
        setEditingSupportAssignmentType(listReport.supportAssignmentType || 'first_assignment');
        setEditingSupportAssignmentReason(listReport.supportAssignmentReason || '');
      }

      // Fetch full report data
      const res = await csrfFetch(`/api/reports/${encodeURIComponent(reportId)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success' && json?.data) {
        setSelectedReport(json.data);
        // Also update the list with full data
        setReports(prev => prev.map(r => r.id === reportId ? json.data : r));
      } else {
        // Fallback to list data if fetch fails
        setSelectedReport(listReport);
      }
    } catch (err) {
      console.error('Failed to fetch full report:', err);
      setSelectedReport(listReport);
    } finally {
      setLoadingSelectedReport(false);
    }
  }, [csrfFetch, getReportDraft]);

  const handleSaveAdminData = (overrideStatus?: UserReport['status']) => {
    if (selectedReportId) {
      const finalStatus = overrideStatus || editingStatus;
      const newAssignee = editingSupportAssignee === '__none__' ? null : editingSupportAssignee;
      const oldAssignee = selectedReport?.supportAssignee;
      const isSupportAssignmentChange = currentRole === 'admin' && newAssignee !== oldAssignee && newAssignee !== null;

      let updatedAssignmentHistory = selectedReport?.assignmentHistory || [];
      if (isSupportAssignmentChange) {
        const newAssignment = {
          assignee: newAssignee,
          assignedBy: currentUsername,
          assignedAt: new Date().toISOString(),
          type: editingSupportAssignmentType,
          reason: editingSupportAssignmentReason
        };
        updatedAssignmentHistory = [...updatedAssignmentHistory, newAssignment];
      }

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
                  supportAssignee: newAssignee,
                  ...(newAssignee ? { supportAssignmentType: editingSupportAssignmentType, supportAssignmentReason: editingSupportAssignmentReason } : {}),
                  assignmentHistory: updatedAssignmentHistory
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
          fetchActivityLogs(0, activityPageSize);
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
        fetchActivityLogs(0, activityPageSize);
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



  if (initialLoading) {
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
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPendingReportDelete(selectedReport.id)}>
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

                <TabsContent value="data" className="pt-6 space-y-6 animate-in fade-in-50 duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(selectedReport.data || {})
                      // `assignmentHistory` rides along inside this same `data` blob as
                      // internal bookkeeping (see the PATCH handler) — it's not something
                      // the user submitted, so it must never show up as a form field here.
                      // It gets its own section below instead.
                      .filter(([key]) => key !== 'assignmentHistory')
                      .map(([key, value]) => (
                        <div key={key} className="p-4 border rounded-xl bg-slate-50/50 dark:bg-muted/20 hover:bg-card transition-all shadow-sm group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{prettifyKey(key)}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground font-mono break-all">{String(value || 'N/A')}</span>
                        </div>
                      ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Assignment History</Label>
                    {selectedReport.assignmentHistory && selectedReport.assignmentHistory.length > 0 ? (
                      <div className="space-y-2">
                        {selectedReport.assignmentHistory.map((entry, i) => (
                          <div key={i} className="p-3 border rounded-xl bg-blue-50/40 dark:bg-blue-950/15 border-blue-200/60 dark:border-blue-900/50 flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-sm font-semibold">
                                {entry.type === 'escalation' ? 'Escalated to' : 'Assigned to'} <span className="font-mono">{entry.assignee}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">by {entry.assignedBy}</div>
                              {entry.reason && (
                                <div className="text-[11px] text-muted-foreground italic">"{entry.reason}"</div>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(entry.assignedAt), 'MMM dd, HH:mm')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic p-3 border rounded-xl bg-muted/10">No assignment changes yet.</p>
                    )}
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

          {/* Time Range Selector */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex bg-muted/30 p-1 rounded-2xl border shadow-inner">
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'custom', label: 'Custom' }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTimeRange(r.id as any)}
                  className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${timeRange === r.id
                    ? 'bg-card text-foreground shadow-lg ring-1 ring-border scale-105'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">From:</span>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-9 w-40 text-xs bg-card rounded-xl" />
                  <Input type="time" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} className="h-9 w-32 text-xs bg-card rounded-xl" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">To:</span>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-9 w-40 text-xs bg-card rounded-xl" />
                  <Input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="h-9 w-32 text-xs bg-card rounded-xl" />
                </div>
              </div>
            )}
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
                        <Button variant="outline" size="sm" onClick={() => fetchReports(reportsCurrentPage, reportsPageSize)} disabled={loading}>
                          <RefreshCw size={14} className="mr-2" /> Refresh
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput
                        ref={submissionsSearchInputRef}
                        value={search}
                        onChange={setSearch}
                        placeholder="Search submissions by report ID, user ID, menu name, status, or assignee..."
                        className="flex-1 min-w-[200px] bg-card"
                      />
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
                <CardContent className="p-0 flex flex-col h-[600px]">
                  <ScrollArea className="flex-1">
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
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => openInspect(report.id, report)} title="Resume Draft">
                                      <FileCode size={14} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => discardReportDraft(report.id)} title="Discard Draft">
                                      <X size={14} />
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-primary" onClick={() => openInspect(report.id, report)}>
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
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {reportsMeta && (
                    <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                      {reportsError ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-center">
                          <p className="text-sm text-destructive">{reportsError}</p>
                          <Button variant="outline" onClick={() => fetchReports(reportsCurrentPage, reportsPageSize)}>Retry</Button>
                        </div>
                      ) : (
                        <Pagination
                          currentPage={reportsCurrentPage}
                          pageSize={reportsPageSize}
                          totalItems={reportsMeta.total}
                          onPageChange={handleReportsPageChange}
                          onPageSizeChange={handleReportsPageSizeChange}
                        />
                      )}
                    </div>
                  )}
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
                        <Button variant="outline" size="sm" onClick={() => fetchRatings(ratingsCurrentPage, ratingsPageSize)} disabled={isLoadingRatings}>
                          <RefreshCw size={12} className={cn("mr-2", isLoadingRatings && "animate-spin")} /> Refresh
                        </Button>
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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col h-[600px]">
                    <ScrollArea className="flex-1">
                      {isLoadingRatings && (
                        <div className="flex items-center justify-center h-64">
                          <div className="text-xs text-muted-foreground animate-pulse">Loading ratings...</div>
                        </div>
                      )}
                      {!isLoadingRatings && (
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
                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground italic text-sm">
                                  No ratings available yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </ScrollArea>
                    {ratingsMeta && (
                      <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                        <Pagination
                          currentPage={ratingsCurrentPage}
                          pageSize={ratingsPageSize}
                          totalItems={ratingsMeta.total}
                          onPageChange={handleRatingsPageChange}
                          onPageSizeChange={handleRatingsPageSizeChange}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="logs">
              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="border-b bg-muted/5 p-6">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Activity className="text-primary" size={20} />
                          Support Activity Stream
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Audit trail for assignments, escalations, and official responses.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchActivityLogs(activityCurrentPage, activityPageSize)} disabled={loadingLogs}>
                          <RefreshCw size={12} className={cn("mr-2", loadingLogs && "animate-spin")} /> Refresh Log
                        </Button>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full font-medium">
                          <Clock size={12} /> Database tracking
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput
                        ref={activitySearchInputRef}
                        value={activitySearch}
                        onChange={setActivitySearch}
                        placeholder="Search activity by event type, description, report ref, or actor..."
                        className="flex-1 min-w-[200px] bg-card"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[600px]">
                  <ScrollArea className="flex-1">
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
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                  {activityMeta && (
                    <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                      {activityError ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-center">
                          <p className="text-sm text-destructive">{activityError}</p>
                          <Button variant="outline" onClick={() => fetchActivityLogs(activityCurrentPage, activityPageSize)}>Retry</Button>
                        </div>
                      ) : (
                        <Pagination
                          currentPage={activityCurrentPage}
                          pageSize={activityPageSize}
                          totalItems={activityMeta.total}
                          onPageChange={handleActivityPageChange}
                          onPageSizeChange={handleActivityPageSizeChange}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <AlertDialog open={!!pendingReportDelete} onOpenChange={(open) => !open && setPendingReportDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Report Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReportDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                if (pendingReportDelete) {
                  handleDeleteReport(pendingReportDelete);
                  setIsInspectOpen(false);
                  setPendingReportDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
