import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { VENDOR_CATEGORIES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  contactPerson: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  category: z.enum(VENDOR_CATEGORIES).optional(),
  notes: z.string().nullable().optional(),
});

async function loadVendor(auth: Parameters<typeof requireSession>[0], id: string) {
  const vendor = await db.vendor.findFirst({ where: { id, companyId: auth.companyId } });
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  return vendor;
}

// PATCH /api/vendors/:id
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const vendor = await loadVendor(auth, id);
  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const body = await parseBody(req, patchSchema);

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) data[k] = v === '' ? null : v;
  }
  const updated = await db.vendor.update({ where: { id: vendor.id }, data });
  await audit(auth, {
    action: 'vendor.updated',
    entityType: 'Vendor',
    entityId: vendor.id,
    summary: `Updated vendor "${updated.name}"`,
  });
  return ok({ success: true });
});

// DELETE /api/vendors/:id — only if not engaged on any event
export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const vendor = await loadVendor(auth, id);
  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const engaged = await db.eventVendor.count({ where: { vendorId: vendor.id } });
  if (engaged > 0) {
    throw new ApiError(409, `This vendor is engaged on ${engaged} event(s). Remove them from those events first.`);
  }
  await db.vendor.delete({ where: { id: vendor.id } });
  await audit(auth, {
    action: 'vendor.deleted',
    entityType: 'Vendor',
    entityId: vendor.id,
    summary: `Deleted vendor "${vendor.name}" from the directory`,
  });
  return ok({ success: true });
});
