'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, MapPin, Users, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/client/api';
import type { EventRow } from '@/lib/client/types';
import { fmtDate, countdownLabel, formatMoney } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { ReadinessRing } from '@/components/app/ui/readiness-ring';
import { OverviewTab } from './tabs/overview-tab';
import { VendorsTab } from './tabs/vendors-tab';
import { BudgetTab } from './tabs/budget-tab';
import { TasksTab } from './tabs/tasks-tab';
import { RunSheetTab } from './tabs/runsheet-tab';
import { IssuesTab } from './tabs/issues-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { ActivityTab } from './tabs/activity-tab';

export function EventWorkspace({ eventId, tab }: { eventId: string; tab: string }) {
  const user = useAppStore((s) => s.user);
  const { data, isLoading, error } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<{ event: EventRow }>(`/events/${eventId}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data?.event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Back to events
        </Button>
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Event not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This event doesn't exist in your company, or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  const e = data.event;
  const perms = user?.perms ?? [];
  const canFin = perms.includes('finance.view');
  const cur = user?.currency ?? 'EGP';

  const tabs = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'vendors', label: 'Vendors', show: true },
    { key: 'budget', label: 'Budget', show: canFin },
    { key: 'tasks', label: 'Tasks', show: perms.includes('tasks.view') || perms.includes('tasks.manage') },
    { key: 'runsheet', label: 'Run sheet', show: perms.includes('runsheet.view') || perms.includes('runsheet.manage') },
    { key: 'issues', label: 'Issues', show: perms.includes('issues.view') || perms.includes('issues.manage') },
    { key: 'documents', label: 'Documents', show: perms.includes('documents.view') || perms.includes('documents.upload') },
    { key: 'activity', label: 'Activity', show: true },
  ].filter((t) => t.show);

  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'overview';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5 px-2" onClick={() => navigate('/events')}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> All events
        </Button>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ReadinessRing readiness={e.readiness} size={64} className="hidden sm:flex" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight">{e.name}</h1>
                <StatusBadge kind="event" value={e.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {e.clientName}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {fmtDate(e.eventDate)} · <span className="font-medium text-foreground">{countdownLabel(e.eventDate)}</span>
                </span>
                {e.venue && (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden /> {e.venue}</span>
                )}
                {e.clientPhone && (
                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" aria-hidden /> {e.clientPhone}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:shrink-0">
            {canFin && e.contractValue !== undefined && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contract</p>
                <p className="text-lg font-semibold tabular">{formatMoney(e.contractValue, cur)}</p>
              </div>
            )}
            <div className="sm:hidden">
              <ReadinessRing readiness={e.readiness} size={52} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => navigate(`/events/${eventId}/${v}`)}>
        <div className="overflow-x-auto scroll-slim pb-1">
          <TabsList className="h-10 w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="px-3 text-xs sm:text-sm">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {activeTab === 'overview' && <OverviewTab eventId={eventId} />}
        {activeTab === 'vendors' && <VendorsTab eventId={eventId} />}
        {activeTab === 'budget' && <BudgetTab eventId={eventId} />}
        {activeTab === 'tasks' && <TasksTab eventId={eventId} />}
        {activeTab === 'runsheet' && <RunSheetTab eventId={eventId} />}
        {activeTab === 'issues' && <IssuesTab eventId={eventId} />}
        {activeTab === 'documents' && <DocumentsTab eventId={eventId} />}
        {activeTab === 'activity' && <ActivityTab eventId={eventId} />}
      </Tabs>
    </div>
  );
}
