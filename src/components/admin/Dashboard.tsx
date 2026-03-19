
'use client';

import { useMemo, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  getStoredMenus, 
  getStoredReports 
} from '@/lib/store';
import { 
  Activity, 
  Users, 
  Zap, 
  MessageSquare, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const [data, setData] = useState({
    menus: getStoredMenus(),
    reports: getStoredReports()
  });

  useEffect(() => {
    // Refresh interval for dashboard data
    const interval = setInterval(() => {
      setData({
        menus: getStoredMenus(),
        reports: getStoredReports()
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const totalMenus = data.menus.length;
    const apiMenus = data.menus.filter(m => m.responseType === 'api').length;
    const reportMenus = data.menus.filter(m => m.responseType === 'report').length;
    const totalReports = data.reports.length;
    const resolvedReports = data.reports.filter(r => r.status === 'resolved').length;
    const pendingReports = data.reports.filter(r => r.status === 'pending').length;
    const urgentReports = data.reports.filter(r => r.priority === 'urgent' || r.priority === 'high').length;

    // Chart: Reports by Status
    const statusData = [
      { name: 'Pending', value: pendingReports, color: '#f59e0b' },
      { name: 'Reviewed', value: data.reports.filter(r => r.status === 'reviewed').length, color: '#3b82f6' },
      { name: 'Resolved', value: resolvedReports, color: '#10b981' }
    ];

    // Chart: Menu Distribution
    const menuTypeData = [
      { name: 'Static', value: data.menus.filter(m => m.responseType === 'static').length },
      { name: 'API', value: apiMenus },
      { name: 'Report', value: reportMenus }
    ];

    // Chart: Reports by Priority
    const priorityData = [
      { name: 'Urgent', count: data.reports.filter(r => r.priority === 'urgent').length },
      { name: 'High', count: data.reports.filter(r => r.priority === 'high').length },
      { name: 'Medium', count: data.reports.filter(r => r.priority === 'medium').length },
      { name: 'Low', count: data.reports.filter(r => r.priority === 'low').length }
    ];

    return {
      totalMenus,
      apiMenus,
      reportMenus,
      totalReports,
      resolvedReports,
      pendingReports,
      urgentReports,
      statusData,
      menuTypeData,
      priorityData
    };
  }, [data]);

  const COLORS = ['#eab308', '#2563eb', '#059669', '#dc2626'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Tree Size</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMenus}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Configured interactive nodes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting administrative action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Urgent Triage</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgentReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">High-priority security events</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Resolved Total</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolvedReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Successfully handled issues</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Submission Lifecycle
            </CardTitle>
            <CardDescription className="text-[10px]">Distribution of reports by current status.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {stats.statusData.map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase">{s.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority Triage */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Priority Breakdown
            </CardTitle>
            <CardDescription className="text-[10px]">Reports grouped by assigned priority level.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Complexity Indicator */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap size={16} className="text-primary" />
              Menu Complexity
            </CardTitle>
            <CardDescription className="text-[10px]">Analysis of interaction types across the tree.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.menuTypeData.map((item, idx) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span>{item.name} Nodes</span>
                    <span className="text-muted-foreground">{Math.round((item.value / stats.totalMenus) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000" 
                      style={{ width: `${(item.value / stats.totalMenus) * 100}%`, backgroundColor: COLORS[idx] }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Health Indicators */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" />
              Operational Health
            </CardTitle>
            <CardDescription className="text-[10px]">Real-time status of system components.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-xl bg-muted/5">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">API Engine</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold">Stable</span>
                </div>
              </div>
              <div className="p-3 border rounded-xl bg-muted/5">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Local Storage</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold">Synchronized</span>
                </div>
              </div>
              <div className="p-3 border rounded-xl bg-muted/5">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Localization</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{getStoredMenus().some(m => !!m.nameAm) ? 'Multi-Lang' : 'Single-Lang'}</span>
                </div>
              </div>
              <div className="p-3 border rounded-xl bg-muted/5">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Security</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">Mock-Auth</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
