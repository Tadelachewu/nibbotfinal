'use client';

import Link from 'next/link';
import { LayoutDashboard, MessageSquare } from 'lucide-react';

export function AdminHeader() {
  return (
    <header className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
          <LayoutDashboard size={18} />
        </div>
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
