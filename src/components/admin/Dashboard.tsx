'use client';

import { useMemo, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
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
  Legend
} from 'recharts';
import { MenuItem, UserReport } from '@/lib/types';
import { createClassWithRules } from '@/lib/csp';
import { useAdminAuth } from './AdminAuthContext';
import {
  Users,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Activity,
  MousePointerClick
} from 'lucide-react';

export function Dashboard() {
  const { csrfFetch } = useAdminAuth();
  // Initialize with empty data to avoid hydration mismatch
  const [data, setData] = useState({
    menus: [] as MenuItem[],
    reports: [] as UserReport[]
  });

  const [onlineNow, setOnlineNow] = useState(0);
  const [totalBotUsers, setTotalBotUsers] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      const [menusRes, reportsRes, logsRes] = await Promise.all([
        csrfFetch('/api/menus?includeInactive=1', { cache: 'no-store' }),
        csrfFetch('/api/reports?pageSize=200', { cache: 'no-store' }),
        csrfFetch('/api/logs?summary=1', { cache: 'no-store' })
      ]);
      const [menusJson, reportsJson, logsJson] = await Promise.all([
        menusRes.json().catch(() => null),
        reportsRes.json().catch(() => null),
        logsRes.json().catch(() => null)
      ]);
      setData({
        menus: Array.isArray(menusJson?.data) ? menusJson.data : [],
        reports: Array.isArray(reportsJson?.data) ? reportsJson.data : []
      });
      setTotalBotUsers(typeof logsJson?.stats?.uniqueSessions === 'number' ? logsJson.stats.uniqueSessions : 0);
    };

    load();

    // Real-Time Socket Connection for Online Counter
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_SOCKET_IO !== 'true') {
      const dataInterval = setInterval(() => {
        load();
      }, 5000);
      return () => {
        clearInterval(dataInterval);
      };
    }

    let active = true;
    let socket: ReturnType<typeof io> | null = null;

    const connect = () => {
      if (!active) return;
      const transports =
        typeof window !== 'undefined' &&
          window.location.protocol === 'https:' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1'
          ? ['polling']
          : ['polling', 'websocket'];

      // Allow both polling and websocket by default for maximum compatibility.
      // Socket.io will automatically upgrade to websocket when possible.
      const chosenTransports = ['polling', 'websocket'];
      socket = io({ path: '/socket.io', transports: chosenTransports });
      socket.on('online_count_updated', (data) => {
        if (data && typeof data.count === 'number') {
          setOnlineNow(data.count);
        }
      });
    };

    const shouldDelay = process.env.NODE_ENV !== 'production';
    const connectTimeout = shouldDelay ? setTimeout(connect, 0) : null;
    if (!shouldDelay) connect();

    // Refresh interval for dashboard data (simulating real-time updates)
    const dataInterval = setInterval(() => {
      load();
    }, 5000);

    return () => {
      active = false;
      if (connectTimeout) clearTimeout(connectTimeout);
      socket?.disconnect();
      clearInterval(dataInterval);
    };
  }, [csrfFetch]);

  // Inject nonce-protected classes for dynamic colored elements
  useEffect(() => {
    if (!mounted) return
    // status color dots
    const statusDots = Array.from(document.querySelectorAll('[data-status-color]')) as HTMLElement[]
    statusDots.forEach((el) => {
      const color = el.getAttribute('data-status-color') || ''
      if (!color) return
      const res = createClassWithRules(`background-color: ${color};`)
      el.classList.add(res.className)
    })

    // progress bars
    const progressEls = Array.from(document.querySelectorAll('[data-progress-percentage]')) as HTMLElement[]
    progressEls.forEach((el) => {
      const pct = el.getAttribute('data-progress-percentage') || '0'
      const color = el.getAttribute('data-progress-color') || ''
      const rules = `width: ${pct}%; ${color ? `background-color: ${color};` : ''}`
      const res = createClassWithRules(rules)
      el.classList.add(res.className)
    })
  }, [mounted, data])

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

    // Chart: Priority Breakdown
    const priorityData = [
      { name: 'Urgent', count: data.reports.filter(r => r.priority === 'urgent').length },
      { name: 'High', count: data.reports.filter(r => r.priority === 'high').length },
      { name: 'Medium', count: data.reports.filter(r => r.priority === 'medium').length },
      { name: 'Low', count: data.reports.filter(r => r.priority === 'low').length }
    ];

    // Chart: Most Clicked Menus (Enabled only)
    const topClickedData = data.menus
      .filter(m => m.trackClicks && ((m.clickCount || 0) > 0 || (m.sessionClickCount || 0) > 0))
      .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
      .slice(0, 5)
      .map(m => ({
        name: m.name.length > 15 ? m.name.substring(0, 12) + '...' : m.name,
        total: m.clickCount || 0,
        sessions: m.sessionClickCount || 0
      }));

    return {
      totalMenus,
      apiMenus,
      reportMenus,
      totalReports,
      resolvedReports,
      pendingReports,
      urgentReports,
      statusData,
      priorityData,
      topClickedData
    };
  }, [data]);

  const COLORS = ['#eab308', '#2563eb', '#059669', '#dc2626'];

  // Prevent rendering content that depends on dynamic client data until mounted
  if (!mounted) return null;

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
            <div className="text-3xl font-bold">{totalBotUsers}</div>
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
                  <div className="w-2 h-2 rounded-full" data-status-color={s.color} />
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
        {/* Top Clicked Interactions - Multi Metric */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MousePointerClick size={16} className="text-primary" />
              Top Interactions (Total vs Unique)
            </CardTitle>
            <CardDescription className="text-[10px]">Comparing total clicks vs unique session reach.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {stats.topClickedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topClickedData} margin={{ left: 10, right: 30, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#64748b' }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar name="Total Clicks" dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={15} />
                  <Bar name="Unique Reach" dataKey="sessions" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-30">
                <MousePointerClick size={32} />
                <p className="text-[10px] font-bold uppercase">No tracking active</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Complexity Indicator */}
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
              {[
                { name: 'Static', value: data.menus.filter(m => m.responseType === 'static').length },
                { name: 'API', value: data.menus.filter(m => m.responseType === 'api').length },
                { name: 'Report', value: data.menus.filter(m => m.responseType === 'report').length }
              ].map((item, idx) => (
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
                      data-progress-percentage={stats.totalMenus > 0 ? (item.value / stats.totalMenus) * 100 : 0}
                      data-progress-color={COLORS[idx]}
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
