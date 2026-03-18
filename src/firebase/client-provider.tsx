'use client';

import React, { useMemo, ReactNode } from 'react';
import { initializeFirebase, FirebaseProvider } from './index';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const { app, firestore, auth } = useMemo(() => initializeFirebase(), []);
  return (
    <FirebaseProvider app={app} firestore={firestore} auth={auth}>
      {children}
    </FirebaseProvider>
  );
}
