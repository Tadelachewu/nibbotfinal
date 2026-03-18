'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { toast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error: any) => {
      console.error('Firebase Permission Error:', error);
      toast({
        variant: 'destructive',
        title: 'Security Access Denied',
        description: 'You do not have permission to perform this action. Check Firestore security rules.',
      });
      // In development, we throw the error to trigger the Next.js error overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}
