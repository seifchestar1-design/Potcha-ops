import { db } from '@/lib/db';
import { ok, requireSession, route } from '@/lib/api';
import { visibleEventsWhere, computeReadinessForEvents, computeFinancialsForEvents } from '@/lib/event-data';
import { isOverdue } from '@/lib/finance';

const UPCOMING_STATUSES = ['LEAD', 'PROPOSAL_SENT', 'CONFIRMED', 'IN_PREPARATION', 'READY'];
const ACTIVE_STATUSES = ['CONFIRMED', 'IN_PREPARATION', 'READY'];
const WON_STATUSES = ['CONFIRMED', 'IN_PREPARATION', 'READY', 'COMPLETED'];

// GET /api/dashboard — one payload, three role-specific shapes.
// Every number is computed from the tenant-scoped, role-visible data only.
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const events = await db.event.findMany({
    where: { ...visibleEventsWhere(auth), status: { not: 'ARCHIVED' } },
    orderBy: { eventDate: 'asc' },
    include: {
      planner: { select: { id: true, name: true } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  const upcoming = events.filter((e) => e.eventDate >= now && UPCOMING_STATUSES.includes(e.status));
  const active = events.filter((e) => ACTIVE_STATUSES.includes(e.status));
  const readinessMap = await computeReadinessForEvents(events);

  const eventsOverview = events.slice(0, 8).map((e) => ({
    id: e.id,
    name: e.name,
    clientName: e.clientName,
    eventDate: e.eventDate,
    venue: e.venue,
    status: e.status,
    guestCount: e.guestCount,
    plannerName: e.planner?.name ?? null,
    daysUntil: Math.ceil((e.eventDate.getTime() - now.getTime()) / 86400000),
    readiness: readinessMap.get(e.id) ?? null,
  }));

  // ============================================================ CEO / FINANCE
  // The dashboard SHAPE follows the user's role: a CEO sees the company
  // scorecard, a Finance user sees the finance KPI set. An Operations user
  // always gets the operations board — even if the CEO has granted them
  // `finance.view` (that grant opens the Finance nav link, the /finance
  // ledger and event Budget tabs; it does not rewrite their home dashboard).
  if (auth.role === 'CEO' || auth.role === 'FINANCE') {
    const won = events.filter((e) => WON_STATUSES.includes(e.status));
    const finMap = await computeFinancialsForEvents(won);

    const [payments, eventVendorsAll, tasksAll, issuesAll, notices, recentActivity] = await Promise.all([
      db.payment.findMany({ where: { companyId: auth.companyId } }),
      db.eventVendor.findMany({
        where: { event: { companyId: auth.companyId } },
        select: { eventId: true, confirmationStatus: true, contractAmount: true },
      }),
      db.task.findMany({
        where: { companyId: auth.companyId },
        select: { eventId: true, assignedToId: true, priority: true, status: true, dueDate: true, title: true },
      }),
      db.issue.findMany({
        where: { companyId: auth.companyId },
        select: { eventId: true, priority: true, status: true, title: true, createdAt: true },
      }),
      auth.perms.has('team.manage')
        ? db.notice.findMany({
            where: { companyId: auth.companyId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { fromUser: { select: { name: true, role: true } }, event: { select: { name: true } } },
          })
        : Promise.resolve([]),
      db.auditLog.findMany({
        where: { companyId: auth.companyId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { user: { select: { name: true, role: true } } },
      }),
    ]);

    const totals = {
      contractedRevenue: 0,
      collected: 0,
      outstanding: 0,
      plannedExpenses: 0,
      actualExpenses: 0,
      estimatedProfit: 0,
    };
    for (const e of won) {
      const f = finMap.get(e.id);
      if (!f) continue;
      totals.contractedRevenue += f.totalRevenue;
      totals.collected += f.collectedFromClient;
      totals.outstanding += f.outstandingClientBalance;
      totals.plannedExpenses += f.plannedExpenses;
      totals.actualExpenses += f.actualExpenses;
      totals.estimatedProfit += f.grossEstimatedProfit;
    }

    // Events at risk: transparent rule — readiness < 70 with the event
    // within 30 days, OR any open critical issue.
    const atRisk = events.filter((e) => {
      const r = readinessMap.get(e.id);
      const days = Math.ceil((e.eventDate.getTime() - now.getTime()) / 86400000);
      const hasCriticalIssue = issuesAll.some(
        (i) => i.eventId === e.id && i.priority === 'CRITICAL' && i.status !== 'RESOLVED'
      );
      return e.eventDate >= now && (hasCriticalIssue || (days <= 30 && (r?.score ?? 100) < 70));
    });

    // Vendor payment commitments
    const upcomingEventIds = new Set(upcoming.map((e) => e.id));
    const vendorCommitments = eventVendorsAll.filter((v) => upcomingEventIds.has(v.eventId));
    const paidVendorAmounts = payments
      .filter((p) => p.direction === 'OUTFLOW' && p.kind === 'VENDOR_PAYMENT' && p.status === 'COMPLETED' && p.amount > 0)
      .reduce((s, p) => s + p.amount, 0);
    const plannedVendorAmounts = vendorCommitments.reduce((s, v) => s + v.contractAmount, 0);

    const pendingPayments = payments.filter((p) => p.status === 'PENDING');
    const overduePayments = pendingPayments.filter((p) => isOverdue(p, now));
    const deadlines = pendingPayments
      .filter((p) => p.dueDate && p.dueDate >= startOfToday && p.dueDate <= new Date(now.getTime() + 14 * 86400000))
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
      .slice(0, 8);

    const overdueTasks = tasksAll.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < startOfToday
    );
    const tasksDueToday = tasksAll.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate >= startOfToday && t.dueDate <= endOfToday
    );
    const openCriticalIssues = issuesAll.filter(
      (i) => i.priority === 'CRITICAL' && i.status !== 'RESOLVED'
    );
    const vendorConfirmationsOutstanding = vendorCommitments.filter((v) =>
      ['NOT_CONTACTED', 'CONTACTED', 'NEGOTIATING', 'DEPOSIT_REQUIRED'].includes(v.confirmationStatus)
    ).length;

    const eventFinancialRows = won.slice(0, 10).map((e) => ({
      eventId: e.id,
      eventName: e.name,
      eventDate: e.eventDate,
      status: e.status,
      ...(finMap.get(e.id) ?? {}),
    }));

    const base = {
      role: auth.role,
      currency: auth.currency,
      kpis: {
        activeEvents: active.length,
        upcomingWeddings: upcoming.length,
        totalContractedRevenue: Math.round(totals.contractedRevenue),
        totalCollected: Math.round(totals.collected),
        outstandingClientPayments: Math.round(totals.outstanding),
        plannedExpenses: Math.round(totals.plannedExpenses),
        actualExpenses: Math.round(totals.actualExpenses),
        estimatedProfit: Math.round(totals.estimatedProfit),
        eventsAtRisk: atRisk.length,
        tasksOverdue: overdueTasks.length,
        vendorConfirmationsOutstanding,
        // finance-specific
        vendorCommitments: Math.round(plannedVendorAmounts),
        paidVendorAmounts: Math.round(paidVendorAmounts),
        unpaidVendorAmounts: Math.round(Math.max(0, plannedVendorAmounts - paidVendorAmounts)),
        upcomingPaymentDeadlines: deadlines.length,
        overduePayments: overduePayments.length,
      },
      events: eventsOverview,
      alerts: {
        overdueTasks: overdueTasks.slice(0, 6).map((t) => ({
          id: t.eventId, eventId: t.eventId, title: t.title, priority: t.priority, dueDate: t.dueDate,
        })),
        openCriticalIssues: openCriticalIssues.slice(0, 6).map((i) => ({
          id: i.eventId, eventId: i.eventId, title: i.title, createdAt: i.createdAt,
        })),
        overduePayments: overduePayments.slice(0, 6).map((p) => ({
          eventId: p.eventId, amount: p.amount, dueDate: p.dueDate, note: p.note,
        })),
        paymentDeadlines: deadlines.map((p) => ({
          eventId: p.eventId, amount: p.amount, dueDate: p.dueDate, note: p.note,
        })),
        atRiskEventIds: atRisk.map((e) => e.id),
      },
      recentActivity: recentActivity.map((l) => ({
        id: l.id, action: l.action, summary: l.summary, createdAt: l.createdAt,
        userName: l.user?.name ?? 'System',
      })),
    };

    if (auth.perms.has('team.manage')) {
      // ---- CEO payload
      return ok({
        ...base,
        notices: notices.map((n) => ({
          id: n.id, level: n.level, message: n.message, createdAt: n.createdAt, readAt: n.readAt,
          eventId: n.eventId, eventName: n.event?.name ?? null,
          fromUserName: n.fromUser.name,
        })),
        eventFinancials: eventFinancialRows,
      });
    }

    // ---- Finance payload
    return ok({
      ...base,
      eventFinancials: eventFinancialRows,
      overduePaymentRows: overduePayments.slice(0, 10).map((p) => ({
        id: p.id, eventId: p.eventId, amount: p.amount, dueDate: p.dueDate, note: p.note, kind: p.kind,
      })),
    });
  }

  // ============================================================ OPERATIONS
  const myEventIds = new Set(events.map((e) => e.id));
  const [tasksAll, issuesAll, runItems, eventVendorsAll, recentActivityOwn] = await Promise.all([
    db.task.findMany({
      where: { companyId: auth.companyId, eventId: { in: [...myEventIds] } },
      select: { eventId: true, assignedToId: true, priority: true, status: true, dueDate: true, title: true },
    }),
    db.issue.findMany({
      where: { companyId: auth.companyId, eventId: { in: [...myEventIds] } },
      select: { eventId: true, priority: true, status: true, title: true, createdAt: true },
    }),
    db.runSheetItem.findMany({
      where: { eventId: { in: [...myEventIds] } },
      select: { eventId: true, status: true },
    }),
    db.eventVendor.findMany({
      where: { eventId: { in: [...myEventIds] } },
      select: { eventId: true, confirmationStatus: true },
    }),
    db.auditLog.findMany({
      where: { companyId: auth.companyId, userId: auth.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const myTasks = tasksAll.filter((t) => t.assignedToId === auth.id);
  const tasksDueToday = myTasks.filter(
    (t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate >= startOfToday && t.dueDate <= endOfToday
  );
  const overdueTasks = myTasks.filter((t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < startOfToday);
  const pendingVendorConfirmations = eventVendorsAll.filter((v) =>
    ['NOT_CONTACTED', 'CONTACTED', 'NEGOTIATING', 'DEPOSIT_REQUIRED'].includes(v.confirmationStatus)
  ).length;
  const criticalIssues = issuesAll.filter((i) => i.priority === 'CRITICAL' && i.status !== 'RESOLVED');
  const doneRunItems = runItems.filter((r) => r.status === 'DONE').length;
  const runSheetCompletion = runItems.length === 0 ? 0 : Math.round((doneRunItems / runItems.length) * 100);
  const avgReadiness =
    events.length === 0
      ? 0
      : Math.round(events.reduce((s, e) => s + (readinessMap.get(e.id)?.score ?? 0), 0) / events.length);

  return ok({
    role: auth.role,
    currency: auth.currency,
    kpis: {
      myEvents: events.length,
      upcomingWeddings: upcoming.length,
      pendingVendorConfirmations,
      tasksDueToday: tasksDueToday.length,
      tasksOverdue: overdueTasks.length,
      criticalIssues: criticalIssues.length,
      runSheetCompletion,
      avgReadiness,
    },
    events: eventsOverview,
    alerts: {
      tasksDueToday: tasksDueToday.slice(0, 6).map((t) => ({
        eventId: t.eventId, title: t.title, priority: t.priority, dueDate: t.dueDate,
      })),
      overdueTasks: overdueTasks.slice(0, 6).map((t) => ({
        eventId: t.eventId, title: t.title, priority: t.priority, dueDate: t.dueDate,
      })),
      criticalIssues: criticalIssues.slice(0, 6).map((i) => ({
        eventId: i.eventId, title: i.title, createdAt: i.createdAt,
      })),
    },
    recentActivity: recentActivityOwn.map((l) => ({
      id: l.id, action: l.action, summary: l.summary, createdAt: l.createdAt, userName: auth.name,
    })),
  });
});
