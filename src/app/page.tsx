'use client';

import { ChatInterface } from '@/components/user/ChatInterface';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ChatInterface />
      
      <div className="fixed bottom-4 left-4 z-20">
        <Link 
          href="/admin" 
          className="w-10 h-10 bg-white shadow-lg border rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:scale-110 transition-all"
          title="Admin Panel"
        >
          <Settings size={20} />
        </Link>
      </div>
    </div>
  );
}
