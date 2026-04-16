'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useAdminAuth, evaluatePasswordStrength, isStrongPassword } from './AdminAuthContext';
import { Plus, RefreshCw } from 'lucide-react';

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'checker';
  createdAt: string;
};

export function UsersManagement() {
  const { csrfFetch } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<{ username: string; email: string; role: 'admin' | 'checker' | 'support'; password: string }>({
    username: '',
    email: '',
    role: 'checker',
    password: '',
  });

  const strength = useMemo(() => evaluatePasswordStrength(form.password), [form.password]);

  const loadUsers = useCallback(async (mode: 'initial' | 'refresh') => {
    try {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);

      const res = await csrfFetch('/api/admin/users', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load users.');
      }
      setUsers(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not load users.', variant: 'destructive' });
    } finally {
      if (mode === 'initial') setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, [csrfFetch]);

  useEffect(() => {
    loadUsers('initial');
  }, [loadUsers]);

  const canCreate =
    form.username.trim().length > 0 &&
    form.email.trim().length > 0 &&
    (form.role === 'admin' || form.role === 'checker' || form.role === 'support') &&
    isStrongPassword(form.password);

  const submitCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const res = await csrfFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to create user.');
      }

      toast({ title: 'Created', description: `User "${json.data?.username || form.username.trim()}" created.` });
      setIsCreateOpen(false);
      setForm({ username: '', email: '', role: 'checker', password: '' });
      await loadUsers('refresh');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not create user.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <div className="space-y-1">
            <CardTitle>Admin Users</CardTitle>
            <div className="text-[11px] text-muted-foreground">{users.length} users</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadUsers('refresh')} disabled={isLoading || isRefreshing}>
              <RefreshCw size={14} className={isRefreshing ? 'mr-2 animate-spin' : 'mr-2'} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} className="mr-2" /> Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading users...</div>
          ) : (
            <div className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell className="capitalize">{u.role}</TableCell>
                        <TableCell>{new Date(u.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={open => !isCreating && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(prev => ({ ...prev, role: v as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checker">Checker</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground">Strength</div>
              <div className="font-medium">{strength.label}</div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-2 ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={!canCreate || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
