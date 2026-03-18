
'use client';

import { useState, useEffect } from 'react';
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
import { Search, Filter, Calendar, User, FileText, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mock data for initial view - real implementation would use useCollection('reports')
const MOCK_REPORTS = [
  {
    id: 'rep_1',
    userId: 'user_123',
    menuName: 'Fraud Report',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'pending',
    data: {
      account_number: '11223344',
      transaction_date: '2024-05-20',
      description: 'Unauthorized withdrawal of 500 ETB'
    }
  },
  {
    id: 'rep_2',
    userId: 'user_456',
    menuName: 'Lost Card Report',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'reviewed',
    data: {
      account_id: '88991122',
      card_type: 'ATM Debit',
      location: 'Bole, Addis Ababa'
    }
  }
];

export function ReportsManagement() {
  const [reports, setReports] = useState(MOCK_REPORTS);
  const [search, setSearch] = useState('');

  const filteredReports = reports.filter(r => 
    r.menuName.toLowerCase().includes(search.toLowerCase()) ||
    r.userId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Recent Submissions</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search reports or users..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="group cursor-pointer hover:bg-muted/30">
                    <TableCell>
                      <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'} className="capitalize">
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{report.menuName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{report.userId}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(report.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8">
                            View Details <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <FileText size={18} className="text-primary" />
                              Submission Details
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">User</span>
                                <div className="flex items-center gap-2 text-sm"><User size={14} /> {report.userId}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Type</span>
                                <div className="flex items-center gap-2 text-sm"><ClipboardList size={14} /> {report.menuName}</div>
                              </div>
                            </div>
                            <div className="space-y-2 border-t pt-4">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">Collected Data</span>
                              <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                                {Object.entries(report.data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-xs">
                                    <span className="font-medium text-muted-foreground">{key}:</span>
                                    <span className="font-mono">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                      No submissions found matching your search.
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
