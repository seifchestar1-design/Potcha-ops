import { db } from '@/lib/db';
import { ApiError, audit, requireSession, route } from '@/lib/api';
import { visibleEventsWhere, computeFinancialsForEvents } from '@/lib/event-data';

// GET /api/reports/export?type=events|financial|tasks|vendors — CSV download.
// Each export type is individually permission-gated.
function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return '\ufeff' + lines.join('\n'); // BOM for Excel + Arabic text
}

const dateFmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  const type = new URL(req.url).searchParams.get('type') ?? 'events';
  let headers: string[] = [];
  let rows: unknown[][] = [];
  let filename = 'report.csv';

  if (type === 'events') {
    if (!auth.perms.has('events.view.all')) throw new ApiError(403, 'Forbidden: events export requires company-wide event access');
    const events = await db.event.findMany({
      where: { companyId: auth.companyId },
      orderBy: { eventDate: 'asc' },
      include: { planner: { select: { name: true } } },
    });
    headers = ['Event', 'Client', 'Date', 'Status', 'Type', 'Venue', 'Guests', 'Planner', 'Created'];
    rows = events.map((e) => [
      e.name, e.clientName, dateFmt(e.eventDate), e.status, e.eventType,
      e.venue ?? '', e.guestCount, e.planner?.name ?? '', dateFmt(e.createdAt),
    ]);
    if (auth.perms.has('finance.view')) {
      const finMap = await computeFinancialsForEvents(events);
      headers.push('Total Revenue', 'Collected', 'Outstanding', 'Planned Expenses', 'Actual Expenses', 'Est. Profit', 'Margin %');
      rows = events.map((e, i) => {
        const f = finMap.get(e.id);
        const row = [
          e.name, e.clientName, dateFmt(e.eventDate), e.status, e.eventType,
          e.venue ?? '', e.guestCount, e.planner?.name ?? '', dateFmt(e.createdAt),
        ];
        row.push(
          f?.totalRevenue ?? 0, f?.collectedFromClient ?? 0, f?.outstandingClientBalance ?? 0,
          f?.plannedExpenses ?? 0, f?.actualExpenses ?? 0, f?.grossEstimatedProfit ?? 0, f?.profitMargin ?? 0
        );
        return row;
      });
    }
    filename = `potcha-events-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === 'financial') {
    if (!auth.perms.has('finance.export')) throw new ApiError(403, 'Forbidden: missing permission "finance.export"');
    const payments = await db.payment.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: 'asc' },
      include: { event: { select: { name: true } }, recordedBy: { select: { name: true } } },
    });
    headers = ['Date', 'Event', 'Direction', 'Kind', 'Amount', 'Currency', 'Method', 'Reference', 'Status', 'Due Date', 'Paid At', 'Recorded By', 'Note'];
    rows = payments.map((p) => [
      dateFmt(p.createdAt), p.event.name, p.direction, p.kind, p.amount, p.currency,
      p.method, p.reference ?? '', p.status, dateFmt(p.dueDate), dateFmt(p.paidAt),
      p.recordedBy.name, p.note ?? '',
    ]);
    filename = `potcha-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === 'tasks') {
    if (!auth.perms.has('tasks.view')) throw new ApiError(403, 'Forbidden: missing task permission');
    const tasks = await db.task.findMany({
      where: { companyId: auth.companyId, event: visibleEventsWhere(auth) },
      orderBy: [{ dueDate: 'asc' }],
      include: {
        event: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    headers = ['Task', 'Event', 'Assignee', 'Priority', 'Status', 'Due Date', 'Completed At', 'Created'];
    rows = tasks.map((t) => [
      t.title, t.event.name, t.assignedTo?.name ?? '', t.priority, t.status,
      dateFmt(t.dueDate), dateFmt(t.completedAt), dateFmt(t.createdAt),
    ]);
    filename = `potcha-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === 'vendors') {
    if (!auth.perms.has('vendors.contacts.view')) throw new ApiError(403, 'Forbidden: missing vendor permission');
    const vendors = await db.vendor.findMany({
      where: { companyId: auth.companyId },
      orderBy: { name: 'asc' },
    });
    headers = ['Vendor', 'Category', 'Contact Person', 'Phone', 'WhatsApp', 'Email', 'Notes'];
    rows = vendors.map((v) => [
      v.name, v.category, v.contactPerson ?? '', v.phone ?? '', v.whatsapp ?? '', v.email ?? '', v.notes ?? '',
    ]);
    filename = `potcha-vendors-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    throw new ApiError(400, 'Unknown export type');
  }

  await audit(auth, {
    action: 'report.exported',
    entityType: 'Report',
    entityId: type,
    summary: `Exported ${type} report (${rows.length} rows)`,
    metadata: { type, rows: rows.length },
    financial: type === 'financial',
  });

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  }) as never;
});
