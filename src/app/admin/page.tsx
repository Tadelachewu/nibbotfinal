
import { getValidatedAdminSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { AdminPageClient } from '@/components/admin/AdminPageClient';

export default async function AdminPage() {
  const session = await getValidatedAdminSession();

  if (!session?.username) {
    // If no admin session, redirect to the public login page
    redirect('/admin/login');
  }

  const admin = await prisma.adminCredential.findUnique({
    where: { username: session.username },
    select: { role: true }
  });

  // Strict RBAC: only admin, checker, or support can access
  if (!admin || !['admin', 'checker', 'support'].includes(admin.role)) {
    // For unauthorized users (e.g. member-level or invalid session), 
    // return 404 to hide the admin panel's existence as requested.
    notFound();
  }

  return <AdminPageClient />;
}
