
'use client';

import Link from 'next/link';
import { MessageSquare, LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useAdminAuth } from './AdminAuthContext';
import { AdminChangePassword } from './AdminChangePassword';

export function AdminHeader() {
  const { logout, currentUsername } = useAdminAuth();

  return (
    <header className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-50 h-16">
      <div className="flex items-center gap-3">
        <Logo className="w-8 h-8" />
        <h1 className="text-lg font-extrabold text-[#763717] hidden sm:block">Nib International Bank Admin</h1>
        <h1 className="text-lg font-extrabold text-[#763717] sm:hidden">Nib Admin</h1>
      </div>
      <nav className="flex items-center gap-4">
        <ThemeToggle />
        <span className="text-xs text-muted-foreground hidden md:inline-block">
          Signed in as <strong className="text-foreground">{currentUsername}</strong>
        </span>
        <Link
          href="/?adminPreview=1"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare size={16} />
          <span className="hidden sm:inline">Preview User Interface</span>
        </Link>
        <AdminChangePassword />
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </nav>
    </header>
  );
}
