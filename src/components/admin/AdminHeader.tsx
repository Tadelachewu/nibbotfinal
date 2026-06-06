
'use client';

import Link from 'next/link';
import { MessageSquare, LogOut, HelpCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useAdminAuth } from './AdminAuthContext';
import { AdminChangePassword } from './AdminChangePassword';

import { useState, useEffect } from 'react';

export function AdminHeader() {
  const { logout, currentUsername } = useAdminAuth();
  const [logo, setLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('/api/app-settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (json?.data?.appLogo) setLogo(json.data.appLogo);
      })
      .catch(() => { });
  }, []);

  return (
    <header className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-50 h-16">
      <div className="flex items-center gap-3">
        <Logo className="w-8 h-8" src={logo} />
        <h1 className="text-lg font-extrabold text-[#763717] hidden sm:block">Nib InternationalBank Admin</h1>
        <h1 className="text-lg font-extrabold text-[#763717] sm:hidden">Nib Admin</h1>
      </div>
      <nav className="flex items-center gap-4">
        <ThemeToggle cookieName="nib_admin_theme" />
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
        <Link
          href="/admin/help"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <HelpCircle size={16} />
          <span className="hidden sm:inline">Help</span>
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
