'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { LogEntry } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, CheckCircle2, Info, Clock, ShieldCheck, UserCog, Filter } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details?: string;
  ip?: string;
  userAgent?: string;
}

export function LogViewer() {
  const { csrfFetch } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'interactions' | 'audit'>('interactions');

  // Time range state
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndTime, setCustomEndTime] = useState('23:59');

  // Interaction Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebounce(filter, 300);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const interactionSearchInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactionCurrentPage, setInteractionCurrentPage] = useState(0);
  const [interactionPageSize, setInteractionPageSize] = useState(10);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const debouncedAuditFilter = useDebounce(auditFilter, 300);
  const auditSearchInputRef = useRef<HTMLInputElement>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditMeta, setAuditMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditCurrentPage, setAuditCurrentPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);

  const toPlainText = (input: string) => {
    const str = String(input || '');
    if (!str) return '';
    if (!str.includes('<')) return str;
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      return String(doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch {
      return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  };

  // Calculate start and end dates based on time range
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

  const fetchLogs = useCallback(async (page: number = 0, size: number = interactionPageSize) => {
    setInteractionError(null);
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(size));
      if (debouncedFilter.trim()) params.set('q', debouncedFilter.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const { start, end } = getTimeRangeDates();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const res = await csrfFetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const nextMeta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setMeta(nextMeta);
      setLogs(next);
    } catch (e: any) {
      setInteractionError(e?.message || 'Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  }, [csrfFetch, debouncedFilter, statusFilter, getTimeRangeDates, interactionPageSize]);

  const fetchAuditLogs = useCallback(async (page: number = 0, size: number = auditPageSize) => {
    setAuditError(null);
    setIsAuditLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(size));
      if (debouncedAuditFilter.trim()) params.set('q', debouncedAuditFilter.trim());
      const { start, end } = getTimeRangeDates();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const res = await csrfFetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const nextMeta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setAuditMeta(nextMeta);
      setAuditLogs(next);
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to load audit logs');
    } finally {
      setIsAuditLoading(false);
    }
  }, [csrfFetch, debouncedAuditFilter, getTimeRangeDates, auditPageSize]);

  useEffect(() => {
    if (activeTab === 'interactions') {
      setInteractionCurrentPage(0);
      fetchLogs(0, interactionPageSize);
    } else {
      setAuditCurrentPage(0);
      fetchAuditLogs(0, auditPageSize);
    }
  }, [debouncedFilter, debouncedAuditFilter, activeTab, fetchLogs, fetchAuditLogs, timeRange, customStartDate, customStartTime, customEndDate, customEndTime, statusFilter, interactionPageSize, auditPageSize]);

  const handleInteractionPageChange = (newPage: number) => {
    setInteractionCurrentPage(newPage);
    fetchLogs(newPage, interactionPageSize);
  };

  const handleInteractionPageSizeChange = (newSize: number) => {
    setInteractionPageSize(newSize);
    setInteractionCurrentPage(0);
    fetchLogs(0, newSize);
  };

  const handleAuditPageChange = (newPage: number) => {
    setAuditCurrentPage(newPage);
    fetchAuditLogs(newPage, auditPageSize);
  };

  const handleAuditPageSizeChange = (newSize: number) => {
    setAuditPageSize(newSize);
    setAuditCurrentPage(0);
    fetchAuditLogs(0, newSize);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Success</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      case 'failed': return <Badge variant="outline" className="text-amber-800 border-amber-200 bg-amber-50">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const isDestructive = action.includes('DELETE') || action.includes('REMOVE') || action.includes('REJECT');
    const isSuccess = action.includes('CREATE') || action.includes('APPROVE') || action.includes('LOGIN');

    if (isDestructive) return <Badge variant="destructive" className="text-[10px]">{action}</Badge>;
    if (isSuccess) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">{action}</Badge>;
    return <Badge variant="outline" className="text-[10px]">{action}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="interactions" className="gap-2">
              <Clock size={14} />
              Interactions
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <ShieldCheck size={14} />
              Audit Logs
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap items-center gap-4">
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

      <div className="flex flex-wrap items-center gap-2 flex-1">
        <SearchInput
          ref={activeTab === 'interactions' ? interactionSearchInputRef : auditSearchInputRef}
          value={activeTab === 'interactions' ? filter : auditFilter}
          onChange={activeTab === 'interactions' ? setFilter : setAuditFilter}
          placeholder={activeTab === 'interactions'
            ? "Search interactions (session ID, user message, bot response, endpoint, tags)..."
            : "Search audit logs (actor, action, target, details)..."}
          className="flex-1 min-w-[200px]"
        />
        {activeTab === 'interactions' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter size={14} className="mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => activeTab === 'interactions' ? fetchLogs(interactionCurrentPage, interactionPageSize) : fetchAuditLogs(auditCurrentPage, auditPageSize)}
          disabled={activeTab === 'interactions' ? isLoading : isAuditLoading}
        >
          <RotateCcw className={`h-4 w-4 ${(activeTab === 'interactions' ? isLoading : isAuditLoading) ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">

        <TabsContent value="interactions" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Recent Interaction Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[600px]">
              <div className="rounded-md border flex-1 flex flex-col">
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-0 z-10 border-b">
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
                        <TableHead>Session ID</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Response Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                            {isLoading ? 'Loading logs...' : 'No interaction logs found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log, index) => (
                          <TableRow key={index} className="group hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {log.timestamp ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs font-bold truncate max-w-[120px] block" title={log.sessionId}>
                                {log.sessionId.substring(5, 13)}...
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1">
                                    {log.endpoint?.split(':').pop()}
                                  </Badge>
                                  <span className="text-xs font-medium truncate max-w-[300px]" title={log.userMessage}>
                                    {toPlainText(log.userMessage)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                                  Bot: {toPlainText(log.botResponse)}
                                </p>
                                {(log.status === 'error' || log.status === 'failed') && log.errorDetails && (
                                  <p className="text-[10px] text-red-700 line-clamp-2">
                                    Error: {log.errorDetails}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {Number.isFinite(log.responseTime) ? `${Math.max(0, Math.round(log.responseTime))}ms` : '0ms'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {meta && (
                  <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                    {interactionError ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <p className="text-sm text-destructive">{interactionError}</p>
                        <Button variant="outline" onClick={() => fetchLogs(interactionCurrentPage, interactionPageSize)}>Retry</Button>
                      </div>
                    ) : (
                      <Pagination
                        currentPage={interactionCurrentPage}
                        pageSize={interactionPageSize}
                        totalItems={meta.total}
                        onPageChange={handleInteractionPageChange}
                        onPageSizeChange={handleInteractionPageSizeChange}
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                System Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[600px]">
              <div className="rounded-md border flex-1 flex flex-col">
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-0 z-10 border-b">
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
                        <TableHead className="w-[120px]">Actor</TableHead>
                        <TableHead className="w-[150px]">Action</TableHead>
                        <TableHead className="w-[150px]">Target</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                            {isAuditLoading ? 'Loading audit logs...' : 'No audit logs found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} className="group hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <UserCog size={12} className="text-muted-foreground" />
                                <span className="text-xs font-bold">{log.actor}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getActionBadge(log.action)}</TableCell>
                            <TableCell>
                              <code className="text-[10px] bg-muted px-1 py-0.5 rounded truncate max-w-[140px] block" title={log.target}>
                                {log.target}
                              </code>
                            </TableCell>
                            <TableCell>
                              <p className="text-[11px] text-muted-foreground line-clamp-2" title={log.details}>
                                {log.details || 'No details provided.'}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {auditMeta && (
                  <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                    {auditError ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <p className="text-sm text-destructive">{auditError}</p>
                        <Button variant="outline" onClick={() => fetchAuditLogs(auditCurrentPage, auditPageSize)}>Retry</Button>
                      </div>
                    ) : (
                      <Pagination
                        currentPage={auditCurrentPage}
                        pageSize={auditPageSize}
                        totalItems={auditMeta.total}
                        onPageChange={handleAuditPageChange}
                        onPageSizeChange={handleAuditPageSizeChange}
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-medium">Compliance Tracking</p>
                <p className="text-[10px] text-muted-foreground">Audit logs track all administrative changes for security compliance.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Info size={24} />
              </div>
              <div>
                <p className="text-sm font-medium">Action Monitoring</p>
                <p className="text-[10px] text-muted-foreground text-blue-700/70">Hover over truncated fields to see full details of the action.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
