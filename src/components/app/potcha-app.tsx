'use client';

import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/components/app/store';
import { useRoute } from '@/components/app/router';
import { AppShell } from '@/components/app/shell/app-shell';
import { LoginView } from '@/components/app/auth/login-view';
import { CeoDashboard } from '@/components/app/dashboard/ceo-dashboard';
import { FinanceDashboard } from '@/components/app/dashboard/finance-dashboard';
import { OpsDashboard } from '@/components/app/dashboard/ops-dashboard';
import { AdminView } from '@/components/app/admin-view';
import { EventsView } from '@/components/app/events/events-view';
import { EventWorkspace } from '@/components/app/events/event-workspace';
import { TasksView } from '@/components/app/tasks-view';
import { VendorsView } from '@/components/app/vendors-view';
import { FinanceView } from '@/components/app/finance-view';
import { TeamView } from '@/components/app/team-view';
import { AuditView } from '@/components/app/audit-view';
import { ReportsView } from '@/components/app/reports-view';
import { SettingsView } from '@/components/app/settings-view';
import { api } from '@/lib/client/api';
import type { SessionUser } from '@/lib/client/types';

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-4xl space-y-6 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-serif text-xl font-bold text-primary-foreground">
            P
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function PotchaApp() {
  const user = useAppStore((s) => s.user);
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const setUser = useAppStore((s) => s.setUser);
  const setBootstrapped = useAppStore((s) => s.setBootstrapped);
  const route = useRoute();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<{ user: SessionUser | null }>('/auth/me');
        if (!cancelled) setUser(me.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setBootstrapped]);

  // Session revoked/expired mid-flight (e.g. demo reset while logged in):
  // any API 401 flips the app back to the login screen so users never see
  // silently stale data. (A failed login POST also 401s, but the user is
  // already null there — harmless no-op.)
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('potcha:unauthorized', onUnauthorized);
    return () => window.removeEventListener('potcha:unauthorized', onUnauthorized);
  }, [setUser]);

  if (!bootstrapped) return <BootScreen />;

  // Public views (self-registration is closed — companies are provisioned
  // by the platform administrator, so the login screen is the only entry).
  if (!user) {
    return <LoginView />;
  }

  // Platform ADMIN: subscriber management is the entire product surface.
  // #/settings is allowed too (self-service password change; the company
  // form renders read-only because the role holds no settings permission).
  if (user.role === 'ADMIN') {
    return (
      <AppShell>
        {route.view === 'settings' ? <SettingsView /> : <AdminView />}
      </AppShell>
    );
  }

  const content = (() => {
    switch (route.view) {
      case 'dashboard':
        if (user.role === 'CEO') return <CeoDashboard />;
        if (user.role === 'FINANCE') return <FinanceDashboard />;
        return <OpsDashboard />;
      case 'admin':
        // Company users never have admin access — the API enforces this;
        // the client just routes them back to their dashboard.
        return <CeoDashboard />;
      case 'events':
        return <EventsView />;
      case 'event':
        return <EventWorkspace eventId={route.id} tab={route.tab} />;
      case 'tasks':
        return <TasksView />;
      case 'vendors':
        return <VendorsView />;
      case 'finance':
        return <FinanceView />;
      case 'team':
        return <TeamView />;
      case 'audit':
        return <AuditView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <CeoDashboard />;
    }
  })();

  return <AppShell>{content}</AppShell>;
}
