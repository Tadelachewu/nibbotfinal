'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Password Strength Utilities ────────────────────────────────────
export interface PasswordStrength {
  score: number;       // 0-4
  label: string;       // "Weak" | "Fair" | "Good" | "Strong"
  color: string;       // Tailwind color class
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed <= 1) return { score: 0, label: 'Very Weak', color: 'bg-red-500', checks };
  if (passed === 2) return { score: 1, label: 'Weak', color: 'bg-orange-500', checks };
  if (passed === 3) return { score: 2, label: 'Fair', color: 'bg-yellow-500', checks };
  if (passed === 4) return { score: 3, label: 'Good', color: 'bg-blue-500', checks };
  return { score: 4, label: 'Strong', color: 'bg-green-500', checks };
}

export function isStrongPassword(password: string): boolean {
  const { checks } = evaluatePasswordStrength(password);
  return Object.values(checks).every(Boolean);
}



// ─── Context ────────────────────────────────────────────────────────
interface AdminAuthContextType {
  isAuthenticated: boolean;
  currentUsername: string;
  currentEmail: string;
  currentRole: 'admin' | 'checker' | 'support' | '';
  mustChangePassword: boolean;
  csrfFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changeCredentials: (currentPassword: string, newUsername: string, newPassword: string, newEmail?: string) => Promise<{ success: boolean; error?: string }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentRole, setCurrentRole] = useState<'admin' | 'checker' | 'support' | ''>('');
  const [csrfToken, setCsrfToken] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const csrfFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      const needsToken = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      // Always include credentials so cookies are sent/received on cross-site requests
      if (!needsToken || !csrfToken) {
        const res = await fetch(input, { ...init, credentials: 'include' });
        if (res.status === 401) {
          setIsAuthenticated(false);
          setCurrentUsername('');
          setCurrentRole('');
          setCsrfToken('');
          setMustChangePassword(false);
          if (typeof window !== 'undefined') {
            const path = window.location.pathname || '';
            if (path.startsWith('/admin') && path !== '/login') window.location.href = '/login';
          }
        }
        return res;
      }

      const headers = new Headers(init?.headers || {});
      headers.set('x-csrf-token', csrfToken);
      const res = await fetch(input, { ...init, headers, credentials: 'include' });
      const nextToken = res.headers.get('x-csrf-token');
      if (typeof nextToken === 'string' && nextToken) {
        setCsrfToken(nextToken);
      }
      if (res.status === 401) {
        setIsAuthenticated(false);
        setCurrentUsername('');
        setCurrentRole('');
        setCsrfToken('');
        setMustChangePassword(false);
        if (typeof window !== 'undefined') {
          const path = window.location.pathname || '';
          if (path.startsWith('/admin') && path !== '/login') window.location.href = '/login';
        }
      }
      return res;
    },
    [csrfToken]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { cache: 'no-store', credentials: 'include' });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (json?.isAuthenticated) {
          setIsAuthenticated(true);
          setCurrentUsername(typeof json.username === 'string' ? json.username : '');
          setCurrentEmail(typeof json.email === 'string' ? json.email : '');
          setCurrentRole(json?.role === 'checker' || json?.role === 'admin' || json?.role === 'support' ? json.role : '');
          setCsrfToken(typeof json.csrfToken === 'string' ? json.csrfToken : '');
          setMustChangePassword(json?.mustChangePassword === true);
        } else {
          setIsAuthenticated(false);
          setCurrentUsername('');
          setCurrentEmail('');
          setCurrentRole('');
          setCsrfToken('');
          setMustChangePassword(false);
        }
      } catch {
        if (!active) return;
        setIsAuthenticated(false);
        setCurrentUsername('');
        setCurrentEmail('');
        setCurrentRole('');
        setCsrfToken('');
        setMustChangePassword(false);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);



  const login = useCallback(async (username: string, password: string) => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      return { success: false, error: 'Username and password are required.' };
    }

    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
    });

    const json = await response.json().catch(() => null);

    if (response.ok && json?.success) {
      setIsAuthenticated(true);
      setCurrentUsername(typeof json.username === 'string' ? json.username : trimmedUsername);
      setCurrentRole(json?.role === 'checker' || json?.role === 'admin' || json?.role === 'support' ? json.role : '');
      setCsrfToken(typeof json.csrfToken === 'string' ? json.csrfToken : '');
      const flagMustChange = json?.mustChangePassword === true;
      setMustChangePassword(flagMustChange);
      
      // Redirect to change-password page if the flag is set
      if (flagMustChange && typeof window !== 'undefined') {
        window.location.href = '/admin/change-password';
      }
      
      return { success: true };
    }

    return { success: false, error: json?.error || 'Invalid username or password.' };
  }, []);

  const logout = useCallback(async () => {
    await csrfFetch('/api/admin/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setCurrentUsername('');
    setCurrentEmail('');
    setCurrentRole('');
    setCsrfToken('');
    setMustChangePassword(false);
  }, [csrfFetch]);

  const changeCredentials = useCallback(async (currentPassword: string, newUsername: string, newPassword: string, newEmail?: string) => {
    const trimmedNewUsername = newUsername.trim();
    if (!trimmedNewUsername) {
      return { success: false, error: 'Username cannot be empty.' };
    }

    if (!isStrongPassword(newPassword)) {
      return { success: false, error: 'New password does not meet strength requirements.' };
    }

    const response = await csrfFetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newUsername: trimmedNewUsername,
        newPassword,
        email: typeof newEmail === 'string' ? newEmail.trim() : undefined,
      }),
    });

    const json = await response.json().catch(() => null);
    if (response.ok && json?.success) {
      setCurrentUsername(typeof json.username === 'string' ? json.username : trimmedNewUsername);
      if (typeof newEmail === 'string' && newEmail.trim()) setCurrentEmail(newEmail.trim());
      return { success: true };
    }
    return { success: false, error: json?.error || 'Failed to change credentials.' };
  }, [csrfFetch]);

  // Don't render children until hydrated to avoid flash
  if (!hydrated) {
    return null;
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, currentUsername, currentEmail, currentRole, mustChangePassword, csrfFetch, login, logout, changeCredentials }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
