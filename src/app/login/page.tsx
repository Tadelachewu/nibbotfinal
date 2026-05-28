'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminLoginPage } from '@/components/admin/AdminLoginPage';

function AdminLoginInner() {
  const router = useRouter();
  const { isAuthenticated, currentRole } = useAdminAuth();
  const validRole = currentRole === 'admin' || currentRole === 'checker' || currentRole === 'support';

  useEffect(() => {
    if (isAuthenticated && validRole) {
      router.replace('/admin');
    }
  }, [isAuthenticated, validRole, router]);

  if (isAuthenticated && validRole) return null;
  return <AdminLoginPage />;
}

export default function AdminLoginRoute() {
  return (
    <AdminAuthProvider>
      <AdminLoginInner />
    </AdminAuthProvider>
  );
}
