'use client';

import { ChatInterface } from '@/components/user/ChatInterface';

export default function HomePage() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <ChatInterface />
    </div>
  );
}
