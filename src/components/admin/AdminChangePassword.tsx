'use client';

import React, { useState, useMemo } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { evaluatePasswordStrength, isStrongPassword } from '@/lib/passwordValidation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AdminChangePassword() {
  const { changeCredentials, currentUsername } = useAdminAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const resetForm = () => {
    setCurrentPassword('');
    setNewUsername('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }

    const username = newUsername.trim() || currentUsername;
    const email = newEmail.trim() || undefined;

    if (!isStrongPassword(newPassword)) {
      setError('New password must have 12+ chars, uppercase, lowercase, number, and special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    await new Promise(r => setTimeout(r, 400));

    const result = await changeCredentials(currentPassword, username, newPassword, email);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: '✅ Credentials Updated',
        description: `Your credentials have been changed successfully.`,
      });
      resetForm();
      setOpen(false);
    } else {
      setError(result.error || 'Failed to update credentials.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          <Settings size={16} />
          Credentials
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={18} className="text-[hsl(45,93%,47%)]" />
            Update Credentials
          </DialogTitle>
          <DialogDescription>
            Change your admin username and password. New password must meet all strength requirements.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-pw" className="text-sm font-medium">Current Password</Label>
            <div className="relative">
              <Input
                id="current-pw"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-10"
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
          <div className="space-y-1.5">
            <Label htmlFor="new-username" className="text-sm font-medium">
              New Username <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="new-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={currentUsername}
            />
          </div>

          {/* New Email */}
          <div className="space-y-1.5">
            <Label htmlFor="new-email" className="text-sm font-medium">
              New Email <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-pw" className="text-sm font-medium">New Password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10"
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
          </div>

          {/* Strength Meter */}
          {newPassword.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Strength</span>
                <span className={`text-xs font-semibold ${strength.score <= 1 ? 'text-red-500' :
                    strength.score === 2 ? 'text-yellow-600' :
                      strength.score === 3 ? 'text-blue-600' :
                        'text-green-600'
                  }`}>
                  {strength.label}
                </span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength.score
                        ? strength.score <= 1 ? 'bg-red-500' :
                          strength.score === 2 ? 'bg-yellow-500' :
                            strength.score === 3 ? 'bg-blue-500' :
                              'bg-green-500'
                        : 'bg-muted'
                      }`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: 'minLength', label: '12+ characters' },
                  { key: 'hasUppercase', label: 'Uppercase' },
                  { key: 'hasLowercase', label: 'Lowercase' },
                  { key: 'hasNumber', label: 'Number' },
                  { key: 'hasSpecial', label: 'Special char' },
                ].map(({ key, label }) => (
                  <span
                    key={key}
                    className={`text-[10px] flex items-center gap-1 ${strength.checks[key as keyof typeof strength.checks]
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                      }`}
                  >
                    {strength.checks[key as keyof typeof strength.checks] ? '✓' : '○'} {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw" className="text-sm font-medium">Confirm Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
            {confirmPassword.length > 0 && (
              <div className={`flex items-center gap-1 text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); setOpen(false); }}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="bg-[hsl(45,93%,47%)] hover:bg-[hsl(45,93%,52%)] text-[hsl(25,50%,10%)] font-semibold"
            >
              {isLoading ? 'Updating...' : 'Update Credentials'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
