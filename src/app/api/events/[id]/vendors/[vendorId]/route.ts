import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string; vendorId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  category: z.enum(VENDOR_CATEGORIES).optional(),
  contactPerson: z.string().trim().nullable().optional(),
  contactPhone: z.string().trim().nullable().optional(),
  contactWhatsapp: z.string().trim().nullable().optional(),
  confirmationStatus: z.enum(VENDOR_STATUSES).optional(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  setupTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  operationalNotes: z.string().nullable().optional(),
  contractAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
});

async function loadEventVendor(auth: Parameters<typeof requireEventAccess>[0], eventId: string, vendorId: string) {
  const event = await requireEventAccess(auth, eventId);
  const vendor = await db.eventVendor.findFirst({
    where: { id: vendorId, eventId: event.id, event: { companyId: auth.companyId } },
  });
  if (!vendor) throw new ApiError(404, 'Vendor not found on this event');
  return { event, vendor };
}

// PATCH /api/events/:id/vendors/:vendorId
export const PATCH = route<{ id: string; vendorId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, vendorId } = await ctx.params;
  const { event, vendor } = await loadEventVendor(auth, id, vendorId);
  const body = await parseBody(req, patchSchema);

  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const financialKeys = ['contractAmount', 'depositAmount', 'paidAmount'] as const;
  const wantsFinancial = financialKeys.some((k) => (body as Record<string, unknown>)[k] !== undefined);
  if (wantsFinancial && !auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: financial vendor fields require "finance.manage"');
  }

  if (body.responsibleId) {
    const member = await db.user.findFirst({
      where: { id: body.responsibleId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Responsible member not found in this company');
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) data[k] = v === '' ? null : v;
  }

  const contract = (data.contractAmount as number) ?? vendor.contractAmount;
  const paid = (data.paidAmount as number) ?? vendor.paidAmount;
  if (wantsFinancial) {
    data.paymentStatus = paid <= 0 ? 'UNPAID' : paid >= contract ? 'FULLY_PAID' : 'PARTIAL';
  }

  const updated = await db.eventVendor.update({ where: { id: vendor.id }, data });

  await audit(auth, {
    action: 'eventvendor.updated',
    entityType: 'EventVendor',
    entityId: vendor.id,
    eventId: event.id,
    summary: `Updated vendor "${updated.name}" on "${event.name}"${wantsFinancial ? ' (incl. financial fields)' : ''}`,
    financial: wantsFinancial,
  });
  return ok({ success: true });
});

// DELETE /api/events/:id/vendors/:vendorId — remove from event.
// Guard: vendors with completed payments cannot be removed silently; they
// must be cancelled instead (financial trail stays in the ledger).
export const DELETE = route<{ id: string; vendorId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, vendorId } = await ctx.params;
  const { event, vendor } = await loadEventVendor(auth, id, vendorId);

  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const paidTotal = await db.payment.aggregate({
    where: { eventVendorId: vendor.id, status: 'COMPLETED', direction: 'OUTFLOW' },
    _sum: { amount: true },
  });
  if ((paidTotal._sum.amount ?? 0) > 0 && !auth.perms.has('finance.manage')) {
    throw new ApiError(409, 'This vendor has recorded payments. Mark the vendor as CANCELLED instead of deleting.');
  }

  await db.eventVendor.delete({ where: { id: vendor.id } });
  await audit(auth, {
    action: 'eventvendor.deleted',
    entityType: 'EventVendor',
    entityId: vendor.id,
    eventId: event.id,
    summary: `Removed vendor "${vendor.name}" from "${event.name}"`,
    financial: (paidTotal._sum.amount ?? 0) > 0,
  });
  return ok({ success: true });
});
