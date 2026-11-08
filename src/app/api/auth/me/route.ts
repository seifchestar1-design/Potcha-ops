import { getAuth } from '@/lib/auth';
import { ok, route } from '@/lib/api';

export const GET = route(async (req: Request) => {
  const auth = await getAuth(req);
  if (!auth) return ok({ user: null }, { status: 401 });
  return ok({
    user: {
      id: auth.id,
      name: auth.name,
      email: auth.email,
      phone: auth.phone,
      role: auth.role,
      companyId: auth.companyId,
      companyName: auth.companyName,
      currency: auth.currency,
      dateFormat: auth.dateFormat,
      isDemoCompany: auth.isDemoCompany,
      perms: [...auth.perms],
    },
  });
});
