
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function AdminHeader() {
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <header className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 overflow-hidden rounded-lg">
          <Image 
            src={logo?.imageUrl || 'https://picsum.photos/seed/logo/100/100'} 
            alt="TalkTree Logo"
            fill
            className="object-cover"
            data-ai-hint={logo?.imageHint || 'logo'}
          />
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
