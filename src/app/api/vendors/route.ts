import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { serializeVendor } from '@/lib/serialize';
import { VENDOR_CATEGORIES } from '@/lib/constants';

// GET /api/vendors — company directory (contacts only, no financials here)
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('vendors.contacts.view')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.view"');
  }
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const category = url.searchParams.get('category');

  const where: Record<string, unknown> = { companyId: auth.companyId };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { contactPerson: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (category && VENDOR_CATEGORIES.includes(category as (typeof VENDOR_CATEGORIES)[number])) {
    where.category = category;
  }

  const vendors = await db.vendor.findMany({ where, orderBy: { name: 'asc' } });
  return ok({ vendors: vendors.map(serializeVendor) });
});

// POST /api/vendors — add to directory (vendors.contacts.manage)
const createSchema = z.object({
  name: z.string().trim().min(2, 'Vendor name is required'),
  contactPerson: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  category: z.enum(VENDOR_CATEGORIES),
  notes: z.string().optional().nullable(),
});

export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('vendors.contacts.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "vendors.contacts.manage"');
  }
  const body = await parseBody(req, createSchema);

  const created = await db.vendor.create({
    data: {
      companyId: auth.companyId,
      name: body.name,
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      email: body.email || null,
      category: body.category,
      notes: body.notes || null,
    },
  });
  await audit(auth, {
    action: 'vendor.created',
    entityType: 'Vendor',
    entityId: created.id,
    summary: `Added vendor "${created.name}" (${created.category}) to the directory`,
  });
  return ok({ vendor: { id: created.id } }, { status: 201 });
});
