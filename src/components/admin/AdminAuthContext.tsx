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
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changeCredentials: (currentPassword: string, newUsername: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (json?.isAuthenticated) {
          setIsAuthenticated(true);
          setCurrentUsername(typeof json.username === 'string' ? json.username : '');
        } else {
          setIsAuthenticated(false);
          setCurrentUsername('');
        }
      } catch {
        if (!active) return;
        setIsAuthenticated(false);
        setCurrentUsername('');
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
    });

    const json = await response.json().catch(() => null);

    if (response.ok && json?.success) {
      setIsAuthenticated(true);
      setCurrentUsername(typeof json.username === 'string' ? json.username : trimmedUsername);
      return { success: true };
    }

    return { success: false, error: json?.error || 'Invalid username or password.' };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setCurrentUsername('');
  }, []);

  const changeCredentials = useCallback(async (currentPassword: string, newUsername: string, newPassword: string) => {
    const trimmedNewUsername = newUsername.trim();
    if (!trimmedNewUsername) {
      return { success: false, error: 'Username cannot be empty.' };
    }

    if (!isStrongPassword(newPassword)) {
      return { success: false, error: 'New password does not meet strength requirements.' };
    }

    const response = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newUsername: trimmedNewUsername,
        newPassword,
      }),
    });

    const json = await response.json().catch(() => null);
    if (response.ok && json?.success) {
      setCurrentUsername(typeof json.username === 'string' ? json.username : trimmedNewUsername);
      return { success: true };
    }
    return { success: false, error: json?.error || 'Failed to change credentials.' };
  }, []);

  // Don't render children until hydrated to avoid flash
  if (!hydrated) {
    return null;
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, currentUsername, login, logout, changeCredentials }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
