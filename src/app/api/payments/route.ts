import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { serializePayment } from '@/lib/serialize';
import { isOverdue } from '@/lib/finance';
import { PAYMENT_KINDS, PAYMENT_METHODS } from '@/lib/constants';
import { visibleEventsWhere } from '@/lib/event-data';

// GET /api/payments — company-wide ledger (finance.view only)
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('finance.view')) {
    throw new ApiError(403, 'Forbidden: financial data requires "finance.view"');
  }
  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId');
  const direction = url.searchParams.get('direction');
  const kind = url.searchParams.get('kind');
  const status = url.searchParams.get('status');
  const overdue = url.searchParams.get('overdue') === '1';

  const where: Record<string, unknown> = { companyId: auth.companyId };
  if (eventId) where.eventId = eventId;
  if (direction === 'INFLOW' || direction === 'OUTFLOW') where.direction = direction;
  if (kind && PAYMENT_KINDS.includes(kind as (typeof PAYMENT_KINDS)[number])) where.kind = kind;
  if (status === 'PENDING' || status === 'COMPLETED' || status === 'REVERSED') where.status = status;

  let payments = await db.payment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      event: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });
  const now = new Date();
  if (overdue) payments = payments.filter((p) => isOverdue(p, now));

  return ok({
    payments: payments.map((p) => ({ ...serializePayment(p), isOverdue: isOverdue(p, now) })),
  });
});

// POST /api/payments — record a payment (finance.manage).
// Financial audit trail: every entry is audited; corrections must go
// through POST /api/payments/:id/reverse (never silent edits).
const createSchema = z.object({
  eventId: z.string().min(1, 'Event is required'),
  direction: z.enum(['INFLOW', 'OUTFLOW']),
  kind: z.enum(PAYMENT_KINDS),
  amount: z.number().positive('Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS).default('BANK_TRANSFER'),
  reference: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(280).optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED']).default('COMPLETED'),
  dueDate: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  eventVendorId: z.string().optional().nullable(),
});

export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "finance.manage"');
  }
  const body = await parseBody(req, createSchema);

  // Tenant-safe event lookup
  const event = await db.event.findFirst({
    where: { id: body.eventId, companyId: auth.companyId },
  });
  if (!event) throw new ApiError(404, 'Event not found');

  let eventVendor = null;
  if (body.eventVendorId) {
    eventVendor = await db.eventVendor.findFirst({
      where: { id: body.eventVendorId, eventId: event.id },
    });
    if (!eventVendor) throw new ApiError(400, 'Vendor not found on this event');
    if (body.kind !== 'VENDOR_PAYMENT') {
      throw new ApiError(400, 'eventVendorId can only be linked to VENDOR_PAYMENT entries');
    }
  }

  const created = await db.payment.create({
    data: {
      companyId: auth.companyId,
      eventId: event.id,
      eventVendorId: eventVendor?.id ?? null,
      direction: body.direction,
      kind: body.kind,
      amount: body.amount,
      currency: auth.currency,
      method: body.method,
      reference: body.reference || null,
      note: body.note || null,
      status: body.status,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      paidAt: body.status === 'COMPLETED' ? (body.paidAt ? new Date(body.paidAt) : new Date()) : null,
      recordedById: auth.id,
    },
  });

  // Keep the engaged vendor's paid amount in sync with the ledger
  if (eventVendor && body.status === 'COMPLETED') {
    const newPaid = Math.min(eventVendor.contractAmount, eventVendor.paidAmount + body.amount);
    await db.eventVendor.update({
      where: { id: eventVendor.id },
      data: {
        paidAmount: newPaid,
        paymentStatus: newPaid <= 0 ? 'UNPAID' : newPaid >= eventVendor.contractAmount ? 'FULLY_PAID' : 'PARTIAL',
      },
    });
  }

  await audit(auth, {
    action: 'payment.recorded',
    entityType: 'Payment',
    entityId: created.id,
    eventId: event.id,
    summary: `Recorded ${body.kind === 'CLIENT_PAYMENT' ? 'client payment' : body.kind === 'VENDOR_PAYMENT' ? 'vendor payment' : 'expense'} ${body.direction === 'INFLOW' ? 'from' : 'to'} "${event.name}": ${auth.currency} ${body.amount.toLocaleString('en-EG')} (${body.status})`,
    metadata: { amount: body.amount, direction: body.direction, kind: body.kind, status: body.status },
    financial: true,
  });
  return ok({ payment: { id: created.id } }, { status: 201 });
});
