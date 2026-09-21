'use client';

import { AdminHeader } from '@/components/admin/AdminHeader';
import { CheckerMenuReview, MenuManagement } from '@/components/admin/MenuManagement';
import { ReportsManagement } from '@/components/admin/ReportsManagement';
import { Dashboard } from '@/components/admin/Dashboard';
import { Toaster } from '@/components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListTree, ClipboardList, LayoutDashboard, Globe, Activity, Users, BarChart3, Brain, FlaskConical } from 'lucide-react';
import { LocalizationManagement } from '@/components/admin/LocalizationManagement';
import { LogViewer } from '@/components/admin/LogViewer';
import { Reporting } from '@/components/admin/Reporting';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminLoginPage } from '@/components/admin/AdminLoginPage';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { KBManagement } from '@/components/admin/KBManagement';
import { EvalManagement } from '@/components/admin/EvalManagement';

function CheckerConsole() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Checker Console</h2>
          <p className="text-muted-foreground">Review pending menus and approve or reject changes.</p>
        </div>
        <CheckerMenuReview />
      </main>
      <Toaster />
    </div>
  );
}

function SupportConsole() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Support Console</h2>
          <p className="text-muted-foreground">Respond to assigned submissions.</p>
        </div>
        <ReportsManagement />
      </main>
      <Toaster />
    </div>
  );
}

function AdminConsole() {
  const { isAuthenticated, currentRole } = useAdminAuth();
  const validRole = currentRole === 'admin' || currentRole === 'checker' || currentRole === 'support';

  if (!isAuthenticated || !validRole) {
    return <AdminLoginPage />;
  }

  if (currentRole === 'checker') {
    return <CheckerConsole />;
  }

  if (currentRole === 'support') {
    return <SupportConsole />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">System Console</h2>
              <p className="text-muted-foreground">Monitor performance and manage your conversational platform.</p>
            </div>
            <TabsList className="grid grid-cols-9 w-full md:w-[1350px] bg-muted/20 p-1 border shadow-sm">
              <TabsTrigger value="dashboard" className="flex items-center gap-2 text-xs md:text-sm">
                <LayoutDashboard size={14} />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="menus" className="flex items-center gap-2 text-xs md:text-sm">
                <ListTree size={14} />
                Menus
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2 text-xs md:text-sm">
                <ClipboardList size={14} />
                Submissions
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2 text-xs md:text-sm">
                <Users size={14} />
                Users
              </TabsTrigger>
              <TabsTrigger value="localization" className="flex items-center gap-2 text-xs md:text-sm">
                <Globe size={14} />
                Localization
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 text-xs md:text-sm">
                <Activity size={14} />
                Logs
              </TabsTrigger>
              <TabsTrigger value="reporting" className="flex items-center gap-2 text-xs md:text-sm">
                <BarChart3 size={14} />
                Reporting
              </TabsTrigger>
              <TabsTrigger value="kb" className="flex items-center gap-2 text-xs md:text-sm">
                <Brain size={14} />
                Knowledge Base
              </TabsTrigger>
              <TabsTrigger value="eval" className="flex items-center gap-2 text-xs md:text-sm">
                <FlaskConical size={14} />
                AI Evaluation
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="m-0 border-none p-0 outline-none">
            <Dashboard />
          </TabsContent>

          <TabsContent value="menus" className="m-0 border-none p-0 outline-none">
            <MenuManagement />
          </TabsContent>

          <TabsContent value="reports" className="m-0 border-none p-0 outline-none">
            <ReportsManagement />
          </TabsContent>

          <TabsContent value="users" className="m-0 border-none p-0 outline-none">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="localization" className="m-0 border-none p-0 outline-none">
            <LocalizationManagement />
          </TabsContent>

          <TabsContent value="logs" className="m-0 border-none p-0 outline-none">
            <LogViewer />
          </TabsContent>

          <TabsContent value="reporting" className="m-0 border-none p-0 outline-none">
            <Reporting />
          </TabsContent>

          <TabsContent value="kb" className="m-0 border-none p-0 outline-none">
            <KBManagement />
          </TabsContent>

          <TabsContent value="eval" className="m-0 border-none p-0 outline-none">
            <EvalManagement />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}

export function AdminPageClient() {
  return <AdminConsole />;
}
