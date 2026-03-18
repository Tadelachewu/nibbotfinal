
'use client';

import { AdminHeader } from '@/components/admin/AdminHeader';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { ReportsManagement } from '@/components/admin/ReportsManagement';
import { Toaster } from '@/components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTree, ClipboardList } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Tabs defaultValue="menus" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">System Console</h2>
              <p className="text-muted-foreground">Manage your menus and view user submissions.</p>
            </div>
            <TabsList>
              <TabsTrigger value="menus" className="flex items-center gap-2">
                <ListTree size={16} />
                Menus
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <ClipboardList size={16} />
                User Submissions
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="menus" className="m-0">
            <MenuManagement />
          </TabsContent>

          <TabsContent value="reports" className="m-0">
            <ReportsManagement />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}
