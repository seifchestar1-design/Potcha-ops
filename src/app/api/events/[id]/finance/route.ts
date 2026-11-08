import { db } from '@/lib/db';
import {
  ApiError, ok, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializePayment } from '@/lib/serialize';
import { computeFinancialsForEvents } from '@/lib/event-data';
import { isOverdue } from '@/lib/finance';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/finance — budgets, ledger & margins.
// CEO / Finance only (finance.view). Operations receive 403.
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('finance.view')) {
    throw new ApiError(403, 'Forbidden: financial data requires "finance.view"');
  }

  const [payments, vendors, finMap] = await Promise.all([
    db.payment.findMany({
      where: { eventId: event.id },
      orderBy: [{ createdAt: 'desc' }],
      include: { recordedBy: { select: { id: true, name: true } }, reversalOf: { select: { id: true, note: true } } },
    }),
    db.eventVendor.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, category: true, contractAmount: true, depositAmount: true, paidAmount: true, paymentStatus: true, confirmationStatus: true },
    }),
    computeFinancialsForEvents([event]),
  ]);

  const now = new Date();
  return ok({
    financials: finMap.get(event.id) ?? null,
    vendors,
    payments: payments.map((p) => ({
      ...serializePayment(p),
      isOverdue: isOverdue(p, now),
      reversesNote: p.reversalOf?.note ?? null,
    })),
  });
});
