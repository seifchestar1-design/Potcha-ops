'use client';

import {
  CalendarDays, ListChecks, AlertTriangle, Truck, Gauge, ClipboardCheck,
  CheckCircle2, Plus, Clock3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { KpiCard } from '@/components/app/ui/kpi-card';
import { PageHeader } from '@/components/app/ui/page-header';
import { UpcomingEventsCard, AlertsCard, ActivityCard, useDashboard } from './shared';

export function OpsDashboard() {
  const user = useAppStore((s) => s.user);
  const { data, isLoading } = useDashboard();
  const k = data?.kpis ?? {};

  // ---- Tap targets: every KPI opens the workspace where the number lives.
  const critIssues = data?.alerts?.criticalIssues ?? [];
  // One critical issue → open its event's issues tab directly.
  const criticalTarget =
    critIssues.length === 1 && critIssues[0].eventId
      ? `/events/${critIssues[0].eventId}/issues`
      : '/events';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Operations — ${user?.name?.split(' ')[0] ?? 'Team'}'s board`}
        description="Your assigned events, today's execution load and readiness status"
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/tasks')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Add task
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/vendors')}>
              <Truck className="mr-1 h-4 w-4" aria-hidden /> Vendors
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="My events" value={k.myEvents} icon={CalendarDays} loading={isLoading} onPress={() => navigate('/events')} />
        <KpiCard label="Upcoming weddings" value={k.upcomingWeddings} icon={CalendarDays} loading={isLoading} onPress={() => navigate('/events')} />
        <KpiCard label="Vendor confirmations pending" value={k.pendingVendorConfirmations} icon={Truck} tone="warning" loading={isLoading} onPress={() => navigate('/vendors')} />
        <KpiCard label="Tasks due today" value={k.tasksDueToday} icon={Clock3} tone={k.tasksDueToday ? 'warning' : 'positive'} loading={isLoading} onPress={() => navigate('/tasks?due=TODAY')} />
        <KpiCard label="Overdue tasks" value={k.tasksOverdue} icon={AlertTriangle} tone={k.tasksOverdue ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate('/tasks?due=OVERDUE')} />
        <KpiCard label="Critical issues" value={k.criticalIssues} icon={AlertTriangle} tone={k.criticalIssues ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate(criticalTarget)} />
        <KpiCard label="Run-sheet completion" value={k.runSheetCompletion !== undefined ? `${k.runSheetCompletion}%` : null} icon={ClipboardCheck} tone="info" loading={isLoading} onPress={() => navigate('/events')} />
        <KpiCard label="Avg event readiness" value={k.avgReadiness !== undefined ? `${k.avgReadiness}%` : null} icon={Gauge} tone="info" loading={isLoading} onPress={() => navigate('/events')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <UpcomingEventsCard data={data} loading={isLoading} />
        </div>
        <div className="space-y-4">
          <AlertsCard data={data} loading={isLoading} />
          <ActivityCard data={data} loading={isLoading} />
        </div>
      </div>
    </div>
  );
}
