'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

// Return type is intentionally permissive to allow callers to handle the
// "placeholder config" case (e.g. CI or local environments without Firebase).
export function initializeFirebase(): { app: FirebaseApp | null; firestore: Firestore | null; auth: Auth | null } {
  // Detect the placeholder values injected at build time and avoid initializing
  // the Firebase SDK when they are present. Initializing with placeholders
  // causes network/frame attempts (e.g. to "AI_WILL_REPLACE") which violates
  // CSP and produces console errors in the browser.
  const isPlaceholder = typeof firebaseConfig?.apiKey === 'string' && firebaseConfig.apiKey.includes('AI_WILL_REPLACE');
  if (isPlaceholder) {
    return { app: null, firestore: null, auth: null };
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  return { app, firestore, auth };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './errors';
export * from './error-emitter';
