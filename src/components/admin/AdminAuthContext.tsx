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

// ─── Simple hash (not cryptographic, but good for client-side demo) ──
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  // Convert to a hex-like string and salt it
  return 'nib_' + Math.abs(hash).toString(36) + '_' + str.length.toString(36);
}

// ─── Auth Context ───────────────────────────────────────────────────
interface AdminAuthContextType {
  isAuthenticated: boolean;
  currentUsername: string;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  changeCredentials: (currentPassword: string, newUsername: string, newPassword: string) => { success: boolean; error?: string };
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const STORAGE_KEY = 'nib_admin_credentials';
const SESSION_KEY = 'nib_admin_session';

interface StoredCredentials {
  usernameHash: string;
  passwordHash: string;
  username: string; // stored in plain for display
}

function getDefaultCredentials(): { username: string; password: string } {
  return {
    username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin',
    password: process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Admin@1234',
  };
}

function getStoredCredentials(): StoredCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function storeCredentials(username: string, password: string) {
  const creds: StoredCredentials = {
    usernameHash: simpleHash(username),
    passwordHash: simpleHash(password),
    username,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

function validateCredentials(username: string, password: string): boolean {
  const stored = getStoredCredentials();
  if (stored) {
    return stored.usernameHash === simpleHash(username) && stored.passwordHash === simpleHash(password);
  }
  // Fall back to default env credentials
  const defaults = getDefaultCredentials();
  return username === defaults.username && password === defaults.password;
}

// ─── Provider ───────────────────────────────────────────────────────
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === 'active') {
      const stored = getStoredCredentials();
      setIsAuthenticated(true);
      setCurrentUsername(stored?.username || getDefaultCredentials().username);
    }
    setHydrated(true);
  }, []);

  const login = useCallback((username: string, password: string) => {
    if (!username.trim() || !password.trim()) {
      return { success: false, error: 'Username and password are required.' };
    }
    if (validateCredentials(username, password)) {
      setIsAuthenticated(true);
      setCurrentUsername(username);
      sessionStorage.setItem(SESSION_KEY, 'active');
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password.' };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUsername('');
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const changeCredentials = useCallback((currentPassword: string, newUsername: string, newPassword: string) => {
    // Verify current password
    const stored = getStoredCredentials();
    const currentUser = stored?.username || getDefaultCredentials().username;

    if (!validateCredentials(currentUser, currentPassword)) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    if (!newUsername.trim()) {
      return { success: false, error: 'Username cannot be empty.' };
    }

    if (!isStrongPassword(newPassword)) {
      return { success: false, error: 'New password does not meet strength requirements.' };
    }

    storeCredentials(newUsername.trim(), newPassword);
    setCurrentUsername(newUsername.trim());
    return { success: true };
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
