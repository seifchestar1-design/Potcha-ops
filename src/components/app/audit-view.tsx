'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/client/api';
import type { AuditLogRow } from '@/lib/client/types';
import { fmtDateTime, fmtRelative } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';

export function AuditView() {
  const user = useAppStore((s) => s.user);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('page', String(page));
  params.set('pageSize', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', q, page],
    queryFn: () => api<{ logs: AuditLogRow[]; total: number; page: number; scope: string }>(`/audit?${params.toString()}`),
  });

  const scopeNote =
    data?.scope === 'company'
      ? 'You see the full company audit trail.'
      : data?.scope === 'financial+own'
        ? 'Finance scope: financial activity and your own actions.'
        : 'You see your own activity only.';

  const logs = data?.logs ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Every meaningful action is recorded — who did what, when, on which event."
        actions={
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Tamper-evident trail
          </span>
        }
      />
      <p className="-mt-2 text-xs text-muted-foreground">{scopeNote}</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search the audit trail…" className="pl-9" aria-label="Search audit log" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries found" description="Actions appear here as you and your team work." />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[560px] overflow-y-auto scroll-slim">
                {/* table-fixed: max-width on <td> is ignored in auto layout,
                    which let event names overlap the summary column. */}
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-36">When</TableHead>
                      <TableHead className="w-32">Who</TableHead>
                      <TableHead className="w-44">Action</TableHead>
                      <TableHead className="w-44">Event</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id} className={l.financial ? 'bg-primary/[0.03]' : undefined}>
                        <TableCell className="whitespace-nowrap text-xs tabular">
                          {fmtDateTime(l.createdAt)}
                          <p className="text-[10px] text-muted-foreground">{fmtRelative(l.createdAt)}</p>
                        </TableCell>
                        <TableCell className="px-2 text-xs">
                          <p className="truncate">{l.userName}</p>
                          {l.userRole && <p className="truncate text-[10px] text-muted-foreground">{l.userRole}</p>}
                        </TableCell>
                        <TableCell className="px-2">
                          <code className="block max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px]" title={l.action}>{l.action}</code>
                          {l.financial && <Badge className="ml-1 text-[9px]" variant="secondary">fin</Badge>}
                        </TableCell>
                        <TableCell className="px-2">
                          {l.eventId ? (
                            <button className="block max-w-full truncate text-xs underline-offset-2 hover:underline"
                              onClick={() => navigate(`/events/${l.eventId}/activity`)}>
                              {l.eventName ?? 'View'}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 text-xs"><p className="truncate" title={l.summary}>{l.summary}</p></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
