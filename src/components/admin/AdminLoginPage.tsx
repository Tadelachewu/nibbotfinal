'use client';

import React, { useState } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  // Reveal username removed - not required for production
  const [resetOpen, setResetOpen] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [logo, setLogo] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    fetch('/api/app-settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (json?.data?.appLogo) setLogo(json.data.appLogo);
      })
      .catch(() => { });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Small delay for UX feedback
    await new Promise(r => setTimeout(r, 400));

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error || 'Login failed.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[hsl(45,93%,47%)] opacity-[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[hsl(45,93%,47%)] opacity-[0.03] rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border bg-card/80 backdrop-blur-sm shadow-2xl shadow-black/10">
        <CardHeader className="text-center space-y-6 pb-4">
          <div className="flex justify-center">
            <Logo className="h-20 w-40 sm:w-64 drop-shadow-2xl filter brightness-110" src={logo} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black text-[#763717] tracking-tight">
              Nib International Bank
            </CardTitle>
            <CardDescription className="text-muted-foreground font-medium uppercase tracking-widest text-[10px] opacity-80">
              Secure Administration Portal
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-muted-foreground text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="pl-10 h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-muted-foreground text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 h-11 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full h-11 bg-gradient-to-r from-[hsl(45,93%,47%)] to-[hsl(40,90%,45%)] hover:from-[hsl(45,93%,52%)] hover:to-[hsl(40,90%,50%)] text-[hsl(25,50%,10%)] font-semibold shadow-lg shadow-[hsl(45,93%,47%)]/20 transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[hsl(25,50%,10%)]/30 border-t-[hsl(25,50%,10%)] rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck size={16} />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <div className="flex items-center justify-start mt-2">
            <button className="text-sm text-muted-foreground hover:text-primary" onClick={() => setForgotOpen(true)}>
              Forgot password?
            </button>
          </div>

          {/* Forgot Password Dialog */}
          <Dialog open={forgotOpen} onOpenChange={(v) => { setForgotOpen(v); if (!v) { setForgotEmail(''); setRecoveryToken(null); } }}>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Forgot Password</DialogTitle>
                <DialogDescription id="forgot-password-description">Enter your administrative email to receive a secure recovery token.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {/* In production we don't return the token in the response; an email is sent instead. */}
                {!recoveryToken ? (
                  <>
                    <Label className="text-sm">Enter your admin email</Label>
                    <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="admin@example.com" />
                    <div className="flex justify-end">
                      <Button onClick={async () => {
                        if (!forgotEmail) return toast({ title: 'Email required', variant: 'destructive' });
                        try {
                          const res = await fetch('/api/admin/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
                          const json = await res.json().catch(() => null);
                          if (res.ok && json?.success) {
                            // Do not expose token in the UI. In production an email is sent.
                            setRecoveryToken(null);
                            toast({ title: 'If account exists', description: 'If an account exists for that email we sent password reset instructions.' });
                            setForgotEmail('');
                            setForgotOpen(false);
                          } else {
                            toast({ title: 'Request failed', description: json?.error || 'Unable to create recovery token', variant: 'destructive' });
                          }
                        } catch (e) {
                          toast({ title: 'Network error', variant: 'destructive' });
                        }
                      }} className="ml-2">Generate Token</Button>
                    </div>
                  </>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
          {/* Reveal username removed */}

          {/* Footer */}
          <p className="text-center text-[10px] text-[hsl(25,20%,35%)] pt-2">
            Secured access · Nib International Bank S.C.
          </p>
        </CardContent>
      </Card>
      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) { setResetToken(''); setResetPassword(''); setResetConfirm(''); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription id="reset-password-description">Use your recovery token to set a new administrative password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-sm">Recovery Token</Label>
            <Input value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="token" />
            <Label className="text-sm">New Password</Label>
            <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="new password" />
            <Label className="text-sm">Confirm Password</Label>
            <Input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="confirm password" />
            <div className="flex justify-end">
              <Button onClick={async () => {
                if (!resetToken || !resetPassword || !resetConfirm) return toast({ title: 'All fields are required', variant: 'destructive' });
                if (resetPassword !== resetConfirm) return toast({ title: 'Passwords do not match', variant: 'destructive' });
                setResetLoading(true);
                try {
                  const res = await fetch('/api/admin/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword: resetPassword }) });
                  const json = await res.json().catch(() => null);
                  if (res.ok && json?.success) {
                    toast({ title: 'Password reset', description: 'You can now sign in with your new password.' });
                    setResetOpen(false);
                  } else {
                    toast({ title: 'Reset failed', description: json?.error || 'Invalid token', variant: 'destructive' });
                  }
                } catch (e) {
                  toast({ title: 'Network error', variant: 'destructive' });
                } finally {
                  setResetLoading(false);
                }
              }} disabled={resetLoading}>Reset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
