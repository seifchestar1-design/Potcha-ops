import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializeEventVendor } from '@/lib/serialize';
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/vendors — operational view; financial fields
// stripped server-side for Operations.
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);

  const vendors = await db.eventVendor.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'asc' },
    include: { responsible: { select: { id: true, name: true } } },
  });
  return ok({ vendors: vendors.map((v) => serializeEventVendor(auth, v)) });
});

// POST /api/events/:id/vendors — engage a vendor on this event.
// Operational fields: vendors.contacts.manage (Operations by default).
// Financial fields: finance.manage (CEO / Finance only).
const createSchema = z.object({
  vendorId: z.string().optional().nullable(),
  name: z.string().trim().min(2, 'Vendor name is required'),
  category: z.enum(VENDOR_CATEGORIES),
  contactPerson: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().optional().nullable(),
  contactWhatsapp: z.string().trim().optional().nullable(),
  confirmationStatus: z.enum(VENDOR_STATUSES).default('NOT_CONTACTED'),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional().nullable(),
  setupTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  operationalNotes: z.string().optional().nullable(),
  contractAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  const body = await parseBody(req, createSchema);

  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const wantsFinancial =
    body.contractAmount !== undefined || body.depositAmount !== undefined || body.paidAmount !== undefined;
  if (wantsFinancial && !auth.perms.has('finance.manage')) {
    throw new ApiError(403, 'Forbidden: financial vendor fields require "finance.manage"');
  }

  // Vendor directory link must belong to this company
  if (body.vendorId) {
    const dir = await db.vendor.findFirst({ where: { id: body.vendorId, companyId: auth.companyId } });
    if (!dir) throw new ApiError(400, 'Vendor does not exist in this company');
  }
  if (body.responsibleId) {
    const member = await db.user.findFirst({
      where: { id: body.responsibleId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Responsible member not found in this company');
  }

  const contract = body.contractAmount ?? 0;
  const paid = body.paidAmount ?? 0;
  const created = await db.eventVendor.create({
    data: {
      eventId: event.id,
      vendorId: body.vendorId ?? null,
      name: body.name,
      category: body.category,
      contactPerson: body.contactPerson || null,
      contactPhone: body.contactPhone || null,
      contactWhatsapp: body.contactWhatsapp || null,
      confirmationStatus: body.confirmationStatus,
      arrivalTime: body.arrivalTime || null,
      setupTime: body.setupTime || null,
      responsibleId: body.responsibleId || null,
      operationalNotes: body.operationalNotes || null,
      contractAmount: contract,
      depositAmount: body.depositAmount ?? 0,
      paidAmount: paid,
      paymentStatus: paid <= 0 ? 'UNPAID' : paid >= contract ? 'FULLY_PAID' : 'PARTIAL',
    },
  });

  await audit(auth, {
    action: 'eventvendor.created',
    entityType: 'EventVendor',
    entityId: created.id,
    eventId: event.id,
    summary: `Engaged vendor "${created.name}" (${created.category}) on "${event.name}"`,
    financial: wantsFinancial,
  });
  return ok({ vendor: { id: created.id } }, { status: 201 });
});
