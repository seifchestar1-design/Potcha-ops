'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, ArrowRight, ShieldCheck, LineChart, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiClientError, saveSessionToken } from '@/lib/client/api';
import type { SessionUser } from '@/lib/client/types';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';

// NOTE: The platform admin (ADMIN) account is intentionally NOT listed here.
// Its credentials are shared privately with the platform owner only.
const DEMO_ACCOUNTS = [
  { role: 'CEO', email: 'ceo@potchaops.demo', desc: 'Full company oversight', level: 'L3' },
  { role: 'FINANCE', email: 'finance@potchaops.demo', desc: 'Financial access', level: 'L2' },
  { role: 'OPERATIONS', email: 'ops@potchaops.demo', desc: 'Event execution', level: 'L1' },
];

export function LoginView() {
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const doLogin = async (em: string, pw: string) => {
    setBusy(true);
    try {
      const res = await api<{ sessionToken?: string; user: Omit<SessionUser, 'perms' | 'currency' | 'dateFormat' | 'isDemoCompany'> & Partial<SessionUser> }>(
        '/auth/login',
        { method: 'POST', body: { email: em, password: pw } }
      );
      // Keep the bearer fallback token for browsers where the httpOnly
      // cookie cannot be stored (iOS Safari, third-party iframe contexts).
      if (res.sessionToken) saveSessionToken(res.sessionToken);
      // /auth/me provides the full profile (perms etc.)
      const me = await api<{ user: SessionUser }>('/auth/me');
      setUser(me.user);
      toast.success(`Welcome back, ${me.user.name}`, {
        description: `Signed in as ${me.user.role}`,
      });
      navigate('/dashboard');
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    setResetting(true);
    try {
      await api('/demo/reset', { method: 'POST' });
      toast.success('Demo data reset', {
        description: 'All demo events, vendors, payments and tasks were regenerated.',
      });
    } catch {
      toast.error('Could not reset demo data');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Brand panel */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-primary px-8 py-10 text-primary-foreground lg:w-[46%] lg:px-14 lg:py-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, #fff 0, transparent 40%), radial-gradient(circle at 80% 70%, #fff 0, transparent 45%)',
            }}
            aria-hidden
          />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 font-serif text-xl font-bold">
              P
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Potcha Ops</p>
              <p className="text-xs text-primary-foreground/70">Wedding operations control center</p>
            </div>
          </div>

          <div className="my-10 max-w-md lg:my-0">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
              Every wedding. Every detail. Under control.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
              The control center for wedding-planning companies in Egypt — events, vendors,
              payments, team responsibilities, run sheets and event readiness, in one secure
              workspace instead of scattered WhatsApp threads and spreadsheets.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                { icon: ShieldCheck, text: 'Role-based access: CEO, Finance & Operations with server-enforced permissions' },
                { icon: LineChart, text: 'Live financials: budgets, payments, profit margins and outstanding balances' },
                { icon: ClipboardList, text: 'Wedding-day run sheets, readiness scoring and issue tracking' },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-primary-foreground/50">
            EGP-first · Arabic-ready · Built for Egyptian wedding planners
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sign in</CardTitle>
                <CardDescription>Access your company workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void doLogin(email, password);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign in'} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Company workspaces are provisioned by the Potcha Ops platform
                    administrator — self-registration is closed. Contact us to subscribe.
                  </p>
                </form>
              </CardContent>
            </Card>

            {/* Demo environment */}
            <div className="mt-5 rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Demo environment — fictional data
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  onClick={() => void resetDemo()}
                  disabled={resetting}
                >
                  <RotateCcw className={resetting ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} aria-hidden />
                  {resetting ? 'Resetting…' : 'Reset demo data'}
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('Demo@1234');
                      void doLogin(acc.email, 'Demo@1234');
                    }}
                    disabled={busy}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <StatusBadge kind="role" value={acc.role} />
                        <span className="text-xs font-medium">{acc.desc}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {acc.email} · Demo@1234
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{acc.level}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[11px] text-muted-foreground">
        Potcha Ops · Premium wedding-planning operations · Demo credentials are fictional
      </footer>
    </div>
  );
}
