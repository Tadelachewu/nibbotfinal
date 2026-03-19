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
import { Search, User, FileText, ChevronRight, ClipboardList, Loader2, Calendar, CheckCircle2, Clock, AlertCircle, Trash2, Database, LayoutPanelLeft, RefreshCw, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStoredReports, updateReportStatus, updateReportAdminResponse, deleteReport } from '@/lib/store';
import { UserReport } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export function ReportsManagement() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingResponse, setEditingResponse] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

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
    return reports.filter(r => 
      r.menuName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userId?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(r.data || {}).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
    );
  }, [reports, search]);

  const handleUpdateStatus = (reportId: string, newStatus: string) => {
    updateReportStatus(reportId, newStatus as UserReport['status']);
    setReports(getStoredReports());
    toast({ title: "Status Updated", description: `Report marked as ${newStatus}.` });
  };

  const handleSaveResponse = () => {
    if (selectedReportId) {
      updateReportAdminResponse(selectedReportId, editingResponse);
      setReports(getStoredReports());
      toast({ title: "Response Saved", description: "Admin comment has been updated." });
    }
  };

  const handleDeleteReport = (reportId: string) => {
    deleteReport(reportId);
    setReports(getStoredReports());
    toast({ title: "Report Deleted" });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="text-emerald-500" size={14} />;
      case 'reviewed': return <Clock className="text-blue-500" size={14} />;
      default: return <AlertCircle className="text-amber-500" size={14} />;
    }
  };

  const prettifyKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

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
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ClipboardList className="text-primary" size={20} />
                User Submissions (Local)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Dynamically managed reports stored in your browser.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search user, ref ID, or data..." 
                  className="pl-10 bg-white" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={refreshReports} title="Refresh List">
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[650px]">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[120px] font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider">Report Type</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider">JSON Data Preview</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider">Submitted By</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider">Date</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px] tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="group hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.status)}
                        <Badge 
                          variant={report.status === 'pending' ? 'destructive' : report.status === 'resolved' ? 'default' : 'secondary'} 
                          className="capitalize text-[10px] px-2 py-0.5"
                        >
                          {report.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{report.menuName}</div>
                      <div className="text-[9px] text-muted-foreground font-mono truncate max-w-[120px]">REF: {report.id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 bg-slate-50 border rounded p-1.5 max-w-[250px] overflow-hidden">
                        <Database size={10} className="text-primary shrink-0" />
                        <div className="text-[10px] text-muted-foreground truncate italic font-mono">
                          {Object.entries(report.data || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Empty Payload'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User size={14} />
                        </div>
                        <span className="text-xs font-mono font-medium">{report.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {format(new Date(report.timestamp), 'MMM dd, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog onOpenChange={(open) => {
                          if (open) {
                            setSelectedReportId(report.id);
                            setEditingResponse(report.adminResponse || '');
                          } else {
                            setSelectedReportId(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs hover:bg-primary hover:text-white transition-all">
                              Inspect <ChevronRight size={14} className="ml-1" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xl flex flex-col max-h-[90vh]">
                            <DialogHeader className="border-b pb-4">
                              <DialogTitle className="flex items-center gap-2 text-xl">
                                <FileText size={22} className="text-primary" />
                                {report.menuName}
                              </DialogTitle>
                              <p className="text-xs text-muted-foreground font-mono">Submission Reference: {report.id}</p>
                            </DialogHeader>
                            
                            <ScrollArea className="flex-1 py-6 pr-4">
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border border-dashed">
                                  <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Submitter Details</span>
                                    <div className="flex items-center gap-2 text-sm font-medium"><User size={14} className="text-primary" /> {report.userId}</div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock size={10} /> {format(new Date(report.timestamp), 'MMMM dd, yyyy HH:mm:ss')}</div>
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Management Status</span>
                                    <Select 
                                      defaultValue={report.status} 
                                      onValueChange={(val) => handleUpdateStatus(report.id, val)}
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending Review</SelectItem>
                                        <SelectItem value="reviewed">Under Investigation</SelectItem>
                                        <SelectItem value="resolved">Action Completed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare size={16} className="text-primary" />
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Admin Written Response</span>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] text-muted-foreground">The user will see this message when they check their report status.</Label>
                                    <Textarea 
                                      value={editingResponse} 
                                      onChange={(e) => setEditingResponse(e.target.value)} 
                                      placeholder="Write a message to the user regarding their submission..."
                                      className="min-h-[100px] text-sm"
                                    />
                                    <Button onClick={handleSaveResponse} size="sm" className="w-full">Save Admin Response</Button>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <LayoutPanelLeft size={16} className="text-primary" />
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Collected JSON Payload</span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px]">{Object.keys(report.data || {}).length} Active Fields</Badge>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3">
                                    {Object.entries(report.data || {}).map(([key, value]) => (
                                      <div key={key} className="flex items-center justify-between p-4 rounded-lg border bg-slate-50/50 shadow-sm group hover:border-primary/30 hover:bg-white transition-all">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{prettifyKey(key)}</span>
                                        <span className="text-sm font-semibold text-slate-900 font-mono">{String(value || 'N/A')}</span>
                                      </div>
                                    ))}
                                    {(!report.data || Object.keys(report.data).length === 0) && (
                                      <div className="py-12 text-center text-muted-foreground italic text-xs bg-muted/10 rounded-lg border border-dashed">
                                        No data fields were captured for this specific report configuration.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteReport(report.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReports.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                        <ClipboardList size={48} />
                        <p className="italic text-sm">No submissions matching "{search}"</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
