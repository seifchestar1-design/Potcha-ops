'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/client/api';
import type { ActivityRow } from '@/lib/client/types';
import { fmtDateTime, fmtRelative } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { EmptyState } from '@/components/app/ui/empty-state';

export function ActivityTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['event-activity', eventId],
    queryFn: () => api<{ activity: ActivityRow[] }>(`/events/${eventId}/activity`),
  });

  const scopeNote =
    user?.role === 'CEO'
      ? 'Full audit history for this event.'
      : user?.role === 'FINANCE'
        ? 'Financial activity and your own actions for this event.'
        : 'Your own actions on this event — company-wide activity is restricted.';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden /> Activity history
        </CardTitle>
        <p className="text-xs text-muted-foreground">{scopeNote}</p>
      </CardHeader>
      <CardContent className="max-h-[520px] overflow-y-auto scroll-slim">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : (data?.activity ?? []).length === 0 ? (
          <EmptyState icon={History} title="No visible activity yet" description={scopeNote} className="border-0 py-6" />
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {(data?.activity ?? []).map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium leading-snug">{a.summary}</p>
                  {a.action.includes('payment') || a.action.includes('financial') ? (
                    <Badge variant="secondary" className="text-[9px]">financial</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {a.userName}
                  {a.userRole ? ` (${a.userRole})` : ''} · {fmtDateTime(a.createdAt)} · {fmtRelative(a.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
