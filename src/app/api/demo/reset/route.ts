import { seedDemo } from '@/lib/seed';
import { ok, route } from '@/lib/api';

// Resets the demo company (deletes ALL demo data, reseeds fresh).
// Only touches companies flagged isDemo=true — real companies untouched.
export const POST = route(async () => {
  const { companyId } = await seedDemo();
  return ok({
    success: true,
    companyId,
    accounts: [
      { role: 'ADMIN', email: 'admin@potchaops.demo', password: 'Demo@1234' },
      { role: 'CEO', email: 'ceo@potchaops.demo', password: 'Demo@1234' },
      { role: 'Finance', email: 'finance@potchaops.demo', password: 'Demo@1234' },
      { role: 'Operations', email: 'ops@potchaops.demo', password: 'Demo@1234' },
      { role: 'Operations', email: 'ops2@potchaops.demo', password: 'Demo@1234' },
    ],
  });
});
