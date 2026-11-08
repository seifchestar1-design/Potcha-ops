import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/payments/:id — ONLY status transitions are allowed.
// Amounts, event, kind and every historical attribute are immutable;
// corrections must be recorded as reversals (see /reverse).
const patchSchema = z.object({ status: z.enum(['COMPLETED']) }).strict();

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  if (!auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "finance.manage"');
  }
  const body = await parseBody(req, patchSchema);

  const payment = await db.payment.findFirst({ where: { id, companyId: auth.companyId } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status === 'REVERSED') {
    throw new ApiError(409, 'This transaction was reversed and cannot be modified');
  }
  if (payment.status === 'COMPLETED') {
    throw new ApiError(409, 'This transaction is already completed');
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { status: 'COMPLETED', paidAt: new Date() },
  });

  // Sync engaged vendor paid amount
  if (payment.eventVendorId && payment.kind === 'VENDOR_PAYMENT') {
    const vendor = await db.eventVendor.findUnique({ where: { id: payment.eventVendorId } });
    if (vendor) {
      const newPaid = Math.min(vendor.contractAmount, vendor.paidAmount + payment.amount);
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
    action: 'payment.marked_paid',
    entityType: 'Payment',
    entityId: payment.id,
    eventId: payment.eventId,
    summary: `Marked pending transaction as paid (${payment.direction} ${payment.currency} ${payment.amount.toLocaleString('en-EG')})`,
    metadata: { amount: payment.amount },
    financial: true,
  });
  return ok({ success: true });
});

// DELETE /api/payments/:id — only PENDING plan entries can be cancelled.
// COMPLETED money movement is immutable: correct it with a reversal.
export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  if (!auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "finance.manage"');
  }
  const payment = await db.payment.findFirst({ where: { id, companyId: auth.companyId } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status !== 'PENDING') {
    throw new ApiError(409, 'Only pending plan entries can be cancelled. Completed transactions must be reversed instead.');
  }

  await db.payment.delete({ where: { id: payment.id } });
  await audit(auth, {
    action: 'payment.cancelled',
    entityType: 'Payment',
    entityId: payment.id,
    eventId: payment.eventId,
    summary: `Cancelled pending ${payment.kind === 'CLIENT_PAYMENT' ? 'client payment plan' : 'payment plan'} (${payment.currency} ${payment.amount.toLocaleString('en-EG')})`,
    metadata: { amount: payment.amount },
    financial: true,
  });
  return ok({ success: true });
});
