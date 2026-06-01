'use client';

import React, { useMemo, ReactNode } from 'react';
import { initializeFirebase, FirebaseProvider } from './index';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const init = useMemo(() => initializeFirebase(), []);
  // If Firebase is not configured (placeholder values), skip initializing
  // and render children directly. This prevents the client from attempting
  // to contact non-existent Firebase hosts (which can trigger CSP/frame errors).
  if (!init.app) return <>{children}</>;

  return (
    <FirebaseProvider app={init.app as any} firestore={init.firestore as any} auth={init.auth as any}>
      {children}
    </FirebaseProvider>
  );
}
