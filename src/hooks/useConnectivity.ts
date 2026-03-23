'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type ConnectivityStatus = 'online' | 'offline' | 'checking';

// External probe target — a tiny, reliable, globally cached asset.
// Using no-cors: the response body is opaque (unreadable), but a
// NETWORK ERROR is thrown when there's no internet. That's the real signal.
const EXTERNAL_PROBE_URL = 'https://www.google.com/favicon.ico';
const POLL_INTERVAL_MS = 5000;

/**
 * useConnectivity
 *
 * Three-layer real internet detection (NOT local server health):
 * 1. Browser `online` / `offline` events  → instant signal.
 * 2. External fetch probe (Google favicon) → confirms actual internet.
 * 3. Periodic polling every 5 s           → catches silent drops.
 *
 * Key: probes an EXTERNAL host with mode:'no-cors'.
 * If the network is unavailable, fetch throws a TypeError (network error).
 * If internet exists, fetch resolves (even with an opaque response).
 */
export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>('checking');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  // ─── Core probe: hits an external server ─────────────────────────────────
  const probe = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      await fetch(`${EXTERNAL_PROBE_URL}?_=${Date.now()}`, {
        method: 'HEAD',
        // no-cors: browser won't block the request due to CORS,
        // but will throw a TypeError if there's truly no network.
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      // Any response (even opaque) means we reached the internet ✓
      if (isMounted.current) setStatus('online');
    } catch {
      // Network error = no internet ✗
      if (isMounted.current) setStatus('offline');
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(probe, POLL_INTERVAL_MS);
  }, [probe]);

  // Browser online event → optimistic 'checking', then verify with actual probe
  const handleOnline = useCallback(() => {
    setStatus('checking');
    probe();
  }, [probe]);

  // Browser offline event → instant offline, no fetch needed
  const handleOffline = useCallback(() => {
    setStatus('offline');
  }, []);

  useEffect(() => {
    isMounted.current = true;
    probe();          // immediate check on mount
    startPolling();   // background 5s loop
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      isMounted.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [probe, startPolling, handleOnline, handleOffline]);

  return status;
}
