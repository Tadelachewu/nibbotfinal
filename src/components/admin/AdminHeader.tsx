
'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function AdminHeader() {
  return (
    <header className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Logo className="w-8 h-8" />
        <h1 className="text-xl font-bold text-foreground">TalkTree Admin</h1>
      </div>
      <nav className="flex items-center gap-4">
        <Link 
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare size={16} />
          View User Interface
        </Link>
      </nav>
    </header>
  );
}
