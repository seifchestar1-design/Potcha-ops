// Potcha Ops — Prisma client for Cloudflare Workers (Hyperdrive + driver adapter).
//
// Deploy-time replacement for src/lib/db.ts — see docs/CLOUDFLARE.md Part 3:
//   cp cloudflare/db.workers.ts src/lib/db.ts
// (The original is preserved at cloudflare/db.standard.ts — copy it back to
//  return to standard SQLite/Postgres-engine development.)
//
// Requirements (added automatically by deploy.sh, or by the `bun add` step
// in docs/CLOUDFLARE.md Part 3):
//   - `bun run cf:generate` → generates the client into gen/prisma/
//     (prisma/schema.workers.prisma uses the new `prisma-client` generator,
//      which runs through a driver adapter instead of Prisma's native engine)
//   - @prisma/adapter-pg     → PostgreSQL driver adapter
//   - @opennextjs/cloudflare → getCloudflareContext() exposes the HYPERDRIVE binding
//
// NOTE: the import paths below are relative to its DESTINATION (src/lib/db.ts),
// not to this cloudflare/ folder.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../gen/prisma/client';

type GlobalForPrisma = { potchaWorkersDb?: PrismaClient };

const globalForPrisma = globalThis as unknown as GlobalForPrisma;

async function createDb(): Promise<PrismaClient> {
  if (globalForPrisma.potchaWorkersDb) return globalForPrisma.potchaWorkersDb;

  // On Workers: the HYPERDRIVE binding provides a pooled connection string
  // (injected by Cloudflare — the real database password never ships in the
  // Worker). In local preview (opennextjs-cloudflare preview) it falls back to
  // DATABASE_URL from .dev.vars (see cloudflare/.dev.vars.example).
  let connectionString: string | undefined;
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as { HYPERDRIVE?: { connectionString?: string } } | undefined;
    connectionString = env?.HYPERDRIVE?.connectionString;
  } catch {
    // Not inside the Cloudflare runtime (e.g. during `next build`) — fall through.
  }
  if (!connectionString) {
    connectionString = process.env.DATABASE_URL;
  }
  if (!connectionString) {
    throw new Error(
      'Database not configured: expected the HYPERDRIVE binding (Cloudflare runtime) or DATABASE_URL (local preview). See docs/CLOUDFLARE.md.'
    );
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['error', 'warn'],
  });
  globalForPrisma.potchaWorkersDb = client;
  return client;
}

// LAZY BY DESIGN — important:
// `next build` imports every route module (and therefore this file) while
// collecting page data. At that moment there is no Hyperdrive binding and,
// on a fresh checkout, no DATABASE_URL either — so nothing here may connect
// or throw at import time. `db` is a Proxy that creates the real client on
// the first actual method call, by which point this code is running inside
// the Workers runtime where HYPERDRIVE exists.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return async (...args: unknown[]) => {
      const client = await createDb();
      const method = (client as unknown as Record<string | symbol, (...a: unknown[]) => unknown>)[
        prop
      ];
      return method.apply(client, args);
    };
  },
});
