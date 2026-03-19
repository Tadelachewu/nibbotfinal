'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  getStoredReports, 
  updateReportStatus, 
  updateReportPriority,
  updateReportAdminResponse, 
  updateReportInternalNotes,
  deleteReport 
} from '@/lib/store';
import { UserReport, ReportPriority } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export function ReportsManagement() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  const [editingResponse, setEditingResponse] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  useEffect(() => {
    refreshReports();
  }, []);

  const refreshReports = () => {
    setLoading(true);
    setTimeout(() => {
      setReports(getStoredReports());
      setLoading(false);
    }, 300);
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = 
        r.menuName?.toLowerCase().includes(search.toLowerCase()) ||
        r.userId?.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        Object.values(r.data || {}).some(val => String(val).toLowerCase().includes(search.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [reports, search, statusFilter, priorityFilter]);

  const handleUpdateStatus = (reportId: string, newStatus: string) => {
    updateReportStatus(reportId, newStatus as UserReport['status']);
    setReports(getStoredReports());
    toast({ title: "Status Updated", description: `Report marked as ${newStatus}.` });
  };

  const handleUpdatePriority = (reportId: string, newPriority: string) => {
    updateReportPriority(reportId, newPriority as ReportPriority);
    setReports(getStoredReports());
    toast({ title: "Priority Updated", description: `Report set to ${newPriority} priority.` });
  };

  const handleSaveAdminData = () => {
    if (selectedReportId) {
      updateReportAdminResponse(selectedReportId, editingResponse);
      updateReportInternalNotes(selectedReportId, editingNotes);
      setReports(getStoredReports());
      toast({ title: "Updated", description: "Admin feedback and notes saved." });
    }
  };

  const handleDeleteReport = (reportId: string) => {
    deleteReport(reportId);
    setReports(getStoredReports());
    toast({ title: "Report Deleted" });
  };

  const downloadJson = (report: UserReport) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
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
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-primary">Pending</span>
            <AlertCircle size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1">{reports.filter(r => r.status === 'pending').length}</p>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-700">High/Urgent</span>
            <ShieldAlert size={16} className="text-amber-700" />
          </div>
          <p className="text-2xl font-bold mt-1">{reports.filter(r => r.priority === 'high' || r.priority === 'urgent').length}</p>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-700">Resolved Today</span>
            <CheckCircle2 size={16} className="text-emerald-700" />
          </div>
          <p className="text-2xl font-bold mt-1">{reports.filter(r => r.status === 'resolved').length}</p>
        </Card>
      </div>

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
                <Button variant="outline" size="sm" onClick={refreshReports}>
                  <RefreshCw size={14} className="mr-2" /> Refresh
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search submissions..." 
                  className="pl-10 bg-white" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-white">
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
                <SelectTrigger className="w-[140px] h-10 bg-white">
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
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px] font-bold uppercase text-[10px]">Priority</TableHead>
                  <TableHead className="w-[100px] font-bold uppercase text-[10px]">Status</TableHead>
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
                      <div className="font-semibold text-xs">{report.menuName}</div>
                      <div className="text-[9px] text-muted-foreground font-mono">#{report.id.split('_')[1]}</div>
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
                      <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-primary" onClick={() => {
                        setSelectedReportId(report.id);
                        setEditingResponse(report.adminResponse || '');
                        setEditingNotes(report.internalNotes || '');
                        setIsInspectOpen(true);
                      }}>
                        Inspect <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
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
        </CardContent>
      </Card>

      <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selectedReport && (
            <>
              <DialogHeader className="p-6 border-b bg-muted/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="text-primary" size={24} />
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedReport.menuName}</DialogTitle>
                      <p className="text-xs text-muted-foreground font-mono">Reference: {selectedReport.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadJson(selectedReport)}>
                      <Download size={14} className="mr-2" /> Export JSON
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { handleDeleteReport(selectedReport.id); setIsInspectOpen(false); }}>
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Status</Label>
                      <Select defaultValue={selectedReport.status} onValueChange={(val) => handleUpdateStatus(selectedReport.id, val)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Priority</Label>
                      <Select defaultValue={selectedReport.priority || 'medium'} onValueChange={(val) => handleUpdatePriority(selectedReport.id, val)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Submitted By</Label>
                      <div className="flex items-center gap-2 h-9 border rounded-md px-3 bg-muted/20 text-xs font-mono">
                        <User size={14} className="text-muted-foreground" /> {selectedReport.userId}
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="data" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="data" className="text-xs">Collected Data</TabsTrigger>
                      <TabsTrigger value="response" className="text-xs">User Response</TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs">Internal Notes</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="data" className="pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(selectedReport.data || {}).map(([key, value]) => (
                          <div key={key} className="p-3 border rounded-lg bg-slate-50/50 hover:bg-white transition-all shadow-sm">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight block mb-1">{prettifyKey(key)}</span>
                            <span className="text-sm font-semibold text-slate-900 font-mono break-all">{String(value || 'N/A')}</span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="response" className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-primary" />
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Response to User</Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">This message is visible to the user when they check their report status in the chat bot.</p>
                        <Textarea 
                          value={editingResponse} 
                          onChange={(e) => setEditingResponse(e.target.value)} 
                          placeholder="Write a message to the user..."
                          className="min-h-[120px] text-sm"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <NotebookPen size={16} className="text-amber-600" />
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Private Admin Notes</Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">These notes are for internal use only and are NEVER visible to the user.</p>
                        <Textarea 
                          value={editingNotes} 
                          onChange={(e) => setEditingNotes(e.target.value)} 
                          placeholder="Add internal observations, next steps, or agent notes..."
                          className="min-h-[120px] text-sm border-amber-200 focus-visible:ring-amber-500"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-6 border-t bg-muted/5 sticky bottom-0 z-50">
                <Button variant="ghost" onClick={() => setIsInspectOpen(false)}>Close</Button>
                <Button onClick={() => { handleSaveAdminData(); setIsInspectOpen(false); }}>
                  Save All Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
