'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogEntry } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw, CheckCircle2, Info, Clock, ShieldCheck, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  
  // Interaction Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditMeta, setAuditMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [isAuditLoadingMore, setIsAuditLoadingMore] = useState(false);

  const PAGE_SIZE = 100;

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

  const fetchLogs = useCallback(async (opts?: { page?: number; append?: boolean }) => {
    const page = Number.isFinite(opts?.page) && (opts?.page as number) >= 0 ? Math.floor(opts!.page as number) : 0;
    const append = Boolean(opts?.append);
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (filter.trim()) params.set('q', filter.trim());
      const res = await csrfFetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const nextMeta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setMeta(nextMeta);
      setLogs(prev => append ? [...prev, ...next] : next);
    } finally {
      if (append) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [csrfFetch, filter]);

  const fetchAuditLogs = useCallback(async (opts?: { page?: number; append?: boolean }) => {
    const page = Number.isFinite(opts?.page) && (opts?.page as number) >= 0 ? Math.floor(opts!.page as number) : 0;
    const append = Boolean(opts?.append);
    if (append) setIsAuditLoadingMore(true);
    else setIsAuditLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(50)); // Audit logs use smaller page size
      if (auditFilter.trim()) params.set('q', auditFilter.trim());
      const res = await csrfFetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? json.data : [];
      const nextMeta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setAuditMeta(nextMeta);
      setAuditLogs(prev => append ? [...prev, ...next] : next);
    } finally {
      if (append) setIsAuditLoadingMore(false);
      else setIsAuditLoading(false);
    }
  }, [csrfFetch, auditFilter]);

  useEffect(() => {
    if (activeTab === 'interactions') {
      fetchLogs({ page: 0, append: false });
    } else {
      fetchAuditLogs({ page: 0, append: false });
    }
  }, [filter, auditFilter, activeTab, fetchLogs, fetchAuditLogs]);

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
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
          
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder={activeTab === 'interactions' ? "Search interactions..." : "Search audit logs..."}
                className="pl-10"
                value={activeTab === 'interactions' ? filter : auditFilter}
                onChange={(e) => activeTab === 'interactions' ? setFilter(e.target.value) : setAuditFilter(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => activeTab === 'interactions' ? fetchLogs({ page: 0, append: false }) : fetchAuditLogs({ page: 0, append: false })} 
              disabled={activeTab === 'interactions' ? isLoading : isAuditLoading}
            >
              <RotateCcw className={`h-4 w-4 ${(activeTab === 'interactions' ? isLoading : isAuditLoading) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <TabsContent value="interactions" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Recent Interaction Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-16 z-10 border-b">
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
                    {meta?.hasMore && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6">
                          <div className="flex items-center justify-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isLoadingMore}
                              onClick={() => fetchLogs({ page: (meta?.page ?? 0) + 1, append: true })}
                              className="gap-2"
                            >
                              <RotateCcw className={`h-4 w-4 ${isLoadingMore ? 'animate-spin' : ''}`} />
                              Load more
                            </Button>
                            {typeof meta.total === 'number' && (
                              <span className="text-xs text-muted-foreground">
                                Showing {logs.length} of {meta.total}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-card/95 backdrop-blur-sm sticky top-16 z-10 border-b">
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
                    {auditMeta?.hasMore && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6">
                          <div className="flex items-center justify-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isAuditLoadingMore}
                              onClick={() => fetchAuditLogs({ page: (auditMeta?.page ?? 0) + 1, append: true })}
                              className="gap-2"
                            >
                              <RotateCcw className={`h-4 w-4 ${isAuditLoadingMore ? 'animate-spin' : ''}`} />
                              Load more
                            </Button>
                            {typeof auditMeta.total === 'number' && (
                              <span className="text-xs text-muted-foreground">
                                Showing {auditLogs.length} of {auditMeta.total}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
