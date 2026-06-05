'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { isAuthenticated, currentUsername, currentEmail, changeCredentials, mustChangePassword } = useAdminAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState<string | undefined>(undefined);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    setNewUsername(currentUsername);
  }, [currentUsername]);

  useEffect(() => {
    setNewEmail(currentEmail);
  }, [currentEmail]);

  // Load logo
  React.useEffect(() => {
    fetch('/api/app-settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (json?.data?.appLogo) setLogo(json.data.appLogo);
      })
      .catch(() => { });
  }, []);

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must contain an uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must contain a lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must contain a number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain a special character');
    return { valid: errors.length === 0, errors };
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword || !newUsername) {
      setError('All fields are required.');
      return;
    }

    const emailTrimmed = newEmail.trim();
    if (mustChangePassword && !emailTrimmed) {
      setError('Email is required so you can use Forgot Password later.');
      return;
    }
    if (emailTrimmed && !validateEmail(emailTrimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError(`Password requirements: ${validation.errors.join(', ')}`);
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setIsLoading(true);
    const result = await changeCredentials(currentPassword, newUsername, newPassword, emailTrimmed || undefined);

    if (result.success) {
      toast({
        title: 'Password changed successfully',
        description: 'Your credentials have been updated. Redirecting to dashboard...',
      });
      // Redirect to admin dashboard after successful change
      setTimeout(() => router.replace('/admin'), 1500);
    } else {
      setError(result.error || 'Failed to change password.');
    }
    setIsLoading(false);
  };

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[hsl(45,93%,47%)] opacity-[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[hsl(45,93%,47%)] opacity-[0.03] rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border bg-card/80 backdrop-blur-sm shadow-2xl shadow-black/10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <Logo className="w-16 h-16" src={logo} />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Change Password
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              {mustChangePassword
                ? 'You must update your password to proceed'
                : 'Update your admin credentials'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {mustChangePassword && (
            <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-3 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>Required:</strong> Your account requires a password change before you can access the admin dashboard.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-3 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-muted-foreground text-sm font-medium">
                Current Password
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="pl-10 pr-10 h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Username */}
            <div className="space-y-2">
              <Label htmlFor="new-username" className="text-muted-foreground text-sm font-medium">
                Username
              </Label>
              <Input
                id="new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                className="h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="new-email" className="text-muted-foreground text-sm font-medium">
                Email {mustChangePassword ? '' : <span className="text-muted-foreground font-normal">(optional)</span>}
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                required={mustChangePassword}
              />
              {mustChangePassword ? (
                <p className="text-xs text-muted-foreground">
                  Use an email you can access. It is required for password recovery.
                </p>
              ) : null}
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-muted-foreground text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pl-10 pr-10 h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 8 characters, uppercase, lowercase, number, and special character required.
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-muted-foreground text-sm font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10 h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || !newUsername || (mustChangePassword && !newEmail.trim())}
              className="w-full h-11 bg-gradient-to-r from-[hsl(45,93%,47%)] to-[hsl(40,90%,45%)] hover:from-[hsl(45,93%,52%)] hover:to-[hsl(40,90%,50%)] text-[hsl(25,50%,10%)] font-semibold shadow-lg shadow-[hsl(45,93%,47%)]/20 transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[hsl(25,50%,10%)]/30 border-t-[hsl(25,50%,10%)] rounded-full animate-spin" />
                  Updating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  Update Password
                </span>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-[10px] text-[hsl(25,20%,35%)] pt-2">
            Secured credentials · Nib International Bank S.C.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
