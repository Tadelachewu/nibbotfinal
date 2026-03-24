
'use client';

import { AdminHeader } from '@/components/admin/AdminHeader';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { ReportsManagement } from '@/components/admin/ReportsManagement';
import { Dashboard } from '@/components/admin/Dashboard';
import { Toaster } from '@/components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTree, ClipboardList, LayoutDashboard, Globe, Activity } from 'lucide-react';
import { LocalizationManagement } from '@/components/admin/LocalizationManagement';
import { LogViewer } from '@/components/admin/LogViewer';

export default function AdminPage() {
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
            <TabsList className="grid grid-cols-5 w-full md:w-[750px] bg-muted/20 p-1 border shadow-sm">
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
              <TabsTrigger value="localization" className="flex items-center gap-2 text-xs md:text-sm">
                <Globe size={14} />
                Localization
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 text-xs md:text-sm">
                <Activity size={14} />
                Logs
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

          <TabsContent value="localization" className="m-0 border-none p-0 outline-none">
            <LocalizationManagement />
          </TabsContent>

          <TabsContent value="logs" className="m-0 border-none p-0 outline-none">
            <LogViewer />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}
