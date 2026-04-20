'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

export default function ResetPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = searchParams?.get('token') || '';
        if (t) setToken(t);
    }, [searchParams]);

    const handleReset = async () => {
        if (!token || !password || !confirm) return toast({ title: 'All fields required', variant: 'destructive' });
        if (password !== confirm) return toast({ title: 'Passwords do not match', variant: 'destructive' });
        setLoading(true);
        try {
            const res = await fetch('/api/admin/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: password }) });
            const json = await res.json().catch(() => null);
            if (res.ok && json?.success) {
                toast({ title: 'Password reset', description: 'You can now sign in with your new password.' });
                // Redirect to admin root (login)
                router.push('/admin');
            } else {
                toast({ title: 'Reset failed', description: json?.error || 'Invalid or expired token', variant: 'destructive' });
            }
        } catch (e) {
            toast({ title: 'Network error', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md relative z-10 border-border bg-card/80 backdrop-blur-sm shadow-2xl shadow-black/10">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                    <CardDescription className="text-muted-foreground">Enter a new password for your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Recovery Token</Label>
                        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="token from email" />
                    </div>
                    <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="new password" />
                    </div>
                    <div className="space-y-2">
                        <Label>Confirm Password</Label>
                        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="confirm password" />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleReset} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
                    </div>
                </CardContent>
            </Card>
            <Toaster />
        </div>
    );
}
