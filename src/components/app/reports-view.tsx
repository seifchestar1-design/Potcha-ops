'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileBarChart2, CalendarDays, Banknote, ListChecks, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadFile, api } from '@/lib/client/api';
import { fmtDate, formatMoney } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { PageHeader } from '@/components/app/ui/page-header';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { ReadinessRing } from '@/components/app/ui/readiness-ring';

type ReportsData = {
  currency: string;
  canExportFinancial: boolean;
  canExportEvents: boolean;
  canExportTasks: boolean;
  canExportVendors: boolean;
  events: {
    id: string;
    name: string;
    clientName: string;
    eventDate: string;
    status: string;
    venue: string | null;
    guestCount: number;
    plannerName: string | null;
    readinessScore: number | null;
    readinessBand: string | null;
    totalRevenue?: number | null;
    collected?: number | null;
    outstanding?: number | null;
    plannedExpenses?: number | null;
    actualExpenses?: number | null;
    estimatedProfit?: number | null;
    margin?: number | null;
  }[];
};

export function ReportsView() {
  const user = useAppStore((s) => s.user);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api<ReportsData>('/reports'),
  });

  const exportCsv = async (type: string, name: string) => {
    setBusy(type);
    try {
      await downloadFile(`/reports/export?type=${type}`, name);
      toast.success('Export ready', { description: `${name} downloaded.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const cur = data?.currency ?? user?.currency ?? 'EGP';
  const canFin = user?.perms.includes('finance.view') ?? false;

  const exports = [
    { type: 'events', name: 'potcha-events.csv', label: 'Events report', desc: 'All events with status, dates, venue, guests' + (canFin ? ' and financial rollups' : ''), icon: CalendarDays, allowed: data?.canExportEvents },
    { type: 'financial', name: 'potcha-financial-ledger.csv', label: 'Financial ledger', desc: 'Every transaction — immutable audit-ready export', icon: Banknote, allowed: data?.canExportFinancial },
    { type: 'tasks', name: 'potcha-tasks.csv', label: 'Tasks report', desc: 'Operational tasks with owners, priorities and due dates', icon: ListChecks, allowed: data?.canExportTasks },
    { type: 'vendors', name: 'potcha-vendors.csv', label: 'Vendor directory', desc: 'Company vendor contacts by category', icon: Building2, allowed: data?.canExportVendors },
  ].filter((x) => x.allowed);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & exports"
        description="Company performance at a glance, with auditable CSV exports"
      />

      {/* Export cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {exports.map((x) => (
          <Card key={x.type}>
            <CardContent className="flex h-full flex-col p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <x.icon className="h-4.5 w-4.5 h-5 w-5 text-primary" aria-hidden />
                </div>
                <p className="text-sm font-medium">{x.label}</p>
              </div>
              <p className="mt-2 flex-1 text-xs text-muted-foreground">{x.desc}</p>
              <Button size="sm" variant="outline" className="mt-3 w-full"
                disabled={busy === x.type}
                onClick={() => void exportCsv(x.type, x.name)}>
                <Download className="mr-1 h-4 w-4" aria-hidden />
                {busy === x.type ? 'Preparing…' : 'Export CSV'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company performance table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileBarChart2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Company performance
          </CardTitle>
          <CardDescription>
            {canFin
              ? 'Revenue, collection and profit per event. Financial figures are company-confidential.'
              : 'Operational performance per event.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 font-medium">Event</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Planner</th>
                    <th className="p-3 text-center font-medium">Readiness</th>
                    {canFin && <th className="p-3 text-right font-medium">Revenue</th>}
                    {canFin && <th className="p-3 text-right font-medium">Collected</th>}
                    {canFin && <th className="p-3 text-right font-medium">Outstanding</th>}
                    {canFin && <th className="p-3 text-right font-medium">Est. profit</th>}
                    {canFin && <th className="p-3 text-right font-medium">Margin</th>}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {(data?.events ?? []).map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="max-w-44 truncate p-3 font-medium">
                        <button className="underline-offset-2 hover:underline" onClick={() => navigate(`/events/${e.id}/overview`)}>
                          {e.name}
                        </button>
                      </td>
                      <td className="whitespace-nowrap p-3">{fmtDate(e.eventDate)}</td>
                      <td className="p-3"><StatusBadge kind="event" value={e.status} /></td>
                      <td className="max-w-28 truncate p-3 text-muted-foreground">{e.plannerName ?? '—'}</td>
                      <td className="p-3 text-center">
                        <span className={
                          e.readinessBand === 'on_track' ? 'text-emerald-600 dark:text-emerald-400'
                            : e.readinessBand === 'attention' ? 'text-amber-600 dark:text-amber-400'
                              : e.readinessBand === 'at_risk' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                        }>
                          {e.readinessScore !== null ? `${e.readinessScore}%` : '—'}
                        </span>
                      </td>
                      {canFin && <>
                        <td className="p-3 text-right">{formatMoney(e.totalRevenue ?? 0, cur)}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(e.collected ?? 0, cur)}</td>
                        <td className="p-3 text-right text-amber-600 dark:text-amber-400">{formatMoney(e.outstanding ?? 0, cur)}</td>
                        <td className={`p-3 text-right ${(e.estimatedProfit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatMoney(e.estimatedProfit ?? 0, cur)}
                        </td>
                        <td className="p-3 text-right">{e.margin !== null && e.margin !== undefined ? `${e.margin.toFixed(1)}%` : '—'}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
