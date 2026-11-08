/**
 * Potcha Ops — repeatable security audit
 * Usage: bun run scripts/security-audit.ts
 *
 * Proves, against the running app (http://localhost:3000):
 *  1. Operations cannot read financial data.
 *  2. Finance cannot modify CEO/team permissions or company settings.
 *  3. CEO can access authorized company-wide information.
 *  4. Users cannot access another company's data (tenant isolation).
 *  5. Unauthenticated callers cannot bypass permissions via direct API calls.
 *  6. Financial transactions cannot be silently deleted or rewritten.
 */

const BASE = process.env.APP_URL ?? 'http://localhost:3000';

type Jar = { cookie: string; userId?: string; companyId?: string };

let passed = 0;
let failed = 0;

function report(name: string, ok: boolean, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? '✅' : '❌'} [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(path: string, jar?: Jar, opts: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(jar?.cookie ? { cookie: jar.cookie } : {}),
      ...(opts.headers ?? {}),
    },
  });
  let body: any = {};
  try {
    body = await res.json();
  } catch { /* empty */ }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && jar) jar.cookie = setCookie.split(';')[0];
  return { status: res.status, body };
}

async function login(email: string, password: string): Promise<Jar> {
  const jar: Jar = { cookie: '' };
  const { status, body } = await req('/auth/login', jar, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200) throw new Error(`Login failed for ${email}: ${body?.error}`);
  return jar;
}

async function main() {
  console.log('\nPotcha Ops — security audit');
  console.log('='.repeat(60));

  // Ensure a fresh demo environment (also proves the reset endpoint works)
  console.log('\nSetup: resetting demo environment');
  const reset = await req('/demo/reset', undefined, { method: 'POST' });
  report('demo reset endpoint', reset.status === 200 && Array.isArray(reset.body.accounts));

  const ceo = await login('ceo@potchaops.demo', 'Demo@1234');
  const finance = await login('finance@potchaops.demo', 'Demo@1234');
  const ops = await login('ops@potchaops.demo', 'Demo@1234');
  report('all three demo roles can authenticate', true);

  const events = (await req('/events', ceo)).body.events;
  const upcoming = events.find((e: any) => e.name.includes('Youssef'));
  const assignedToOps = events.find((e: any) => e.name.includes('Karim'));
  const notAssignedToOps = events.find((e: any) => e.name.includes('Omar'));

  // ---------------------------------------------------------- 1. Operations
  console.log('\n1) Operations cannot read financial data');
  {
    const payments = await req('/payments', ops);
    report('GET /api/payments → 403', payments.status === 403);

    const fin = await req(`/events/${assignedToOps.id}/finance`, ops);
    report('GET event finance tab → 403', fin.status === 403);

    const event = (await req(`/events/${assignedToOps.id}`, ops)).body.event;
    report('event serializer strips contractValue', !('contractValue' in event));
    report('event serializer strips financials', event.financials === null || event.financials === undefined);

    const vendors = (await req(`/events/${assignedToOps.id}/vendors`, ops)).body.vendors;
    report('vendor serializer strips contractAmount', vendors.every((v: any) => !('contractAmount' in v)));

    const record = await req('/payments', ops, {
      method: 'POST',
      body: JSON.stringify({ eventId: upcoming.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 100 }),
    });
    report('POST /api/payments as Operations → 403', record.status === 403);
  }

  // ------------------------------------------------ 2. Finance restrictions
  console.log('\n2) Finance cannot modify CEO permissions / administration');
  {
    const team = await req('/team', finance);
    report('GET /api/team as Finance → 403', team.status === 403);

    const ceoUser = (await req('/team', ceo)).body.members.find((m: any) => m.role === 'CEO');
    const promote = await req(`/team/${ceoUser.id}`, finance, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'OPERATIONS' }),
    });
    report('PATCH team member as Finance → 403', promote.status === 403);

    const settings = await req('/settings', finance, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacked Co' }),
    });
    report('PATCH company settings as Finance → 403', settings.status === 403);

    const grants = await req(`/team/${ceoUser.id}`, finance, {
      method: 'PATCH',
      body: JSON.stringify({ extraPerms: ['team.manage'] }),
    });
    report('grant permissions as Finance → 403', grants.status === 403);
  }

  // ------------------------------------------------------ 3. CEO full access
  console.log('\n3) CEO can access authorized company-wide information');
  {
    const dash = await req('/dashboard', ceo);
    report('CEO dashboard → 200 with full KPIs', dash.status === 200 && 'totalContractedRevenue' in dash.body.kpis);

    const team = await req('/team', ceo);
    report('CEO team management → 200', team.status === 200 && team.body.members.length >= 4);

    const fin = await req(`/events/${upcoming.id}/finance`, ceo);
    report('CEO event finance → 200 with ledger', fin.status === 200 && Array.isArray(fin.body.payments));

    const audit = await req('/audit', ceo);
    report('CEO audit log → 200, company scope', audit.status === 200 && audit.body.scope === 'company');
  }

  // -------------------------------------------------- 4. Tenant isolation
  console.log('\n4) Users cannot access another company\'s data');
  {
    // Register a second, isolated company
    const suffix = Date.now().toString(36);
    const reg: { status: number; body: any } = await req('/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({
        companyName: `Rival Co ${suffix}`,
        name: 'Rival CEO',
        email: `rival-${suffix}@example.com`,
        password: 'Rival@12345',
        currency: 'EGP',
      }),
    });
    report('second company registered', reg.status === 201);
    const rivalJar: Jar = { cookie: '' };
    const rivalLogin = await req('/auth/login', rivalJar, {
      method: 'POST',
      body: JSON.stringify({ email: `rival-${suffix}@example.com`, password: 'Rival@12345`' .replace('`', '') }),
    });
    report('second company CEO authenticated', rivalLogin.status === 200);

    const crossEvent = await req(`/events/${upcoming.id}`, rivalJar);
    report('cross-company event access → 404 (existence not leaked)', crossEvent.status === 404);

    const crossFinance = await req(`/events/${upcoming.id}/finance`, rivalJar);
    report('cross-company finance access → 404', crossFinance.status === 404);

    const crossPatch = await req(`/events/${upcoming.id}`, rivalJar, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Stolen Event' }),
    });
    report('cross-company event edit → 404', crossPatch.status === 404);

    const crossPayment = await req('/payments', rivalJar, {
      method: 'POST',
      body: JSON.stringify({ eventId: upcoming.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 500 }),
    });
    report('cross-company payment injection → 404', crossPayment.status === 404);

    const rivalEvents = (await req('/events', rivalJar)).body.events;
    report('rival sees only own (empty) event list', rivalEvents.length === 0);

    // assigned-event rule for Operations inside one company
    const unassigned = await req(`/events/${notAssignedToOps.id}`, ops);
    report('Operations user blocked from unassigned event → 404', unassigned.status === 404);
  }

  // --------------------------------------- 5. Unauthenticated API access
  console.log('\n5) Unauthenticated callers cannot bypass permissions');
  {
    const noAuth = await req('/dashboard');
    report('GET /api/dashboard without session → 401', noAuth.status === 401);

    const noAuthPayments = await req('/payments');
    report('GET /api/payments without session → 401', noAuthPayments.status === 401);

    const forged = await req('/events', { cookie: 'potcha_session=forge'.repeat(8) });
    report('forged session cookie → 401', forged.status === 401);

    const badBody = await req('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email: 'ceo@potchaops.demo', password: 'wrong-password' }),
    });
    report('wrong password rejected (401)', badBody.status === 401);

    const injection = await req(`/events/${upcoming.id}/vendors`, ops, {
      method: 'POST',
      body: JSON.stringify({ name: 'X', category: 'NOT_A_CATEGORY' }),
    });
    report('enum injection rejected (400)', injection.status === 400);
  }

  // --------------------------------- 6. Immutable financial transactions
  console.log('\n6) Financial transactions cannot be silently deleted or rewritten');
  {
    // Record a completed payment as Finance
    const created = await req('/payments', finance, {
      method: 'POST',
      body: JSON.stringify({
        eventId: upcoming.id,
        direction: 'INFLOW',
        kind: 'CLIENT_PAYMENT',
        amount: 12345,
        method: 'CASH',
        note: 'SECURITY-AUDIT test transaction',
        status: 'COMPLETED',
      }),
    });
    report('completed transaction recorded', created.status === 201);
    const pid = created.body.payment.id;

    const rewrite = await req(`/payments/${pid}`, finance, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', amount: 1 }),
    });
    report('attempt to rewrite amount → schema-rejected', rewrite.status === 400);

    const del = await req(`/payments/${pid}`, finance, { method: 'DELETE' });
    report('DELETE completed transaction → 409', del.status === 409);

    // Ops attempts the same
    const delOps = await req(`/payments/${pid}`, ops, { method: 'DELETE' });
    report('DELETE by Operations → 403', delOps.status === 403);

    // Proper correction = reversal entry (original preserved)
    const reverse = await req(`/payments/${pid}/reverse`, finance, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Security audit: verifying reversal flow' }),
    });
    report('reversal recorded (201)', reverse.status === 201);

    const ledger = (await req(`/events/${upcoming.id}/finance`, finance)).body.payments;
    const original = ledger.find((p: any) => p.id === pid);
    const reversal = ledger.find((p: any) => p.reversalOfId === pid);
    report('original preserved and marked REVERSED', original?.status === 'REVERSED');
    report('corrective negative entry exists', reversal?.amount === -12345);

    const reReverse = await req(`/payments/${pid}/reverse`, finance, {
      method: 'POST',
      body: JSON.stringify({ reason: 'double reversal attempt' }),
    });
    report('double reversal blocked → 409', reReverse.status === 409);

    const delReversed = await req(`/payments/${pid}`, finance, { method: 'DELETE' });
    report('DELETE reversed original still blocked → 409', delReversed.status === 409);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  // Leave a clean demo environment behind
  await req('/demo/reset', undefined, { method: 'POST' });
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Security audit crashed:', e);
  process.exit(1);
});
