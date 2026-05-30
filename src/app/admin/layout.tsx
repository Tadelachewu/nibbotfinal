'use client';

import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
