import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { ApiError, audit, ok, parseBody, requireSession, route } from '@/lib/api';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  const body = await parseBody(req, schema);

  const user = await db.user.findUnique({ where: { id: auth.id } });
  if (!user) throw new ApiError(401, 'Authentication required');

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, 'Current password is incorrect');

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });

  await audit(auth, {
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: user.id,
    summary: `${user.name} changed their password`,
  });
  return ok({ success: true });
});
