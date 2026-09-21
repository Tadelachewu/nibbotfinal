// Shared RBAC check for the AI Evaluation admin routes. Matches the
// inline `AdminCredential.role` lookup pattern already used in
// src/app/admin/page.tsx and src/app/api/reports/ratings/route.ts —
// pulled into one helper here only because ~8 eval routes need the exact
// same check (run execution / dataset editing / gate & judge config are
// admin-only; checker/support get read-only access elsewhere).
import prisma from '@/lib/prisma';

export async function isEvalAdmin(username: string): Promise<boolean> {
  const admin = await prisma.adminCredential.findUnique({
    where: { username },
    select: { role: true },
  });
  return admin?.role === 'admin';
}
