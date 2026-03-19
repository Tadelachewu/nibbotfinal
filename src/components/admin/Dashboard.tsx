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
  Cell
} from 'recharts';
import { 
  getStoredMenus, 
  getStoredReports 
} from '@/lib/store';
import { 
  Users, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Activity
} from 'lucide-react';

export function Dashboard() {
  const [data, setData] = useState({
    menus: getStoredMenus(),
    reports: getStoredReports()
  });

  const [onlineNow, setOnlineNow] = useState(0);

  useEffect(() => {
    // Initial data load
    setData({
      menus: getStoredMenus(),
      reports: getStoredReports()
    });

    // Simulate online users fluctuation for the prototype
    // In a production environment, this would come from a real-time presence system (e.g. Firestore or WebSockets)
    setOnlineNow(Math.floor(Math.random() * 5) + 3);
    
    const presenceInterval = setInterval(() => {
      setOnlineNow(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        return Math.max(1, Math.min(25, prev + change));
      });
    }, 8000);

    // Refresh interval for dashboard data (simulating real-time updates)
    const dataInterval = setInterval(() => {
      setData({
        menus: getStoredMenus(),
        reports: getStoredReports()
      });
    }, 5000);

    return () => {
      clearInterval(presenceInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const stats = useMemo(() => {
    const totalMenus = data.menus.length;
    const apiMenus = data.menus.filter(m => m.responseType === 'api').length;
    const reportMenus = data.menus.filter(m => m.responseType === 'report').length;
    const totalReports = data.reports.length;
    const resolvedReports = data.reports.filter(r => r.status === 'resolved').length;
    const pendingReports = data.reports.filter(r => r.status === 'pending').length;
    const urgentReports = data.reports.filter(r => r.priority === 'urgent' || r.priority === 'high').length;
    
    // Total Active Users: Unique session IDs found in submission history
    const uniqueUsers = new Set(data.reports.map(r => r.userId)).size;

    // Chart: Reports by Status (Workflow visualization)
    const statusData = [
      { name: 'Pending', value: pendingReports, color: '#f59e0b' },
      { name: 'Reviewed', value: data.reports.filter(r => r.status === 'reviewed').length, color: '#3b82f6' },
      { name: 'Resolved', value: resolvedReports, color: '#10b981' }
    ];

    // Chart: Menu Distribution (System complexity)
    const menuTypeData = [
      { name: 'Static', value: data.menus.filter(m => m.responseType === 'static').length },
      { name: 'API', value: apiMenus },
      { name: 'Report', value: reportMenus }
    ];

    // Chart: Reports by Priority (Triage visualization)
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
      uniqueUsers,
      statusData,
      menuTypeData,
      priorityData
    };
  }, [data]);

  const COLORS = ['#eab308', '#2563eb', '#059669', '#dc2626'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Online Now</CardTitle>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{onlineNow}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Live active sessions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Total Bot Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Unique session participants</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Urgent Triage</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.urgentReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">High-priority events</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.resolvedReports}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total completed cases</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution (Pie Chart) */}
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

        {/* Priority Triage (Bar Chart) */}
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
        {/* System Complexity Indicator (Progress Bars) */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap size={16} className="text-primary" />
              Menu Complexity
            </CardTitle>
            <CardDescription className="text-[10px]">Analysis of interaction types across the system tree.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.menuTypeData.map((item, idx) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-muted-foreground">{item.name} Nodes</span>
                    <span className="font-bold text-foreground">
                      {stats.totalMenus > 0 ? Math.round((item.value / stats.totalMenus) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000" 
                      style={{ 
                        width: `${stats.totalMenus > 0 ? (item.value / stats.totalMenus) * 100 : 0}%`, 
                        backgroundColor: COLORS[idx] 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}