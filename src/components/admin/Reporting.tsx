'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAdminAuth } from './AdminAuthContext';
import {
  TrendingUp,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Calendar as CalendarIcon,
  Filter,
  Users,
  MousePointerClick,
  ClipboardList,
  LayoutDashboard,
  Globe,
  Zap,
  Info,
  History,
  User as UserIcon,
  Star,
  XCircle,
  DoorOpen,
  UserCheck,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
} from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput } from '@/components/ui/search-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { MenuItem, UserReport } from '@/lib/types';

import React from 'react';

// Stats/charts need the full time-range dataset, not just one page of results.
// Fetch in large batches and stitch the pages together, capped to avoid runaway loops.
const STATS_PAGE_SIZE = 500;
const MAX_STATS_PAGES = 20;

async function fetchAllPages(
  csrfFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  url: string,
  baseParams: URLSearchParams
): Promise<any[]> {
  const params = new URLSearchParams(baseParams);
  params.set('pageSize', String(STATS_PAGE_SIZE));
  params.set('page', '0');

  const res = await csrfFetch(`${url}?${params.toString()}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({ data: [], meta: null }));
  let data: any[] = Array.isArray(json?.data) ? json.data : [];

  const total = typeof json?.meta?.total === 'number' ? json.meta.total : data.length;
  const totalPages = Math.min(Math.ceil(total / STATS_PAGE_SIZE), MAX_STATS_PAGES);

  for (let page = 1; page < totalPages; page++) {
    params.set('page', String(page));
    const r = await csrfFetch(`${url}?${params.toString()}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({ data: [] }));
    if (Array.isArray(j?.data)) data = data.concat(j.data);
  }

  return data;
}

export function Reporting() {
  const { csrfFetch, currentRole } = useAdminAuth();
  // Full, unpaginated datasets for the active time range - used for headline stats/charts.
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<UserReport[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportsMeta, setReportsMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedActionType, setSelectedActionType] = useState<'all' | 'static' | 'api' | 'report' | 'redirect'>('all');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const debouncedMenuSearchQuery = useDebounce(menuSearchQuery, 300);
  const menuSearchInputRef = useRef<HTMLInputElement>(null);
  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('');
  const debouncedSubmissionSearchQuery = useDebounce(submissionSearchQuery, 300);
  const submissionSearchInputRef = useRef<HTMLInputElement>(null);

  // Pagination state (for the raw "Submission Analytics" table only)
  const [reportsPage, setReportsPage] = useState(0);
  const [reportsPageSize, setReportsPageSize] = useState(10);

  // Get time range dates
  const getTimeRangeDates = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    if (timeRange === 'today') {
      start = startOfDay(now);
    } else if (timeRange === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
    } else if (timeRange === 'month') {
      start = startOfMonth(now);
    } else {
      const [startHour, startMin] = customStartTime.split(':').map(Number);
      const [endHour, endMin] = customEndTime.split(':').map(Number);
      start = new Date(customStartDate);
      start.setHours(startHour, startMin, 0, 0);
      end = new Date(customEndDate);
      end.setHours(endHour, endMin, 59, 999);
    }

    return { start, end };
  }, [timeRange, customStartDate, customStartTime, customEndDate, customEndTime]);

  // Fetch the full set of interaction logs for the active time range (used for stats/charts)
  const fetchAllLogs = useCallback(async () => {
    try {
      const { start, end } = getTimeRangeDates();
      const params = new URLSearchParams();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const data = await fetchAllPages(csrfFetch, '/api/logs', params);
      setAllLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }, [csrfFetch, getTimeRangeDates]);

  // Fetch the full set of submissions for the active time range (used for stats/charts)
  const fetchAllReports = useCallback(async () => {
    try {
      const { start, end } = getTimeRangeDates();
      const params = new URLSearchParams();
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      const data = await fetchAllPages(csrfFetch, '/api/reports', params);
      setAllReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  }, [csrfFetch, getTimeRangeDates]);

  // Fetch reports with pagination and search
  const fetchReports = useCallback(async (page: number = 0, pageSize: number = reportsPageSize) => {
    try {
      const { start, end } = getTimeRangeDates();
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('startDate', start.toISOString());
      params.set('endDate', end.toISOString());
      if (debouncedSubmissionSearchQuery.trim()) {
        params.set('q', debouncedSubmissionSearchQuery.trim());
      }

      const res = await csrfFetch(`/api/reports?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({ data: [], meta: null }));
      setReports(Array.isArray(json?.data) ? json.data : []);
      setReportsMeta(json?.meta && typeof json.meta === 'object' ? json.meta : null);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  }, [csrfFetch, getTimeRangeDates, debouncedSubmissionSearchQuery, reportsPageSize]);

  // Fetch menus
  const fetchMenus = useCallback(async () => {
    try {
      const menuUrl = currentRole === 'admin'
        ? '/api/menus?includeInactive=1'
        : '/api/menus';
      const res = await csrfFetch(menuUrl, { cache: 'no-store' });
      const json = await res.json().catch(() => ({ data: [] }));
      setMenus(Array.isArray(json?.data) ? json.data : []);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  }, [csrfFetch, currentRole]);

  // Initial fetch
  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchAllLogs(),
        fetchAllReports(),
        fetchReports(0, reportsPageSize),
        fetchMenus()
      ]);
      setIsLoading(false);
    };
    loadAllData();
  }, []);

  // Refetch the full stats datasets when the time range changes
  useEffect(() => {
    fetchAllLogs();
    fetchAllReports();
  }, [timeRange, customStartDate, customStartTime, customEndDate, customEndTime, fetchAllLogs, fetchAllReports]);

  // Refetch the raw submissions table when the time range or its search changes
  useEffect(() => {
    setReportsPage(0);
    fetchReports(0, reportsPageSize);
  }, [debouncedSubmissionSearchQuery, timeRange, customStartDate, customStartTime, customEndDate, customEndTime, fetchReports]);

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);

    if (timeRange === 'today') {
      startDate = startOfDay(now);
    } else if (timeRange === 'week') {
      startDate = startOfWeek(now, { weekStartsOn: 1 });
    } else if (timeRange === 'month') {
      startDate = startOfMonth(now);
    } else {
      const [startHour, startMin] = customStartTime.split(':').map(Number);
      const [endHour, endMin] = customEndTime.split(':').map(Number);
      startDate = new Date(customStartDate);
      startDate.setHours(startHour, startMin, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(endHour, endMin, 59, 999);
    }

    const filteredLogs = allLogs.filter(log => {
      const d = new Date(log.timestamp);
      return d >= startDate && d <= endDate;
    });

    // Create Menu Lookup (Normalized for robustness)
    const menuLookup = new Map<string, MenuItem>();
    menus.forEach(m => {
      if (m.name) menuLookup.set(m.name.trim().toLowerCase(), m);
      if (m.id) menuLookup.set(m.id.toLowerCase(), m);
    });

    // Helper to check if a log is an interaction
    const isInteraction = (log: any) => {
      if (log.tags?.includes('session_start')) return false;
      if (log.tags?.includes('status_lookup')) return false;

      let type: string = 'unknown';
      const menuTag = log.tags?.find((t: string) =>
        !['session_start', 'kyc_start', 'api_call', 'report', 'api', 'navigation', 'static', 'error', 'status_lookup', 'redirect'].includes(t)
      );
      const normalizedTag = menuTag?.trim().toLowerCase();
      const menu = normalizedTag ? menuLookup.get(normalizedTag) : null;

      type = (menu?.responseType as any) || 'unknown';

      if (type === 'unknown' && log.tags) {
        if (log.tags.includes('api') || log.tags.includes('api_call')) type = 'api';
        else if (log.tags.includes('report')) type = 'report';
        else if (log.tags.includes('navigation') || log.tags.includes('static')) type = 'static';
        else if (log.tags.includes('redirect')) type = 'redirect';
      }

      return type !== 'unknown';
    };

    const filteredReports = allReports.filter(r => {
      const d = new Date(r.timestamp);
      return d >= startDate && d <= endDate;
    });

    // Calculate Visit Counts (All Visits & Unique Visits)
    let allVisits = 0;
    const uniqueVisitSessionIds = new Set<string>();
    filteredLogs.forEach(log => {
      if (log.tags && log.tags.includes('session_start')) {
        allVisits += 1;
        if (log.sessionId) uniqueVisitSessionIds.add(log.sessionId);
      }
    });

    // Hierarchical Grouping: Action Type -> Menu Name
    const activityTree: any = {
      static: { label: 'Static Menu', icon: Globe, color: 'text-blue-500', menus: new Map() },
      api: { label: 'API Menu', icon: Zap, color: 'text-amber-500', menus: new Map() },
      report: { label: 'Internal Support Menu', icon: ClipboardList, color: 'text-emerald-500', menus: new Map() },
      redirect: { label: 'Redirect Links', icon: MousePointerClick, color: 'text-purple-500', menus: new Map() }
    };

    let countedInteractions = 0;
    let countedSuccesses = 0;
    let countedFailures = 0;
    const countedUniqueUsers = new Set<string>();

    filteredLogs.forEach(log => {
      if (!isInteraction(log)) return;

      // Find menu name from tags
      const menuTag = log.tags?.find((t: string) =>
        !['session_start', 'kyc_start', 'api_call', 'report', 'api', 'navigation', 'static', 'error', 'status_lookup', 'redirect'].includes(t)
      );
      const normalizedTag = menuTag?.trim().toLowerCase();
      const menu = normalizedTag ? menuLookup.get(normalizedTag) : null;

      // Infer type
      let type: 'static' | 'api' | 'report' | 'redirect' | 'unknown' = (menu?.responseType as any) || 'unknown';

      if (type === 'unknown' && log.tags) {
        if (log.tags.includes('api') || log.tags.includes('api_call')) type = 'api';
        else if (log.tags.includes('report')) type = 'report';
        else if (log.tags.includes('navigation') || log.tags.includes('static')) type = 'static';
        else if (log.tags.includes('redirect')) type = 'redirect';
      }

      if (type === 'unknown') return;

      let name;
      if (type === 'redirect') {
        name = log.endpoint || 'External Link';
      } else {
        name = menuTag || 'General/Chat';
      }

      const targetGroup = activityTree[type as keyof typeof activityTree];
      if (!targetGroup) return;

      const menuStats = targetGroup.menus.get(name) || {
        name,
        interactions: 0,
        uniqueUsers: new Set(),
        errors: 0,
        latency: [],
        submissions: 0,
        pendingCount: 0,
        reviewedCount: 0,
        resolvedCount: 0
      };

      menuStats.interactions += 1;
      menuStats.uniqueUsers.add(log.sessionId);
      if (log.status === 'error' || log.status === 'failed') menuStats.errors += 1;
      if (log.responseTime) menuStats.latency.push(log.responseTime);

      targetGroup.menus.set(name, menuStats);

      countedInteractions += 1;
      countedUniqueUsers.add(log.sessionId);
      if (log.status === 'error' || log.status === 'failed') {
        countedFailures += 1;
      } else {
        countedSuccesses += 1;
      }
    });

    const totalInteractions = countedInteractions;
    const uniqueUsers = countedUniqueUsers.size;

    // Count submissions per menu
    filteredReports.forEach(r => {
      const normalizedName = r.menuName?.trim().toLowerCase();
      const normalizedId = r.menuId?.toLowerCase();
      const menu = (normalizedName ? menuLookup.get(normalizedName) : null) || (normalizedId ? menuLookup.get(normalizedId) : null);

      const type = menu?.responseType || 'report';
      const name = r.menuName;

      const targetGroup = activityTree[type as keyof typeof activityTree] || activityTree.report;
      const menuStats = targetGroup.menus.get(name) || {
        name,
        interactions: 0,
        uniqueUsers: new Set(),
        errors: 0,
        latency: [],
        submissions: 0,
        pendingCount: 0,
        reviewedCount: 0,
        resolvedCount: 0
      };

      menuStats.submissions += 1;
      if (r.userId) menuStats.uniqueUsers.add(r.userId);

      if (r.status === 'pending') menuStats.pendingCount += 1;
      if (r.status === 'reviewed') menuStats.reviewedCount += 1;
      if (r.status === 'resolved') menuStats.resolvedCount += 1;

      targetGroup.menus.set(name, menuStats);
    });

    // Flatten Tree for Display
    const flattenedActivity = Object.entries(activityTree).map(([key, group]: [string, any]) => {
      const groupMenus = Array.from(group.menus.values()).map((m: any) => ({
        ...m,
        uniqueUsers: m.uniqueUsers.size,
        avgLatency: m.latency.length > 0 ? m.latency.reduce((a: any, b: any) => a + b, 0) / m.latency.length : 0,
        successRate: m.interactions > 0 ? ((m.interactions - m.errors) / m.interactions) * 100 : 100,
        conversionRate: m.interactions > 0 ? (m.submissions / m.interactions) * 100 : 0
      })).sort((a, b) => b.interactions - a.interactions);

      return {
        type: key,
        ...group,
        menus: groupMenus,
        totalInteractions: groupMenus.reduce((a, b) => a + b.interactions, 0),
        totalSubmissions: groupMenus.reduce((a, b) => a + b.submissions, 0),
        totalPending: groupMenus.reduce((a, b) => a + (b.pendingCount || 0), 0),
        totalReviewed: groupMenus.reduce((a, b) => a + (b.reviewedCount || 0), 0),
        totalResolved: groupMenus.reduce((a, b) => a + (b.resolvedCount || 0), 0)
      };
    });

    // Daily volume chart data
    const dailyData: any[] = [];
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const step = Math.max(1, Math.ceil(diffDays / 30));

    for (let i = 0; i < diffDays; i += step) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = format(date, 'MMM dd');
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const dayLogs = filteredLogs.filter(l => {
        const d = new Date(l.timestamp);
        return d >= dayStart && d <= dayEnd;
      });

      dailyData.push({
        name: dateStr,
        interactions: dayLogs.filter(isInteraction).length,
        submissions: filteredReports.filter(r => {
          const d = new Date(r.timestamp);
          return d >= dayStart && d <= dayEnd;
        }).length
      });
    }

    return {
      totalInteractions,
      uniqueUsers,
      totalReports: filteredReports.length,
      successCount: countedSuccesses,
      failureCount: countedFailures,
      allVisits,
      uniqueVisits: uniqueVisitSessionIds.size,
      activityByType: flattenedActivity,
      dailyData,
      reports: filteredReports,
      statusStats: [
        { name: 'Pending', value: filteredReports.filter(r => r.status === 'pending').length, color: '#f59e0b' },
        { name: 'Reviewed', value: filteredReports.filter(r => r.status === 'reviewed').length, color: '#3b82f6' },
        { name: 'Resolved', value: filteredReports.filter(r => r.status === 'resolved').length, color: '#10b981' }
      ]
    };
  }, [allLogs, allReports, menus, timeRange, customStartDate, customStartTime, customEndDate, customEndTime]);

  // Filtered activity based on menu search query
  const filteredActivity = useMemo(() => {
    if (!debouncedMenuSearchQuery.trim()) {
      return stats.activityByType;
    }
    const query = debouncedMenuSearchQuery.toLowerCase().trim();
    return stats.activityByType.map(group => ({
      ...group,
      menus: group.menus.filter((m: any) =>
        m.name.toLowerCase().includes(query)
      )
    })).filter(group => group.menus.length > 0);
  }, [stats.activityByType, debouncedMenuSearchQuery]);

  // Filtered submissions based on search query (drives the on-screen, paginated table)
  const filteredSubmissions = useMemo(() => {
    if (!debouncedSubmissionSearchQuery.trim()) {
      return reports;
    }
    const query = debouncedSubmissionSearchQuery.toLowerCase().trim();
    return reports.filter(r =>
      r.id.toLowerCase().includes(query) ||
      (r.userId && r.userId.toLowerCase().includes(query)) ||
      (r.menuName && r.menuName.toLowerCase().includes(query)) ||
      (r.status && r.status.toLowerCase().includes(query)) ||
      (r.supportAssignee && r.supportAssignee.toLowerCase().includes(query)) ||
      (r.serviceFeedback && r.serviceFeedback.toLowerCase().includes(query))
    );
  }, [reports, debouncedSubmissionSearchQuery]);

  // Same filter applied to the full time-range dataset, so CSV export isn't limited to one page
  const filteredSubmissionsForExport = useMemo(() => {
    if (!debouncedSubmissionSearchQuery.trim()) {
      return allReports;
    }
    const query = debouncedSubmissionSearchQuery.toLowerCase().trim();
    return allReports.filter(r =>
      r.id.toLowerCase().includes(query) ||
      (r.userId && r.userId.toLowerCase().includes(query)) ||
      (r.menuName && r.menuName.toLowerCase().includes(query)) ||
      (r.status && r.status.toLowerCase().includes(query)) ||
      (r.supportAssignee && r.supportAssignee.toLowerCase().includes(query)) ||
      (r.serviceFeedback && r.serviceFeedback.toLowerCase().includes(query))
    );
  }, [allReports, debouncedSubmissionSearchQuery]);

  const handleExport = () => {
    let content = '';
    let filename = '';
    let reportName = '';
    const now = new Date();

    let timeRangeStr = '';
    if (timeRange === 'today') {
      timeRangeStr = `${format(now, 'yyyy-MM-dd')} 00:00 to ${format(endOfDay(now), 'yyyy-MM-dd HH:mm:ss')}`;
    } else if (timeRange === 'custom') {
      timeRangeStr = `${customStartDate} ${customStartTime} to ${customEndDate} ${customEndTime}`;
    } else {
      const start = timeRange === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
      timeRangeStr = `${format(start, 'yyyy-MM-dd HH:mm')} to ${format(endOfDay(now), 'yyyy-MM-dd HH:mm:ss')}`;
    }

    if (activeTab === 'activity') {
      reportName = 'Detail Report';
      const exportActivity = filteredActivity.filter(g => selectedActionType === 'all' || g.type === selectedActionType);
      content = generateMenuCSV(exportActivity, reportName, timeRangeStr);
      filename = `nibbot-detail-report-${selectedActionType}-${format(now, 'yyyyMMddHHmmss')}.csv`;
    } else if (activeTab === 'submissions') {
      reportName = 'Submission Analytics';
      content = generateSubmissionCSV(filteredSubmissionsForExport, reportName, timeRangeStr);
      filename = `nibbot-submission-report-${format(now, 'yyyyMMddHHmmss')}.csv`;
    } else {
      reportName = 'General Report';
      content = generateMenuCSV(stats.activityByType, reportName, timeRangeStr);
      filename = `nibbot-general-report-${format(now, 'yyyyMMddHHmmss')}.csv`;
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const generateMenuCSV = (activity: any[], reportName: string, timeRangeStr: string) => {
    let csv = '';
    csv += `"Nib International Bank","${reportName}","${timeRangeStr}"\n`;
    csv += '\n';
    csv += 'Level,Category/Menu,Total Interactions,Unique Users,Submissions,Pending,Reviewed,Resolved,Success Rate (%),Avg Latency (ms),Conversion (%)\n';

    activity.forEach(group => {
      csv += `Category,${group.label},${group.totalInteractions},-,${group.totalSubmissions || ''},${group.totalPending || ''},${group.totalReviewed || ''},${group.totalResolved || ''},-, -, -\n`;

      group.menus.forEach((m: any) => {
        const successRate = m.successRate !== undefined ? m.successRate.toFixed(2) : '';
        const avgLatency = m.avgLatency !== undefined && m.avgLatency !== null ? Math.round(m.avgLatency) : '';
        const conversionRate = m.conversionRate !== undefined ? m.conversionRate.toFixed(2) : '';

        csv += `Menu,"${m.name}",${m.interactions},${m.uniqueUsers},${m.submissions || ''},${m.pendingCount || ''},${m.reviewedCount || ''},${m.resolvedCount || ''},${successRate},${avgLatency},${conversionRate}\n`;
      });

      csv += '\n';
    });
    return csv;
  };

  const generateSubmissionCSV = (reports: any[], reportName: string, timeRangeStr: string) => {
    let csv = '';
    csv += `"Nib International Bank","${reportName}","${timeRangeStr}"\n`;
    csv += '\n';

    const allFieldKeys = new Set<string>();
    reports.forEach(r => {
      if (r.data && typeof r.data === 'object') {
        Object.keys(r.data).forEach(key => {
          if (key !== 'assignmentHistory') {
            allFieldKeys.add(key);
          }
        });
      }
    });
    const fieldKeysArray = Array.from(allFieldKeys);

    let headers = [
      'Report ID', 'Timestamp', 'Menu Name', 'User ID', 'Status', 'Priority',
      'Escalation Path', 'Resolved By', 'Rating', 'Feedback', 'Admin Response'
    ];
    headers = headers.concat(fieldKeysArray);
    csv += headers.map(h => `"${h}"`).join(',') + '\n';

    reports.forEach(r => {
      const rating = typeof r.serviceRating === 'number' ? r.serviceRating : 'N/A';
      const feedback = r.serviceFeedback ? `"${r.serviceFeedback.replace(/"/g, '""')}"` : '';
      const adminResponse = r.adminResponse ? `"${r.adminResponse.replace(/"/g, '""')}"` : '';
      const resolver = r.resolvedBy || (r.status === 'resolved' ? (r.supportAssignee || 'System') : '');

      let pathSteps: string[] = [];
      if (r.assignmentHistory && r.assignmentHistory.length > 0) {
        pathSteps = r.assignmentHistory.map((assn: any) => assn.assignee);
      } else if (r.supportAssignee) {
        pathSteps = [r.supportAssignee];
      } else {
        pathSteps = ['Unassigned'];
      }

      if (r.status === 'resolved' && resolver && !pathSteps.includes(resolver)) {
        pathSteps.push(resolver + ' (Resolved)');
      }

      const escalationPath = `"${pathSteps.join(' -> ')}"`;

      let row = [
        `"${r.id}"`,
        `"${format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${r.menuName}"`,
        `"${r.userId}"`,
        `"${r.status}"`,
        `"${r.priority || 'medium'}"`,
        escalationPath,
        `"${resolver}"`,
        `"${rating}"`,
        feedback,
        adminResponse
      ];

      fieldKeysArray.forEach(key => {
        if (key === 'assignmentHistory') return;
        const value = r.data?.[key];
        if (typeof value === 'string') {
          row.push(`"${value.replace(/"/g, '""')}"`);
        } else if (value !== undefined && value !== null) {
          row.push(`"${String(value)}"`);
        } else {
          row.push('');
        }
      });

      csv += row.join(',') + '\n';
    });

    return csv;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse font-black uppercase tracking-widest">Compiling Analytics Hierarchy...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-3xl border shadow-sm ring-1 ring-border/50">
        <div className="space-y-1">
          <h3 className="text-2xl font-black flex items-center gap-3 text-foreground tracking-tight">
            <FileText className="text-primary" size={28} />
            Professional Reporting
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1"><Clock size={10} /> Data-Driven Insights</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10} /> Live Status</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {(activeTab === 'activity' || activeTab === 'submissions') && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-10 rounded-2xl border-primary/20 hover:bg-primary/5 text-primary font-black uppercase text-[10px] px-6 shadow-sm">
              <Download size={14} className="mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {timeRange === 'custom' && (
        <Card className="p-4 bg-primary/5 border-primary/10 animate-in slide-in-from-top-2 duration-300 rounded-2xl flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground">From:</span>
            <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-9 w-40 text-xs bg-card rounded-xl" />
            <Input type="time" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} className="h-9 w-32 text-xs bg-card rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground">To:</span>
            <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-9 w-40 text-xs bg-card rounded-xl" />
            <Input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="h-9 w-32 text-xs bg-card rounded-xl" />
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/20 p-1.5 rounded-3xl border w-full max-w-[650px] shadow-inner">
          <TabsTrigger value="overview" className="flex-1 gap-2 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-xl py-2.5">
            <LayoutDashboard size={14} />
            <span className="text-[11px] font-black uppercase tracking-tight">General Report</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 gap-2 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-xl py-2.5">
            <Users size={14} />
            <span className="text-[11px] font-black uppercase tracking-tight">Detail Report</span>
          </TabsTrigger>
          <TabsTrigger value="submissions" className="flex-1 gap-2 rounded-2xl data-[state=active]:bg-card data-[state=active]:shadow-xl py-2.5">
            <ClipboardList size={14} />
            <span className="text-[11px] font-black uppercase tracking-tight">Submission Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 m-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Interactions', value: stats.totalInteractions, sub: 'Total system events', icon: Activity, color: 'border-t-primary' },
              { label: 'Unique Users', value: stats.uniqueUsers, sub: 'Individual sessions', icon: Users, color: 'border-t-blue-500' },
              { label: 'Submissions', value: stats.totalReports, sub: 'Completed KYC/Reports', icon: ClipboardList, color: 'border-t-emerald-500' }
            ].map((stat, i) => (
              <Card key={i} className={`bg-card shadow-sm border-t-4 ${stat.color} rounded-3xl overflow-hidden hover:shadow-lg transition-all group`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest group-hover:text-primary transition-colors">
                    <stat.icon size={12} />
                    {stat.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold opacity-70">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Successful', value: stats.successCount, sub: 'Successful interactions', icon: CheckCircle2, color: 'border-t-green-500' },
              { label: 'Failed', value: stats.failureCount, sub: 'Failed interactions', icon: XCircle, color: 'border-t-red-500' },
              { label: 'Success Rate', value: `${((stats.successCount || 0) / (stats.totalInteractions || 1) * 100).toFixed(1)}%`, sub: 'Optimal performance', icon: TrendingUp, color: 'border-t-amber-500' }
            ].map((stat, i) => (
              <Card key={i} className={`bg-card shadow-sm border-t-4 ${stat.color} rounded-3xl overflow-hidden hover:shadow-lg transition-all group`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest group-hover:text-primary transition-colors">
                    <stat.icon size={12} />
                    {stat.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold opacity-70">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'All Visits', value: stats.allVisits, sub: 'Total app opens', icon: DoorOpen, color: 'border-t-purple-500' },
              { label: 'Unique Visits', value: stats.uniqueVisits, sub: 'Distinct users/sessions', icon: UserCheck, color: 'border-t-indigo-500' }
            ].map((stat, i) => (
              <Card key={i} className={`bg-card shadow-sm border-t-4 ${stat.color} rounded-3xl overflow-hidden hover:shadow-lg transition-all group`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest group-hover:text-primary transition-colors">
                    <stat.icon size={12} />
                    {stat.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold opacity-70">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-xl rounded-3xl overflow-hidden border-none bg-card ring-1 ring-border/50">
              <CardHeader className="bg-muted/10 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp size={18} className="text-primary" />
                  Performance Dynamics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 h-80 px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailyData}>
                    <defs>
                      <linearGradient id="colorInter" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                    <RechartsTooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" name="Interactions" dataKey="interactions" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorInter)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 m-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setSelectedActionType('all')}
              className={`p-4 rounded-3xl border transition-all text-left flex items-center gap-4 ${selectedActionType === 'all' ? 'bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/20' : 'bg-card hover:bg-muted/30'}`}
            >
              <div className={`p-3 rounded-2xl ${selectedActionType === 'all' ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}><LayoutDashboard size={20} /></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Activity</span>
                <span className="text-xl font-black tracking-tighter">{stats.totalInteractions}</span>
              </div>
            </button>

            {stats.activityByType.map((group: any) => (
              <button
                key={group.type}
                onClick={() => setSelectedActionType(group.type)}
                className={`p-4 rounded-3xl border transition-all text-left flex flex-col gap-3 ${selectedActionType === group.type ? 'bg-card shadow-xl ring-4 ring-primary/20 border-primary' : 'bg-card hover:bg-muted/30 opacity-70'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl bg-muted/50 ${group.color}`}><group.icon size={20} /></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</span>
                    <span className="text-xl font-black tracking-tighter">{group.totalInteractions}</span>
                  </div>
                </div>

                {group.type === 'report' && (
                  <div className="flex gap-2 mt-1 border-t pt-3 border-muted/50">
                    <div className="flex-1 flex flex-col items-center p-1.5 rounded-xl bg-amber-50/50 border border-amber-100/50">
                      <span className="text-xs font-black text-amber-700">{group.totalPending}</span>
                      <span className="text-[7px] font-bold uppercase text-amber-600">Pending</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center p-1.5 rounded-xl bg-blue-50/50 border border-blue-100/50">
                      <span className="text-xs font-black text-blue-700">{group.totalReviewed}</span>
                      <span className="text-[7px] font-bold uppercase text-blue-600">Reviewed</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center p-1.5 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                      <span className="text-xs font-black text-emerald-700">{group.totalResolved}</span>
                      <span className="text-[7px] font-bold uppercase text-emerald-600">Resolved</span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-none bg-card ring-1 ring-border/50">
            <CardHeader className="bg-muted/10 border-b p-8 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black flex items-center gap-3 uppercase tracking-tight">
                  <MousePointerClick size={22} className="text-primary" />
                  Hierarchical Detail
                </CardTitle>
                <CardDescription className="text-[11px] font-bold text-muted-foreground">Analyzing property-specific metrics for each menu node.</CardDescription>
              </div>
              <SearchInput
                ref={menuSearchInputRef}
                value={menuSearchQuery}
                onChange={setMenuSearchQuery}
                placeholder="Search menu hierarchy..."
                className="h-10 text-xs w-80 rounded-2xl bg-muted/20 border-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[600px]">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 px-8">Specific Menu</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Volume</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Users</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status/Health</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-8">Deep Analytics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivity
                      .filter(g => selectedActionType === 'all' || g.type === selectedActionType)
                      .map((group: any) => (
                        <React.Fragment key={group.type}>
                          <TableRow className="bg-muted/5 hover:bg-muted/5 border-none">
                            <TableCell colSpan={5} className="py-2 px-8">
                              <div className="flex items-center gap-2">
                                <group.icon size={12} className={group.color} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">{group.label} Group</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {group.menus.map((m: any, idx: number) => (
                            <TableRow key={idx} className="group hover:bg-primary/5 transition-all border-muted/10 border-b">
                              <TableCell className="py-6 px-8">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors tracking-tight">{m.name}</span>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 opacity-50">Node Activity</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-[11px] font-black rounded-xl px-3 py-1 bg-muted/50 text-foreground ring-1 ring-border/50 shadow-sm">{m.interactions}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Users size={12} className="text-muted-foreground opacity-50" />
                                  <span className="text-xs font-black tracking-tighter">{m.uniqueUsers}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className={`text-[11px] font-black ${m.successRate > 95 ? 'text-emerald-600' : m.successRate > 80 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {m.successRate.toFixed(1)}%
                                  </span>
                                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden shadow-inner ring-1 ring-border/20">
                                    <div
                                      className={`h-full transition-all duration-1000 ${m.successRate > 95 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : m.successRate > 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                                      style={{ width: `${m.successRate}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-8">
                                {group.type === 'api' ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1 text-amber-600">
                                      <Clock size={12} />
                                      <span className="text-xs font-black tracking-tighter">{Math.round(m.avgLatency)}ms</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Avg Response</span>
                                  </div>
                                ) : group.type === 'report' ? (
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="flex gap-1.5">
                                      <div className="flex flex-col items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 min-w-[40px]">
                                        <span className="text-[10px] font-black text-amber-700 leading-none">{m.pendingCount}</span>
                                        <span className="text-[7px] font-bold uppercase text-amber-600">PND</span>
                                      </div>
                                      <div className="flex flex-col items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 min-w-[40px]">
                                        <span className="text-[10px] font-black text-blue-700 leading-none">{m.reviewedCount}</span>
                                        <span className="text-[7px] font-bold uppercase text-blue-600">REV</span>
                                      </div>
                                      <div className="flex flex-col items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 min-w-[40px]">
                                        <span className="text-[10px] font-black text-emerald-700 leading-none">{m.resolvedCount}</span>
                                        <span className="text-[7px] font-bold uppercase text-emerald-600">RES</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-emerald-600">
                                      <TrendingUp size={10} />
                                      <span className="text-[9px] font-black tracking-tighter uppercase">Conv: {m.conversionRate.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <Info size={12} />
                                      <span className="text-xs font-black tracking-tighter">Read Only</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Static Interaction</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6 m-0 outline-none">
          <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-none bg-card ring-1 ring-border/50">
            <CardHeader className="bg-muted/10 border-b p-8 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black flex items-center gap-3 uppercase tracking-tight">
                  <ClipboardList size={22} className="text-primary" />
                  Submission Depth Analytics
                </CardTitle>
                <CardDescription className="text-[11px] font-bold text-muted-foreground">Detailed view of internal support reports, assignments, and outcomes.</CardDescription>
              </div>
              <SearchInput
                ref={submissionSearchInputRef}
                value={submissionSearchQuery}
                onChange={setSubmissionSearchQuery}
                placeholder="Search submissions (ID, user, menu, status)..."
                className="h-10 text-xs w-80 rounded-2xl bg-muted/20 border-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[600px]">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow className="group hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 px-8">Submission Info</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Escalation Path</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">User Rating</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Data Preview</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Admin Response</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-8">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                            <ClipboardList size={48} />
                            <p className="italic text-sm">No submissions found in this time range.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubmissions.map((r, idx) => (
                        <TableRow key={idx} className="group hover:bg-primary/5 transition-all border-muted/10 border-b">
                          <TableCell className="py-6 px-8">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors tracking-tight">{r.menuName}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 opacity-50">#{r.id.split('_')[1] || r.id} • {format(new Date(r.timestamp), 'MMM dd, HH:mm')}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-2 min-w-[300px]">
                              {r.assignmentHistory && r.assignmentHistory.length > 0 ? (
                                <div className="flex flex-wrap items-center justify-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-muted-foreground/10 w-full">
                                  {r.assignmentHistory.map((assignment: any, index: number) => (
                                    <React.Fragment key={index}>
                                      <div className="flex flex-col items-center group/item relative">
                                        <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all ${assignment.type === 'escalation'
                                          ? 'bg-red-50 text-red-700 border-red-100 shadow-[0_2px_4px_rgba(239,68,68,0.1)]'
                                          : 'bg-blue-50 text-blue-700 border-blue-100'
                                          }`}>
                                          {assignment.assignee}
                                        </div>
                                        {assignment.type === 'escalation' && assignment.reason && (
                                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[8px] px-2 py-1 rounded shadow-lg border opacity-0 group-hover/item:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                                            {assignment.reason}
                                          </div>
                                        )}
                                      </div>

                                      <span className="text-muted-foreground/40 font-black text-xs">→</span>
                                    </React.Fragment>
                                  ))}

                                  {r.status === 'resolved' ? (
                                    <div className="flex flex-col items-center">
                                      <div className="px-2.5 py-1 rounded-lg border bg-emerald-600 text-white border-emerald-700 text-[10px] font-black shadow-[0_4px_12px_rgba(16,185,129,0.2)] flex items-center gap-1.5">
                                        <CheckCircle2 size={10} />
                                        {r.resolvedBy || r.supportAssignee || 'System'}
                                      </div>
                                      <span className="text-[7px] font-black uppercase text-emerald-600 mt-0.5 tracking-widest">Resolved</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <div className="px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black animate-pulse">
                                        {r.status.toUpperCase()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-muted-foreground/10 w-full">
                                  {r.supportAssignee ? (
                                    <>
                                      <div className="px-2.5 py-1 rounded-lg border bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-black">
                                        {r.supportAssignee}
                                      </div>
                                      <span className="text-muted-foreground/40 font-black text-xs">→</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-black italic">
                                        Unassigned
                                      </div>
                                      <span className="text-muted-foreground/40 font-black text-xs">→</span>
                                    </>
                                  )}

                                  {r.status === 'resolved' ? (
                                    <div className="flex flex-col items-center">
                                      <div className="px-2.5 py-1 rounded-lg border bg-emerald-600 text-white border-emerald-700 text-[10px] font-black flex items-center gap-1.5">
                                        <CheckCircle2 size={10} />
                                        {r.resolvedBy || r.supportAssignee || 'System'}
                                      </div>
                                      <span className="text-[7px] font-black uppercase text-emerald-600 mt-0.5 tracking-widest">Resolved</span>
                                    </div>
                                  ) : (
                                    <div className="px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black animate-pulse uppercase">
                                      {r.status}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {typeof r.serviceRating === 'number' ? (
                              <div className="flex items-center justify-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} size={12} className={i < r.serviceRating! ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-bold uppercase opacity-30">Not Rated</span>
                            )}
                          </TableCell>
                          <TableCell className="px-2">
                            <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                              {r.data && Object.entries(r.data)
                                .filter(([key]) => key !== 'assignmentHistory')
                                .slice(0, 4)
                                .map(([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-[9px] font-bold truncate bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                                    {key}: {String(value).length > 15 ? String(value).substring(0, 15) + '...' : String(value)}
                                  </Badge>
                                ))}
                              {(() => {
                                const filteredKeys = r.data ? Object.keys(r.data).filter(k => k !== 'assignmentHistory') : [];
                                return filteredKeys.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground font-bold">+{filteredKeys.length - 4} more</span>
                                );
                              })()}
                              {(() => {
                                const filteredKeys = r.data ? Object.keys(r.data).filter(k => k !== 'assignmentHistory') : [];
                                return (!r.data || filteredKeys.length === 0) && (
                                  <span className="text-[9px] text-muted-foreground/30 font-bold uppercase">No Data</span>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="px-2">
                            <div className="max-w-[200px]">
                              <p className="text-[11px] font-medium text-foreground line-clamp-2 italic">
                                {r.adminResponse ? `"${r.adminResponse}"` : <span className="text-muted-foreground opacity-30 uppercase font-bold text-[10px]">No Response</span>}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-8">
                            <div className="max-w-[200px] ml-auto">
                              <p className="text-[11px] font-medium text-foreground line-clamp-2 italic">
                                {r.serviceFeedback ? `"${r.serviceFeedback}"` : <span className="text-muted-foreground opacity-30 uppercase font-bold text-[10px]">No Feedback</span>}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {reportsMeta && (
                <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                  <Pagination
                    currentPage={reportsPage}
                    pageSize={reportsPageSize}
                    totalItems={reportsMeta.total}
                    onPageChange={(page) => {
                      setReportsPage(page);
                      fetchReports(page, reportsPageSize);
                    }}
                    onPageSizeChange={(size) => {
                      setReportsPageSize(size);
                      setReportsPage(0);
                      fetchReports(0, size);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
