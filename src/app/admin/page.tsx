
'use client';

import { AdminHeader } from '@/components/admin/AdminHeader';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { ReportsManagement } from '@/components/admin/ReportsManagement';
import { Dashboard } from '@/components/admin/Dashboard';
import { Toaster } from '@/components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTree, ClipboardList, LayoutDashboard } from 'lucide-react';

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
            <TabsList className="grid grid-cols-3 w-full md:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard size={16} />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="menus" className="flex items-center gap-2">
                <ListTree size={16} />
                Menus
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <ClipboardList size={16} />
                Submissions
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
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}
