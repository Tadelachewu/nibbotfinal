'use client';

import { AdminHeader } from '@/components/admin/AdminHeader';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { Toaster } from '@/components/ui/toaster';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Content Management</h2>
          <p className="text-muted-foreground">Build and organize your conversational menu structure here.</p>
        </div>
        <MenuManagement />
      </main>
      <Toaster />
    </div>
  );
}
