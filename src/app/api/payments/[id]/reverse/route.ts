import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/payments/:id/reverse — record a correction.
// Creates a NEW ledger row with a negative amount (audit-preserving),
// marks the original REVERSED, and re-syncs any linked vendor totals.
// Nothing is ever silently deleted or overwritten.
const reverseSchema = z.object({
  reason: z.string().trim().min(3, 'A reversal reason is required'),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  if (!auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "finance.manage"');
  }
  const body = await parseBody(req, reverseSchema);

  const payment = await db.payment.findFirst({ where: { id, companyId: auth.companyId } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status === 'REVERSED') throw new ApiError(409, 'This transaction is already reversed');
  if (payment.reversalOfId) throw new ApiError(409, 'A reversal entry cannot be reversed again');
  if (payment.status === 'PENDING') {
    throw new ApiError(409, 'Pending transactions are simply deleted from the plan, not reversed — cancel it instead');
  }

  const existingReversal = await db.payment.findFirst({ where: { reversalOfId: payment.id } });
  if (existingReversal) throw new ApiError(409, 'This transaction already has a reversal');

  const [reversal] = await db.$transaction([
    db.payment.create({
      data: {
        companyId: payment.companyId,
        eventId: payment.eventId,
        eventVendorId: payment.eventVendorId,
        direction: payment.direction,
        kind: payment.kind,
        amount: -payment.amount,
        currency: payment.currency,
        method: payment.method,
        reference: payment.reference,
        note: `Reversal of ${payment.note ?? payment.id}: ${body.reason}`,
        status: 'COMPLETED',
        paidAt: new Date(),
        recordedById: auth.id,
        reversalOfId: payment.id,
      },
    }),
    db.payment.update({ where: { id: payment.id }, data: { status: 'REVERSED' } }),
  ]);

  // Re-sync linked vendor paid amount
  if (payment.eventVendorId && payment.kind === 'VENDOR_PAYMENT') {
    const vendor = await db.eventVendor.findUnique({ where: { id: payment.eventVendorId } });
    if (vendor) {
      const newPaid = Math.max(0, vendor.paidAmount - payment.amount);
      await db.eventVendor.update({
        where: { id: vendor.id },
        data: {
          paidAmount: newPaid,
          paymentStatus: newPaid <= 0 ? 'UNPAID' : newPaid >= vendor.contractAmount ? 'FULLY_PAID' : 'PARTIAL',
        },
      });
    }
  }

  await audit(auth, {
    action: 'payment.reversed',
    entityType: 'Payment',
    entityId: payment.id,
    eventId: payment.eventId,
    summary: `Reversed transaction (${payment.direction} ${payment.currency} ${payment.amount.toLocaleString('en-EG')}) — ${body.reason}`,
    metadata: { originalId: payment.id, reversalId: reversal.id, reason: body.reason },
    financial: true,
  });
  return ok({ reversal: { id: reversal.id } }, { status: 201 });
});
