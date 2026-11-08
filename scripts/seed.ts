// Seed / reset the Potcha Ops demo environment.
// Usage: bun run db:seed
import { seedDemo } from '../src/lib/seed';

seedDemo()
  .then(({ companyId }) => {
    console.log('✔ Demo company seeded:', companyId);
    console.log('  CEO:        ceo@potchaops.demo / Demo@1234');
    console.log('  Finance:    finance@potchaops.demo / Demo@1234');
    console.log('  Operations: ops@potchaops.demo / Demo@1234');
    console.log('  Operations: ops2@potchaops.demo / Demo@1234');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
