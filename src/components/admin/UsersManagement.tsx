'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAdminAuth } from './AdminAuthContext';
import { evaluatePasswordStrength, isStrongPassword } from '@/lib/passwordValidation';
import { Edit2, Eye, EyeOff, Plus, RefreshCw, Trash2, FileCode, X } from 'lucide-react';
import { usePerEntityDrafts } from '@/hooks/usePerEntityDrafts';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';

type AdminUser = {
  id: number;
  username: string;
  email: string;
  groupName: string;
  role: 'admin' | 'checker' | 'support';
  createdAt: string;
};

export function UsersManagement() {
  const { csrfFetch, currentUsername } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [meta, setMeta] = useState<{ page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didInitQueryRef = useRef(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<{ username: string; email: string; groupName: string; role: 'admin' | 'checker' | 'support'; password: string }>({
    username: '',
    email: '',
    groupName: '',
    role: 'checker',
    password: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(form.password), [form.password]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState<{ id: number | null; username: string; email: string; groupName: string; role: 'admin' | 'checker' | 'support'; password: string }>({
    id: null,
    username: '',
    email: '',
    groupName: '',
    role: 'checker',
    password: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const editStrength = useMemo(() => evaluatePasswordStrength(editForm.password), [editForm.password]);

  const { activeDraftIds: activeCreateDrafts, getDraft: getCreateDraft, discardDraft: discardCreateDraft } = usePerEntityDrafts('user_create', 'new', form, isCreateOpen);
  const { activeDraftIds: activeEditDrafts, getDraft: getEditDraft, discardDraft: discardEditDraft } = usePerEntityDrafts('user_edit', String(editForm.id || ''), editForm, isEditOpen);

  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadUsers = useCallback(async (page: number = 0, size: number = pageSize) => {
    setError(null);
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(size));
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      const res = await csrfFetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load users.');
      }
      const next = Array.isArray(json.data) ? json.data : [];
      const nextMeta = json?.meta && typeof json.meta === 'object' ? json.meta : null;
      setMeta(nextMeta);
      setUsers(next);
    } catch (e: any) {
      const errorMsg = e?.message || 'Could not load users.';
      setError(errorMsg);
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setInitialLoading(false);
    }
  }, [csrfFetch, debouncedQuery, pageSize]);

  useEffect(() => {
    loadUsers(0, pageSize);
  }, [loadUsers]);

  useEffect(() => {
    if (!didInitQueryRef.current) {
      didInitQueryRef.current = true;
      return;
    }
    // Reset to page 0 when search/filter changes
    setCurrentPage(0);
    loadUsers(0, pageSize);
  }, [debouncedQuery, loadUsers, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadUsers(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
    loadUsers(0, newSize);
  };

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
          groupName: form.groupName.trim(),
          role: form.role,
          password: form.password,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to create user.');
      }

      toast({ title: 'Created', description: `User "${json.data?.username || form.username.trim()}" created.` });
      discardCreateDraft('new');
      setIsCreateOpen(false);
      setForm({ username: '', email: '', groupName: '', role: 'checker', password: '' });
      setShowCreatePassword(false);
      await loadUsers('refresh', { page: 0, append: false });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not create user.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const canUpdate =
    typeof editForm.id === 'number' &&
    editForm.username.trim().length > 0 &&
    editForm.email.trim().length > 0 &&
    (editForm.role === 'admin' || editForm.role === 'checker' || editForm.role === 'support') &&
    (editForm.password.length === 0 || isStrongPassword(editForm.password));

  const openEdit = (u: AdminUser) => {
    const draft = getEditDraft(String(u.id));
    if (draft) {
      setEditForm(draft as any);
    } else {
      setEditForm({
        id: u.id,
        username: u.username,
        email: u.email,
        groupName: u.groupName || '',
        role: u.role,
        password: '',
      });
    }
    setShowEditPassword(false);
    setIsEditOpen(true);
  };

  const submitUpdate = async () => {
    if (!canUpdate) return;
    setIsUpdating(true);
    try {
      const body: any = {
        id: editForm.id,
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        groupName: editForm.groupName.trim(),
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;

      const res = await csrfFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to update user.');
      }
      toast({ title: 'Updated', description: `User "${json.data?.username || editForm.username.trim()}" updated.` });
      discardEditDraft(String(editForm.id));
      setIsEditOpen(false);
      setEditForm({ id: null, username: '', email: '', groupName: '', role: 'checker', password: '' });
      await loadUsers('refresh', { page: 0, append: false });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not update user.', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users;

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await csrfFetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userToDelete.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to delete user.');
      }
      toast({ title: 'Deleted', description: `User "${userToDelete.username}" deleted.` });
      setUserToDelete(null);
      await loadUsers('refresh', { page: 0, append: false });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not delete user.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <div className="space-y-1">
            <CardTitle>Admin Users</CardTitle>
            <div className="text-[11px] text-muted-foreground">{typeof meta?.total === 'number' ? meta.total : filteredUsers.length} users</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadUsers(currentPage, pageSize)} disabled={isLoading || isRefreshing}>
              <RefreshCw size={14} className={isRefreshing ? 'mr-2 animate-spin' : 'mr-2'} /> Refresh
            </Button>
            {activeCreateDrafts.includes('new') && (
              <>
                <Button variant="outline" size="sm" className="text-amber-500 border-amber-200 bg-amber-50" onClick={() => {
                  const draft = getCreateDraft('new');
                  if (draft) setForm(draft as any);
                  setIsCreateOpen(true);
                }}>
                  <FileCode size={14} className="mr-2" /> Resume Draft
                </Button>
                <Button variant="outline" size="sm" className="text-destructive border-red-200 bg-red-50" onClick={() => discardCreateDraft('new')} title="Discard Draft">
                  <X size={14} />
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} className="mr-2" /> Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-[700px]">
          {initialLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading users...</div>
          ) : (
            <>
              <div className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <SearchInput
                    ref={searchInputRef}
                    value={query}
                    onChange={setQuery}
                    placeholder="Search users by username, email, or group name..."
                    className="flex-1"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          {query.trim() ? 'No users match your search.' : 'No users found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{u.groupName || '-'}</TableCell>
                          <TableCell className="capitalize">{u.role}</TableCell>
                          <TableCell>{new Date(u.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2 items-center">
                              {activeEditDrafts.includes(String(u.id)) && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => {
                                    const draft = getEditDraft(String(u.id));
                                    if (draft) {
                                      setEditForm(draft as any);
                                      setIsEditOpen(true);
                                    }
                                  }} title="Resume Draft">
                                    <FileCode size={14} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => discardEditDraft(String(u.id))} title="Discard Draft">
                                    <X size={14} />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(u)}
                                disabled={u.username === currentUsername || isLoading || isRefreshing}
                              >
                                <Edit2 size={14} className="mr-2" /> Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setUserToDelete(u)}
                                disabled={u.username === currentUsername || isLoading || isRefreshing}
                              >
                                <Trash2 size={14} className="mr-2" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {meta && (
                <div className="p-4 border-t bg-card sticky bottom-0 z-10">
                  {error ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <p className="text-sm text-destructive">{error}</p>
                      <Button variant="outline" onClick={() => loadUsers(currentPage, pageSize)}>Retry</Button>
                    </div>
                  ) : (
                    <Pagination
                      currentPage={currentPage}
                      pageSize={pageSize}
                      totalItems={meta.total}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={open => !isCreating && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
            <DialogDescription id="user-create-description">Add a new administrative user with a specific role and access group.</DialogDescription>
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
                <Label>Group Name</Label>
                <Input
                  value={form.groupName}
                  onChange={e => setForm(prev => ({ ...prev, groupName: e.target.value }))}
                  autoComplete="off"
                  placeholder="e.g. Customer Support Team A"
                />
              </div>
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
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                >
                  {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
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

      <Dialog open={isEditOpen} onOpenChange={open => !isUpdating && setIsEditOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Admin User</DialogTitle>
            <DialogDescription id="user-edit-description">Modify existing user details, update role, or change password.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={editForm.username}
                  onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editForm.email}
                  onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={editForm.groupName}
                  onChange={e => setEditForm(prev => ({ ...prev, groupName: e.target.value }))}
                  autoComplete="off"
                  placeholder="e.g. Customer Support Team A"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(prev => ({ ...prev, role: v as any }))}>
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
            </div>

            <div className="space-y-2">
              <Label>New Password (optional)</Label>
              <div className="relative">
                <Input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editForm.password}
                  onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                >
                  {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground">Strength</div>
              <div className="font-medium">{editForm.password ? editStrength.label : '-'}</div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-2 ${editForm.password ? editStrength.color : 'bg-transparent'}`}
                style={{ width: `${editForm.password ? (editStrength.score / 4) * 100 : 0}%` }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} disabled={!canUpdate || isUpdating}>
              {isUpdating ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={open => !open && !isDeleting && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Delete user{userToDelete ? ` "${userToDelete.username}"` : ''}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setUserToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
