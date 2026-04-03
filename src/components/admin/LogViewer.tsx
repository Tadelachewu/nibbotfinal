'use client';

import { useState, useEffect } from 'react';
import { LogEntry } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw, AlertCircle, CheckCircle2, Info, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchLogs = () => {
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/logs', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        setLogs(Array.isArray(json?.data) ? json.data : []);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filterLower = filter.toLowerCase();
  const filteredLogs = logs.filter(log => {
    const userMsg = toPlainText(log.userMessage || '');
    const botMsg = toPlainText(log.botResponse || '');
    return (
      log.sessionId.toLowerCase().includes(filterLower) ||
      userMsg.toLowerCase().includes(filterLower) ||
      botMsg.toLowerCase().includes(filterLower) ||
      log.endpoint?.toLowerCase().includes(filterLower) ||
      log.tags?.some(tag => tag.toLowerCase().includes(filterLower))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Success</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      case 'failed': return <Badge variant="outline" className="text-amber-800 border-amber-200 bg-amber-50">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search logs by session, message, endpoint or tags..."
            className="pl-10"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
          <RotateCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Response Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                      {isLoading ? 'Loading logs...' : 'No interaction logs found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log, index) => (
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
                        {log.responseTime ? `${log.responseTime}ms` : '--'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-medium">Auto-Masking</p>
                <p className="text-[10px] text-muted-foreground">Sensitive data (tokens, passwords) is automatically masked.</p>
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
                <p className="text-sm font-medium">Status Check</p>
                <p className="text-[10px] text-muted-foreground text-blue-700/70">Failed API calls include error details in the full log entry.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
