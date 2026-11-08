'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Building2, KeyRound, RotateCcw, Palette, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import { CURRENCIES } from '@/lib/constants';
import { fmtDate } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { PageHeader } from '@/components/app/ui/page-header';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

type SettingsData = {
  company: {
    id: string;
    name: string;
    currency: string;
    dateFormat: string;
    plan: string;
    isDemo: boolean;
    createdAt: string;
  };
  canManage: boolean;
  currencies: string[];
};

export function SettingsView() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [dateFormat, setDateFormat] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [resetOpen, setResetOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsData>('/settings'),
  });

  const [loadedId, setLoadedId] = useState<string | null | undefined>(undefined);
  const currentCompanyId = data?.company.id ?? null;
  if (currentCompanyId !== loadedId) {
    setLoadedId(currentCompanyId);
    if (data) {
      setName(data.company.name);
      setCurrency(data.company.currency);
      setDateFormat(data.company.dateFormat);
    }
  }

  const saveCompany = useMutation({
    mutationFn: () =>
      api('/settings', {
        method: 'PATCH',
        body: {
          ...(name !== data?.company.name ? { name } : {}),
          ...(currency !== data?.company.currency ? { currency } : {}),
          ...(dateFormat !== data?.company.dateFormat ? { dateFormat } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Company settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      if (user && (currency !== user.currency || name !== user.companyName)) {
        setUser({ ...user, currency, companyName: name });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const changePw = useMutation({
    mutationFn: () =>
      api('/auth/password', {
        method: 'POST',
        body: { currentPassword: pw.current, newPassword: pw.next },
      }),
    onSuccess: () => {
      toast.success('Password changed');
      setPw({ current: '', next: '', confirm: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  const resetDemo = useMutation({
    mutationFn: () => api('/demo/reset', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Demo data reset', { description: 'Sign in again with the demo accounts.' });
      window.location.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const pwValid = pw.next.length >= 8 && /[A-Za-z]/.test(pw.next) && /[0-9]/.test(pw.next) && pw.next === pw.confirm;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Company preferences, your profile and demo tools" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Company settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" aria-hidden /> Company
            </CardTitle>
            <CardDescription>
              {data?.canManage
                ? 'Company-wide settings — CEO only.'
                : 'Read-only. Only the CEO can change company settings.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Company name</Label>
              <Input id="set-name" value={name} disabled={!data?.canManage} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={!data?.canManage}>
                  <SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Default: EGP (Egyptian market).</p>
              </div>
              <div className="space-y-1.5">
                <Label>Date format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat} disabled={!data?.canManage}>
                  <SelectTrigger aria-label="Date format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Plan: <span className="font-medium text-foreground">{data?.company.plan ?? 'TRIAL'}</span></span>
              <span>Since {fmtDate(data?.company.createdAt)}</span>
            </div>
            {data?.canManage && (
              <Button size="sm" onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending || !name.trim()}>
                {saveCompany.isPending ? 'Saving…' : 'Save company settings'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Profile & password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Your profile
            </CardTitle>
            <CardDescription>Update your sign-in password (bcrypt-hashed).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <p className="font-medium">{user?.name}</p>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-muted-foreground">
                Role: {user?.role} · Company: {user?.companyName}
              </p>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwValid) changePw.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="pw-current">Current password</Label>
                <Input id="pw-current" type="password" autoComplete="current-password"
                  value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pw-next">New password</Label>
                  <Input id="pw-next" type="password" autoComplete="new-password"
                    value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-confirm">Confirm new password</Label>
                  <Input id="pw-confirm" type="password" autoComplete="new-password"
                    value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
                </div>
              </div>
              {pw.next && !pwValid && (
                <p className="text-[11px] text-muted-foreground">
                  At least 8 characters with letters and numbers; both fields must match.
                </p>
              )}
              <Button type="submit" size="sm" disabled={!pw.current || !pwValid || changePw.isPending}>
                {changePw.isPending ? 'Changing…' : 'Change password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4 text-primary" aria-hidden /> Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button size="sm" variant={theme === 'light' ? 'secondary' : 'outline'} onClick={() => setTheme('light')}>Light</Button>
            <Button size="sm" variant={theme === 'dark' ? 'secondary' : 'outline'} onClick={() => setTheme('dark')}>Dark</Button>
            <p className="ml-2 text-xs text-muted-foreground">Comfortable in the office and on late-night event days.</p>
          </CardContent>
        </Card>

        {/* Demo tools / security note */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Security model:</span> server-enforced RBAC, tenant isolation on every query, bcrypt password hashing, httpOnly revocable sessions, immutable financial ledger with reversals, and a full audit trail.</p>
            </div>
            {data?.company.isDemo && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Reset demo data</p>
                    <p className="text-xs text-muted-foreground">Deletes the fictional demo company and regenerates all sample data.</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 border-red-500/40 text-red-700 dark:text-red-400" onClick={() => setResetOpen(true)}>
                    <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Reset
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo environment?"
        description="All demo events, vendors, payments, tasks and team members are deleted and regenerated. You will be signed out. Real (non-demo) companies are never touched."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={() => resetDemo.mutate()}
      />
    </div>
  );
}
