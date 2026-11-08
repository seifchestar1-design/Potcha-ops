// Potcha Ops — demo environment seed
// Creates (or resets) a fully fictional Egyptian wedding-planning company
// with 5 events, 12 vendors, financial ledger, tasks, run sheets, issues,
// documents, notices and audit history. All names/contacts are fictional.

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const DEMO_EMAILS = {
  admin: 'admin@potchaops.demo',
  ceo: 'ceo@potchaops.demo',
  finance: 'finance@potchaops.demo',
  ops: 'ops@potchaops.demo',
  ops2: 'ops2@potchaops.demo',
  invited: 'invited@potchaops.demo',
};

export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: DEMO_EMAILS.admin, password: 'Demo@1234', name: 'Potcha Admin' },
  { role: 'CEO', email: DEMO_EMAILS.ceo, password: 'Demo@1234', name: 'Amira Hassan' },
  { role: 'Finance', email: DEMO_EMAILS.finance, password: 'Demo@1234', name: 'Tarek Mansour' },
  { role: 'Operations', email: DEMO_EMAILS.ops, password: 'Demo@1234', name: 'Dina Farouk' },
  { role: 'Operations', email: DEMO_EMAILS.ops2, password: 'Demo@1234', name: 'Hassan Adel' },
];

const D = (days: number, hours = 12): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d;
};

export async function seedDemo(): Promise<{ companyId: string }> {
  // Full reset, explicit dependency order (deterministic across schemas)
  const demoCompanies = await db.company.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = demoCompanies.map((c) => c.id);
  if (ids.length > 0) {
    await db.session.deleteMany({ where: { user: { companyId: { in: ids } } } });
    await db.taskComment.deleteMany({ where: { task: { companyId: { in: ids } } } });
    await db.document.deleteMany({ where: { companyId: { in: ids } } });
    await db.payment.deleteMany({ where: { companyId: { in: ids }, reversalOfId: { not: null } } });
    await db.payment.deleteMany({ where: { companyId: { in: ids } } });
    await db.task.deleteMany({ where: { companyId: { in: ids } } });
    await db.runSheetItem.deleteMany({ where: { event: { companyId: { in: ids } } } });
    await db.issue.deleteMany({ where: { companyId: { in: ids } } });
    await db.eventVendor.deleteMany({ where: { event: { companyId: { in: ids } } } });
    await db.eventAssignment.deleteMany({ where: { event: { companyId: { in: ids } } } });
    await db.event.deleteMany({ where: { companyId: { in: ids } } });
    await db.vendor.deleteMany({ where: { companyId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { companyId: { in: ids } } });
    await db.notice.deleteMany({ where: { companyId: { in: ids } } });
    await db.user.deleteMany({ where: { companyId: { in: ids } } });
    await db.company.deleteMany({ where: { id: { in: ids } } });
  }

  // ---------------------------------------------------------------- platform admin
  // The platform ADMIN (subscriber management) lives in its own internal
  // "Potcha Platform" container company — never a subscriber, never touched
  // by demo resets. Created once, then survives every reset.
  const [pwHash] = await Promise.all([hashPassword('Demo@1234')]);
  let platform = await db.company.findFirst({ where: { isPlatform: true } });
  if (!platform) {
    platform = await db.company.create({
      data: { name: 'Potcha Platform', isPlatform: true, plan: 'PLATFORM', maxEvents: 0, maxTeamMembers: 0 },
    });
  }
  const adminExists = await db.user.findUnique({ where: { email: DEMO_EMAILS.admin } });
  if (!adminExists) {
    await db.user.create({
      data: {
        companyId: platform.id, name: 'Potcha Admin', email: DEMO_EMAILS.admin,
        passwordHash: pwHash, role: 'ADMIN', status: 'ACTIVE',
      },
    });
  }

  const company = await db.company.create({
    data: {
      name: 'Lotus & Nile Weddings Co.',
      currency: 'EGP',
      dateFormat: 'DD/MM/YYYY',
      plan: 'GROWTH',
      isDemo: true,
      // Platform-admin quotas for the demo subscriber: 5 events + 4 members
      // in use, so the limits are visible but never in the way.
      maxEvents: 10,
      maxTeamMembers: 6,
    },
  });
  const cid = company.id;

  // ---------------------------------------------------------------- team

  const ceo = await db.user.create({
    data: {
      companyId: cid, name: 'Amira Hassan', email: DEMO_EMAILS.ceo,
      phone: '+20 100 111 2233', passwordHash: pwHash, role: 'CEO', status: 'ACTIVE',
      lastLoginAt: D(-1, 9),
    },
  });
  const finance = await db.user.create({
    data: {
      companyId: cid, name: 'Tarek Mansour', email: DEMO_EMAILS.finance,
      phone: '+20 100 222 3344', passwordHash: pwHash, role: 'FINANCE', status: 'ACTIVE',
      lastLoginAt: D(-1, 10),
    },
  });
  const dina = await db.user.create({
    data: {
      companyId: cid, name: 'Dina Farouk', email: DEMO_EMAILS.ops,
      phone: '+20 100 333 4455', passwordHash: pwHash, role: 'OPERATIONS', status: 'ACTIVE',
      lastLoginAt: D(0, 8),
    },
  });
  const hassan = await db.user.create({
    data: {
      companyId: cid, name: 'Hassan Adel', email: DEMO_EMAILS.ops2,
      phone: '+20 100 444 5566', passwordHash: pwHash, role: 'OPERATIONS', status: 'ACTIVE',
      lastLoginAt: D(-2, 16),
    },
  });
  await db.user.create({
    data: {
      companyId: cid, name: 'Laila Sabri', email: DEMO_EMAILS.invited,
      phone: '+20 100 555 6677', passwordHash: pwHash, role: 'OPERATIONS', status: 'INVITED',
    },
  });

  // ---------------------------------------------------------------- events
  const e1 = await db.event.create({
    data: {
      companyId: cid, name: 'Youssef & Mariam — Grand Nile Wedding',
      clientName: 'Youssef Khalil & Mariam Sherif',
      clientPhone: '+20 101 200 3001', clientEmail: 'youssef.mariam@example.com',
      eventDate: D(21, 19), venue: 'The Grand Nile Ballroom',
      venueAddress: '12 Garden Island St., Garden City, Cairo',
      guestCount: 420, eventType: 'WEDDING',
      contractValue: 850000, additionalRevenue: 65000,
      status: 'IN_PREPARATION', plannerId: ceo.id,
      notes: 'Couple wants a classic Nile-view zaffa with live takht band. Final installment due 5 days before the event.',
    },
  });
  const e2 = await db.event.create({
    data: {
      companyId: cid, name: 'Omar & Salma — North Coast Reception',
      clientName: 'Omar Fathy & Salma Abdel Rahman',
      clientPhone: '+20 101 200 3002', clientEmail: 'omar.salma@example.com',
      eventDate: D(45, 20), venue: 'Azure Beach Club',
      venueAddress: 'Km 82 North Coast Road, Marina 7',
      guestCount: 250, eventType: 'RECEPTION',
      contractValue: 1450000, additionalRevenue: 0,
      status: 'CONFIRMED', plannerId: ceo.id,
      notes: 'Destination reception. Requires beach permit and guest transport from Cairo.',
    },
  });
  const e3 = await db.event.create({
    data: {
      companyId: cid, name: 'Karim & Nour — Garden Zaffa',
      clientName: 'Karim Mansi & Nour El-Sayed',
      clientPhone: '+20 101 200 3003', clientEmail: 'karim.nour@example.com',
      eventDate: D(10, 19), venue: 'The Palm Garden Venue',
      venueAddress: '45 Southern 90 St., New Cairo',
      guestCount: 180, eventType: 'WEDDING',
      contractValue: 420000, additionalRevenue: 18000,
      status: 'IN_PREPARATION', plannerId: dina.id,
      notes: 'Outdoor garden zaffa. Backup generator is mandatory — venue power is limited.',
    },
  });
  const e4 = await db.event.create({
    data: {
      companyId: cid, name: 'Hany & Dahlia — Zamalek Wedding',
      clientName: 'Hani Safwat & Dahlia Kamal',
      clientPhone: '+20 101 200 3004', clientEmail: 'hany.dahlia@example.com',
      eventDate: D(-21, 19), venue: 'Zamalek Riverside Hall',
      venueAddress: '8 Hassan Sabry St., Zamalek, Cairo',
      guestCount: 300, eventType: 'WEDDING',
      contractValue: 950000, additionalRevenue: 30000,
      status: 'COMPLETED', plannerId: ceo.id,
      notes: 'Delivered successfully. Client referred two new leads.',
    },
  });
  const e5 = await db.event.create({
    data: {
      companyId: cid, name: 'Mostafa & Aya — Proposal',
      clientName: 'Mostafa Rashed & Aya Habib',
      clientPhone: '+20 101 200 3005', clientEmail: 'mostafa.aya@example.com',
      eventDate: D(90, 19), venue: null, venueAddress: null,
      guestCount: 200, eventType: 'WEDDING',
      contractValue: 600000, additionalRevenue: 0,
      status: 'PROPOSAL_SENT', plannerId: ceo.id,
      notes: 'Lead from Hany & Dahlia referral. Awaiting proposal decision.',
    },
  });

  // assignments (Operations visibility)
  const assign = (eventId: string, userId: string, roleNote: string) =>
    db.eventAssignment.create({ data: { eventId, userId, roleNote } });
  await assign(e1.id, dina.id, 'Lead coordinator');
  await assign(e1.id, hassan.id, 'Floor manager');
  await assign(e2.id, hassan.id, 'Lead coordinator');
  await assign(e3.id, dina.id, 'Lead coordinator');
  await assign(e4.id, dina.id, 'Coordinator');

  // ---------------------------------------------------------------- vendors
  const vendorDefs = [
    { name: 'Nile Grand Venues', contactPerson: 'Sherif Zaki', phone: '+20 122 401 5501', whatsapp: '+20 122 401 5501', email: 'bookings@nilegrand.example', category: 'VENUE' },
    { name: 'Azure Beach Venues', contactPerson: 'Marwa Lotfy', phone: '+20 122 401 5502', whatsapp: '+20 122 401 5502', email: 'events@azurebeach.example', category: 'VENUE' },
    { name: 'Cairo Feast Catering', contactPerson: 'Chef Wael Nabil', phone: '+20 122 401 5503', whatsapp: '+20 122 401 5503', email: 'wael@cairofeast.example', category: 'CATERING' },
    { name: 'Lens & Light Studio', contactPerson: 'Nourhan Adel', phone: '+20 122 401 5504', whatsapp: '+20 122 401 5504', email: 'hello@lenslight.example', category: 'PHOTOGRAPHY' },
    { name: 'Memory Reel Films', contactPerson: 'Seif El-Din', phone: '+20 122 401 5505', whatsapp: '+20 122 401 5505', email: 'book@memoryreel.example', category: 'VIDEOGRAPHY' },
    { name: 'Velvet Rose Decor', contactPerson: 'Rania Fahmy', phone: '+20 122 401 5506', whatsapp: '+20 122 401 5506', email: 'rania@velvetrose.example', category: 'DECORATION' },
    { name: 'Bloom District', contactPerson: 'Yara Samir', phone: '+20 122 401 5507', whatsapp: '+20 122 401 5507', email: 'orders@bloomdistrict.example', category: 'FLOWERS' },
    { name: 'Beacon Lighting Co.', contactPerson: 'Tamer Guirguis', phone: '+20 122 401 5508', whatsapp: '+20 122 401 5508', email: 'ops@beaconlight.example', category: 'LIGHTING' },
    { name: 'Echo Pro Audio', contactPerson: 'Mina Salib', phone: '+20 122 401 5509', whatsapp: '+20 122 401 5509', email: 'mina@echopro.example', category: 'SOUND' },
    { name: 'Zaffa Troupe Cairo', contactPerson: 'Master Sherbini', phone: '+20 122 401 5510', whatsapp: '+20 122 401 5510', email: 'zaffa@troupe.example', category: 'ENTERTAINMENT' },
    { name: 'Apex Stage Systems', contactPerson: 'Hussein Farag', phone: '+20 122 401 5511', whatsapp: '+20 122 401 5511', email: 'hussein@apexstage.example', category: 'STAGE_PRODUCTION' },
    { name: 'Chic Furniture Rentals', contactPerson: 'Dalia Emad', phone: '+20 122 401 5512', whatsapp: '+20 122 401 5512', email: 'rent@chicfurniture.example', category: 'FURNITURE' },
    { name: 'Go Limousine Egypt', contactPerson: 'Ashraf Botros', phone: '+20 122 401 5513', whatsapp: '+20 122 401 5513', email: 'fleet@golimo.example', category: 'TRANSPORTATION' },
  ];
  const vendors: Record<string, string> = {};
  for (const v of vendorDefs) {
    const created = await db.vendor.create({ data: { companyId: cid, ...v } });
    vendors[v.name] = created.id;
  }

  // ------------------------------------------------- event vendor engagements
  type EV = {
    eventId: string; vendorKey?: string; name: string; category: string;
    contractAmount: number; depositAmount: number; paidAmount: number;
    confirmationStatus: string; arrivalTime?: string; setupTime?: string;
    responsibleId?: string; operationalNotes?: string; contactPhone?: string;
  };
  const payStatus = (contract: number, paid: number) =>
    paid <= 0 ? 'UNPAID' : paid >= contract ? 'FULLY_PAID' : 'PARTIAL';

  const evDefs: EV[] = [
    // E1 — Youssef & Mariam
    { eventId: e1.id, vendorKey: 'Nile Grand Venues', name: 'Nile Grand Venues', category: 'VENUE', contractAmount: 250000, depositAmount: 125000, paidAmount: 125000, confirmationStatus: 'CONFIRMED', arrivalTime: '10:00', setupTime: '10:00', responsibleId: dina.id, operationalNotes: 'Ballroom access from 10:00. Freight elevator card at security desk.', contactPhone: '+20 122 401 5501' },
    { eventId: e1.id, vendorKey: 'Cairo Feast Catering', name: 'Cairo Feast Catering', category: 'CATERING', contractAmount: 180000, depositAmount: 90000, paidAmount: 90000, confirmationStatus: 'CONFIRMED', arrivalTime: '14:00', setupTime: '15:00', responsibleId: hassan.id, operationalNotes: 'Final guest count due 48h before. Halal kitchen certified.', contactPhone: '+20 122 401 5503' },
    { eventId: e1.id, vendorKey: 'Lens & Light Studio', name: 'Lens & Light Studio', category: 'PHOTOGRAPHY', contractAmount: 70000, depositAmount: 35000, paidAmount: 35000, confirmationStatus: 'CONFIRMED', arrivalTime: '15:00', responsibleId: dina.id, operationalNotes: 'Pre-shoot at 16:00 with couple. Second shooter confirmed.', contactPhone: '+20 122 401 5504' },
    { eventId: e1.id, vendorKey: 'Memory Reel Films', name: 'Memory Reel Films', category: 'VIDEOGRAPHY', contractAmount: 55000, depositAmount: 27500, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '14:30', responsibleId: dina.id, operationalNotes: 'Drone flight needs venue written approval.', contactPhone: '+20 122 401 5505' },
    { eventId: e1.id, vendorKey: 'Velvet Rose Decor', name: 'Velvet Rose Decor', category: 'DECORATION', contractAmount: 95000, depositAmount: 47500, paidAmount: 47500, confirmationStatus: 'CONFIRMED', arrivalTime: '11:00', setupTime: '11:30', responsibleId: hassan.id, operationalNotes: 'Ceiling draping rig requires venue engineer sign-off.', contactPhone: '+20 122 401 5506' },
    { eventId: e1.id, vendorKey: 'Bloom District', name: 'Bloom District', category: 'FLOWERS', contractAmount: 30000, depositAmount: 15000, paidAmount: 0, confirmationStatus: 'DEPOSIT_REQUIRED', arrivalTime: '12:00', responsibleId: dina.id, operationalNotes: 'Delivery window still unconfirmed — chasing daily.', contactPhone: '+20 122 401 5507' },
    { eventId: e1.id, vendorKey: 'Beacon Lighting Co.', name: 'Beacon Lighting Co.', category: 'LIGHTING', contractAmount: 40000, depositAmount: 20000, paidAmount: 0, confirmationStatus: 'CONTACTED', arrivalTime: '13:00', setupTime: '13:30', responsibleId: hassan.id, contactPhone: '+20 122 401 5508' },
    { eventId: e1.id, vendorKey: 'Echo Pro Audio', name: 'Echo Pro Audio', category: 'SOUND', contractAmount: 25000, depositAmount: 12500, paidAmount: 0, confirmationStatus: 'CONTACTED', arrivalTime: '13:00', setupTime: '13:30', responsibleId: hassan.id, contactPhone: '+20 122 401 5509' },
    { eventId: e1.id, vendorKey: 'Zaffa Troupe Cairo', name: 'Zaffa Troupe Cairo', category: 'ENTERTAINMENT', contractAmount: 60000, depositAmount: 30000, paidAmount: 30000, confirmationStatus: 'CONFIRMED', arrivalTime: '18:00', responsibleId: dina.id, operationalNotes: 'Live takht band + mizmar ensemble for the entrance.', contactPhone: '+20 122 401 5510' },
    { eventId: e1.id, vendorKey: 'Apex Stage Systems', name: 'Apex Stage Systems', category: 'STAGE_PRODUCTION', contractAmount: 45000, depositAmount: 22500, paidAmount: 22500, confirmationStatus: 'CONFIRMED', arrivalTime: '12:30', setupTime: '13:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5511' },
    { eventId: e1.id, vendorKey: 'Chic Furniture Rentals', name: 'Chic Furniture Rentals', category: 'FURNITURE', contractAmount: 20000, depositAmount: 10000, paidAmount: 0, confirmationStatus: 'NEGOTIATING', arrivalTime: '15:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5512' },
    { eventId: e1.id, vendorKey: 'Go Limousine Egypt', name: 'Go Limousine Egypt', category: 'TRANSPORTATION', contractAmount: 12000, depositAmount: 6000, paidAmount: 0, confirmationStatus: 'NOT_CONTACTED', responsibleId: dina.id, contactPhone: '+20 122 401 5513' },
    // E2 — Omar & Salma
    { eventId: e2.id, vendorKey: 'Azure Beach Venues', name: 'Azure Beach Venues', category: 'VENUE', contractAmount: 450000, depositAmount: 225000, paidAmount: 225000, confirmationStatus: 'CONFIRMED', arrivalTime: '09:00', setupTime: '09:00', responsibleId: hassan.id, operationalNotes: 'Beach permit required — collect copy from venue office.', contactPhone: '+20 122 401 5502' },
    { eventId: e2.id, vendorKey: 'Cairo Feast Catering', name: 'Cairo Feast Catering', category: 'CATERING', contractAmount: 260000, depositAmount: 130000, paidAmount: 130000, confirmationStatus: 'CONFIRMED', arrivalTime: '12:00', setupTime: '13:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5503' },
    { eventId: e2.id, vendorKey: 'Lens & Light Studio', name: 'Lens & Light Studio', category: 'PHOTOGRAPHY', contractAmount: 90000, depositAmount: 45000, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '16:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5504' },
    { eventId: e2.id, vendorKey: 'Memory Reel Films', name: 'Memory Reel Films', category: 'VIDEOGRAPHY', contractAmount: 70000, depositAmount: 35000, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '15:30', responsibleId: hassan.id, contactPhone: '+20 122 401 5505' },
    { eventId: e2.id, vendorKey: 'Velvet Rose Decor', name: 'Velvet Rose Decor', category: 'DECORATION', contractAmount: 150000, depositAmount: 75000, paidAmount: 75000, confirmationStatus: 'CONFIRMED', arrivalTime: '10:00', setupTime: '10:30', responsibleId: hassan.id, contactPhone: '+20 122 401 5506' },
    { eventId: e2.id, vendorKey: 'Beacon Lighting Co.', name: 'Beacon Lighting Co.', category: 'LIGHTING', contractAmount: 55000, depositAmount: 27500, paidAmount: 27500, confirmationStatus: 'CONFIRMED', arrivalTime: '11:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5508' },
    { eventId: e2.id, vendorKey: 'Echo Pro Audio', name: 'Echo Pro Audio', category: 'SOUND', contractAmount: 35000, depositAmount: 17500, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '11:00', responsibleId: hassan.id, contactPhone: '+20 122 401 5509' },
    { eventId: e2.id, vendorKey: 'Apex Stage Systems', name: 'Apex Stage Systems', category: 'STAGE_PRODUCTION', contractAmount: 80000, depositAmount: 40000, paidAmount: 40000, confirmationStatus: 'CONFIRMED', arrivalTime: '10:30', responsibleId: hassan.id, contactPhone: '+20 122 401 5511' },
    { eventId: e2.id, vendorKey: 'Zaffa Troupe Cairo', name: 'Zaffa Troupe Cairo', category: 'ENTERTAINMENT', contractAmount: 45000, depositAmount: 22500, paidAmount: 0, confirmationStatus: 'NEGOTIATING', responsibleId: hassan.id, contactPhone: '+20 122 401 5510' },
    { eventId: e2.id, vendorKey: 'Chic Furniture Rentals', name: 'Chic Furniture Rentals', category: 'FURNITURE', contractAmount: 25000, depositAmount: 12500, paidAmount: 0, confirmationStatus: 'CONTACTED', responsibleId: hassan.id, contactPhone: '+20 122 401 5512' },
    // E3 — Karim & Nour
    { eventId: e3.id, vendorKey: 'Nile Grand Venues', name: 'The Palm Garden Venue', category: 'VENUE', contractAmount: 140000, depositAmount: 70000, paidAmount: 140000, confirmationStatus: 'CONFIRMED', arrivalTime: '09:00', setupTime: '09:00', responsibleId: dina.id, operationalNotes: 'Garden + glasshouse. Power limited to 2×63A — generator mandatory.', contactPhone: '+20 122 401 5501' },
    { eventId: e3.id, vendorKey: 'Cairo Feast Catering', name: 'Cairo Feast Catering', category: 'CATERING', contractAmount: 90000, depositAmount: 45000, paidAmount: 90000, confirmationStatus: 'CONFIRMED', arrivalTime: '14:00', responsibleId: dina.id, contactPhone: '+20 122 401 5503' },
    { eventId: e3.id, vendorKey: 'Lens & Light Studio', name: 'Lens & Light Studio', category: 'PHOTOGRAPHY', contractAmount: 45000, depositAmount: 22500, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '15:00', responsibleId: dina.id, contactPhone: '+20 122 401 5504' },
    { eventId: e3.id, vendorKey: 'Velvet Rose Decor', name: 'Velvet Rose Decor', category: 'DECORATION', contractAmount: 60000, depositAmount: 30000, paidAmount: 30000, confirmationStatus: 'CONFIRMED', arrivalTime: '10:00', setupTime: '10:30', responsibleId: dina.id, contactPhone: '+20 122 401 5506' },
    { eventId: e3.id, vendorKey: 'Bloom District', name: 'Bloom District', category: 'FLOWERS', contractAmount: 15000, depositAmount: 7500, paidAmount: 0, confirmationStatus: 'CONFIRMED', arrivalTime: '12:00', responsibleId: dina.id, contactPhone: '+20 122 401 5507' },
    { eventId: e3.id, vendorKey: 'Echo Pro Audio', name: 'Echo Pro Audio', category: 'SOUND', contractAmount: 22000, depositAmount: 11000, paidAmount: 0, confirmationStatus: 'CONTACTED', responsibleId: dina.id, operationalNotes: 'NOT CONFIRMED — not answering calls. CRITICAL blocker.', contactPhone: '+20 122 401 5509' },
    { eventId: e3.id, vendorKey: 'Beacon Lighting Co.', name: 'Beacon Lighting Co.', category: 'LIGHTING', contractAmount: 18000, depositAmount: 9000, paidAmount: 0, confirmationStatus: 'DEPOSIT_REQUIRED', arrivalTime: '13:00', responsibleId: dina.id, contactPhone: '+20 122 401 5508' },
    // E4 — Hany & Dahlia (completed)
    { eventId: e4.id, vendorKey: 'Nile Grand Venues', name: 'Zamalek Riverside Hall', category: 'VENUE', contractAmount: 300000, depositAmount: 150000, paidAmount: 300000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Cairo Feast Catering', name: 'Cairo Feast Catering', category: 'CATERING', contractAmount: 220000, depositAmount: 110000, paidAmount: 220000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Lens & Light Studio', name: 'Lens & Light Studio', category: 'PHOTOGRAPHY', contractAmount: 60000, depositAmount: 30000, paidAmount: 60000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Memory Reel Films', name: 'Memory Reel Films', category: 'VIDEOGRAPHY', contractAmount: 45000, depositAmount: 22500, paidAmount: 45000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Velvet Rose Decor', name: 'Velvet Rose Decor', category: 'DECORATION', contractAmount: 95000, depositAmount: 47500, paidAmount: 95000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Bloom District', name: 'Bloom District', category: 'FLOWERS', contractAmount: 20000, depositAmount: 10000, paidAmount: 20000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Beacon Lighting Co.', name: 'Beacon Lighting Co.', category: 'LIGHTING', contractAmount: 30000, depositAmount: 15000, paidAmount: 30000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Echo Pro Audio', name: 'Echo Pro Audio', category: 'SOUND', contractAmount: 18000, depositAmount: 9000, paidAmount: 18000, confirmationStatus: 'COMPLETED' },
    { eventId: e4.id, vendorKey: 'Apex Stage Systems', name: 'Apex Stage Systems', category: 'STAGE_PRODUCTION', contractAmount: 12000, depositAmount: 6000, paidAmount: 12000, confirmationStatus: 'COMPLETED' },
  ];

  const evIds: Record<string, string> = {};
  for (const ev of evDefs) {
    const created = await db.eventVendor.create({
      data: {
        eventId: ev.eventId,
        vendorId: ev.vendorKey ? vendors[ev.vendorKey] : null,
        name: ev.name,
        category: ev.category,
        contactPhone: ev.contactPhone ?? null,
        confirmationStatus: ev.confirmationStatus,
        arrivalTime: ev.arrivalTime ?? null,
        setupTime: ev.setupTime ?? null,
        responsibleId: ev.responsibleId ?? null,
        operationalNotes: ev.operationalNotes ?? null,
        contractAmount: ev.contractAmount,
        depositAmount: ev.depositAmount,
        paidAmount: ev.paidAmount,
        paymentStatus: payStatus(ev.contractAmount, ev.paidAmount),
      },
    });
    evIds[`${ev.eventId}:${ev.name}`] = created.id;
  }

  // ---------------------------------------------------------------- payments
  type P = {
    eventId: string; direction: string; kind: string; amount: number;
    method: string; reference?: string; note?: string; status: string;
    dueDate?: Date; paidAt?: Date; recordedById: string;
  };
  const paymentDefs: P[] = [
    // E1 inflows
    { eventId: e1.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 300000, method: 'BANK_TRANSFER', reference: 'TRX-88412', note: 'Booking deposit (35%)', status: 'COMPLETED', paidAt: D(-30, 10), recordedById: finance.id },
    { eventId: e1.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 200000, method: 'INSTAPAY', reference: 'IP-20913', note: 'Installment 2', status: 'COMPLETED', paidAt: D(-10, 14), recordedById: finance.id },
    { eventId: e1.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 215000, method: 'BANK_TRANSFER', note: 'Installment 3', status: 'PENDING', dueDate: D(5), recordedById: finance.id },
    { eventId: e1.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 200000, method: 'BANK_TRANSFER', note: 'Final balance', status: 'PENDING', dueDate: D(-2), recordedById: finance.id },
    // E1 outflows (vendor payments, completed)
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 125000, method: 'BANK_TRANSFER', reference: 'TRX-90011', note: 'Nile Grand Venues — deposit', status: 'COMPLETED', paidAt: D(-25, 11), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 90000, method: 'CHEQUE', reference: 'CHQ-2214', note: 'Cairo Feast — deposit', status: 'COMPLETED', paidAt: D(-12, 12), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 35000, method: 'INSTAPAY', note: 'Lens & Light — deposit', status: 'COMPLETED', paidAt: D(-8, 15), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 47500, method: 'BANK_TRANSFER', note: 'Velvet Rose — deposit', status: 'COMPLETED', paidAt: D(-15, 10), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 30000, method: 'CASH', note: 'Zaffa Troupe — deposit', status: 'COMPLETED', paidAt: D(-6, 17), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 22500, method: 'BANK_TRANSFER', note: 'Apex Stage — deposit', status: 'COMPLETED', paidAt: D(-18, 11), recordedById: finance.id },
    // E1 outflows (pending/overdue)
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 15000, method: 'BANK_TRANSFER', note: 'Bloom District — deposit', status: 'PENDING', dueDate: D(2), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 20000, method: 'BANK_TRANSFER', note: 'Beacon Lighting — deposit', status: 'PENDING', dueDate: D(7), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 12500, method: 'CASH', note: 'Echo Pro Audio — deposit', status: 'PENDING', dueDate: D(-1), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 27500, method: 'BANK_TRANSFER', note: 'Memory Reel — deposit', status: 'PENDING', dueDate: D(9), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 10000, method: 'CASH', note: 'Chic Furniture — deposit', status: 'PENDING', dueDate: D(12), recordedById: finance.id },
    { eventId: e1.id, direction: 'OUTFLOW', kind: 'EXPENSE', amount: 8000, method: 'CASH', note: 'Printed menus, signage & favors', status: 'COMPLETED', paidAt: D(-3, 13), recordedById: finance.id },
    // E2 inflows
    { eventId: e2.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 500000, method: 'BANK_TRANSFER', reference: 'TRX-71022', note: 'Booking deposit', status: 'COMPLETED', paidAt: D(-20, 10), recordedById: finance.id },
    { eventId: e2.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 475000, method: 'BANK_TRANSFER', note: 'Installment 2', status: 'PENDING', dueDate: D(20), recordedById: finance.id },
    { eventId: e2.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 475000, method: 'BANK_TRANSFER', note: 'Final balance', status: 'PENDING', dueDate: D(40), recordedById: finance.id },
    // E2 outflows
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 225000, method: 'BANK_TRANSFER', note: 'Azure Beach — deposit', status: 'COMPLETED', paidAt: D(-18, 10), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 130000, method: 'BANK_TRANSFER', note: 'Cairo Feast — deposit', status: 'COMPLETED', paidAt: D(-5, 12), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 75000, method: 'CHEQUE', note: 'Velvet Rose — deposit', status: 'COMPLETED', paidAt: D(-16, 11), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 27500, method: 'INSTAPAY', note: 'Beacon — deposit', status: 'COMPLETED', paidAt: D(-3, 15), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 40000, method: 'BANK_TRANSFER', note: 'Apex Stage — deposit', status: 'COMPLETED', paidAt: D(-14, 10), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 45000, method: 'BANK_TRANSFER', note: 'Lens & Light — deposit', status: 'PENDING', dueDate: D(25), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 35000, method: 'BANK_TRANSFER', note: 'Memory Reel — deposit', status: 'PENDING', dueDate: D(25), recordedById: finance.id },
    { eventId: e2.id, direction: 'OUTFLOW', kind: 'EXPENSE', amount: 18000, method: 'CASH', note: 'Guest transport deposit (buses)', status: 'PENDING', dueDate: D(30), recordedById: finance.id },
    // E3 inflows
    { eventId: e3.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 200000, method: 'BANK_TRANSFER', reference: 'TRX-60355', note: 'Booking deposit', status: 'COMPLETED', paidAt: D(-45, 10), recordedById: finance.id },
    { eventId: e3.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 220000, method: 'INSTAPAY', reference: 'IP-55401', note: 'Installment 2', status: 'COMPLETED', paidAt: D(-20, 13), recordedById: finance.id },
    { eventId: e3.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 18000, method: 'BANK_TRANSFER', note: 'Additional services balance', status: 'PENDING', dueDate: D(8), recordedById: finance.id },
    // E3 outflows
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 140000, method: 'BANK_TRANSFER', note: 'Palm Garden — full payment', status: 'COMPLETED', paidAt: D(-40, 11), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 90000, method: 'BANK_TRANSFER', note: 'Cairo Feast — full payment', status: 'COMPLETED', paidAt: D(-35, 11), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 30000, method: 'CHEQUE', note: 'Velvet Rose — deposit', status: 'COMPLETED', paidAt: D(-10, 12), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 11000, method: 'BANK_TRANSFER', note: 'Echo Pro Audio — deposit', status: 'PENDING', dueDate: D(-3), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 22500, method: 'BANK_TRANSFER', note: 'Lens & Light — deposit', status: 'PENDING', dueDate: D(5), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 9000, method: 'INSTAPAY', note: 'Beacon — deposit', status: 'PENDING', dueDate: D(6), recordedById: finance.id },
    { eventId: e3.id, direction: 'OUTFLOW', kind: 'EXPENSE', amount: 6500, method: 'CASH', note: 'Generator rental (backup)', status: 'PENDING', dueDate: D(4), recordedById: finance.id },
    // E4 (completed) — full ledger
    { eventId: e4.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 475000, method: 'BANK_TRANSFER', reference: 'TRX-50110', note: 'Booking deposit', status: 'COMPLETED', paidAt: D(-60, 10), recordedById: finance.id },
    { eventId: e4.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 475000, method: 'BANK_TRANSFER', reference: 'TRX-55220', note: 'Final balance', status: 'COMPLETED', paidAt: D(-40, 10), recordedById: finance.id },
    { eventId: e4.id, direction: 'INFLOW', kind: 'CLIENT_PAYMENT', amount: 30000, method: 'CASH', note: 'Additional services', status: 'COMPLETED', paidAt: D(-22, 15), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 300000, method: 'BANK_TRANSFER', note: 'Riverside Hall — full', status: 'COMPLETED', paidAt: D(-55, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 220000, method: 'BANK_TRANSFER', note: 'Cairo Feast — full', status: 'COMPLETED', paidAt: D(-50, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 60000, method: 'BANK_TRANSFER', note: 'Lens & Light — full', status: 'COMPLETED', paidAt: D(-48, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 45000, method: 'BANK_TRANSFER', note: 'Memory Reel — full', status: 'COMPLETED', paidAt: D(-48, 12), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 95000, method: 'CHEQUE', note: 'Velvet Rose — full', status: 'COMPLETED', paidAt: D(-45, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 20000, method: 'CASH', note: 'Bloom District — full', status: 'COMPLETED', paidAt: D(-44, 14), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 30000, method: 'BANK_TRANSFER', note: 'Beacon — full', status: 'COMPLETED', paidAt: D(-43, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 18000, method: 'CASH', note: 'Echo Pro — full', status: 'COMPLETED', paidAt: D(-42, 13), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'VENDOR_PAYMENT', amount: 12000, method: 'BANK_TRANSFER', note: 'Apex Stage — full', status: 'COMPLETED', paidAt: D(-42, 11), recordedById: finance.id },
    { eventId: e4.id, direction: 'OUTFLOW', kind: 'EXPENSE', amount: 15000, method: 'CASH', note: 'Misc on-day expenses', status: 'COMPLETED', paidAt: D(-21, 20), recordedById: finance.id },
  ];
  for (const p of paymentDefs) {
    await db.payment.create({
      data: {
        companyId: cid,
        eventId: p.eventId,
        direction: p.direction,
        kind: p.kind,
        amount: p.amount,
        currency: 'EGP',
        method: p.method,
        reference: p.reference ?? null,
        note: p.note ?? null,
        status: p.status,
        dueDate: p.dueDate ?? null,
        paidAt: p.paidAt ?? null,
        recordedById: p.recordedById,
      },
    });
  }

  // ---------------------------------------------------------------- tasks
  type T = {
    eventId: string; title: string; description?: string; assignedToId: string;
    createdById: string; priority: string; status: string; dueDate?: Date;
    completedAt?: Date;
  };
  const taskDefs: T[] = [
    { eventId: e1.id, title: 'Confirm flower delivery window with Bloom District', description: 'Vendor promised a 2-hour window; need it in writing before the run sheet is locked.', assignedToId: dina.id, createdById: ceo.id, priority: 'HIGH', status: 'TODO', dueDate: D(-1, 17) },
    { eventId: e1.id, title: 'Finalize seating chart with the couple', description: '420 guests — waiting on final family table grouping.', assignedToId: dina.id, createdById: ceo.id, priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: D(3, 17) },
    { eventId: e1.id, title: 'Send final guest count to catering', description: 'Cairo Feast requires the guaranteed count 48h before service.', assignedToId: hassan.id, createdById: ceo.id, priority: 'CRITICAL', status: 'TODO', dueDate: D(2, 12) },
    { eventId: e1.id, title: 'Order printed menus, signage & place cards', assignedToId: dina.id, createdById: dina.id, priority: 'LOW', status: 'WAITING', dueDate: D(5, 17), description: 'Printer waiting for seat-map approval.' },
    { eventId: e1.id, title: 'Inspect ballroom lighting rig with Beacon', description: 'Verify truss load capacity for the ceiling draping.', assignedToId: hassan.id, createdById: ceo.id, priority: 'HIGH', status: 'TODO', dueDate: D(8, 15) },
    { eventId: e1.id, title: "Prepare couple's welcome box", assignedToId: dina.id, createdById: dina.id, priority: 'LOW', status: 'COMPLETED', dueDate: D(-4, 17), completedAt: D(-2, 14) },
    { eventId: e2.id, title: 'Collect beach club permit copy', description: 'Azure Beach requires the permit displayed at the gate.', assignedToId: hassan.id, createdById: ceo.id, priority: 'HIGH', status: 'IN_PROGRESS', dueDate: D(1, 17) },
    { eventId: e2.id, title: 'Block hotel rooms for out-of-town guests', assignedToId: hassan.id, createdById: ceo.id, priority: 'MEDIUM', status: 'TODO', dueDate: D(10, 17) },
    { eventId: e2.id, title: 'Confirm DJ playlist with the couple', assignedToId: hassan.id, createdById: hassan.id, priority: 'LOW', status: 'COMPLETED', dueDate: D(-6, 17), completedAt: D(-3, 11) },
    { eventId: e2.id, title: 'Follow up entertainment quotation', description: 'Zaffa Troupe sent v2 quote — needs CEO approval.', assignedToId: hassan.id, createdById: ceo.id, priority: 'MEDIUM', status: 'WAITING', dueDate: D(6, 17) },
    { eventId: e3.id, title: 'Resolve Echo Pro Audio confirmation', description: 'Vendor not answering calls for 5 days. Critical blocker 10 days before the event.', assignedToId: dina.id, createdById: ceo.id, priority: 'CRITICAL', status: 'BLOCKED', dueDate: D(-2, 14) },
    { eventId: e3.id, title: 'Reserve backup generator', description: 'Venue power limited — generator is mandatory for garden lighting.', assignedToId: dina.id, createdById: dina.id, priority: 'HIGH', status: 'TODO', dueDate: D(1, 17) },
    { eventId: e3.id, title: 'Print run sheet copies for the team', assignedToId: dina.id, createdById: dina.id, priority: 'LOW', status: 'TODO', dueDate: D(8, 12) },
    { eventId: e3.id, title: 'Confirm henna night props with the family', assignedToId: dina.id, createdById: ceo.id, priority: 'MEDIUM', status: 'COMPLETED', dueDate: D(-7, 17), completedAt: D(-5, 16) },
    { eventId: e4.id, title: 'Close out vendor payments', assignedToId: finance.id, createdById: ceo.id, priority: 'HIGH', status: 'COMPLETED', dueDate: D(-25, 17), completedAt: D(-20, 11) },
    { eventId: e4.id, title: 'Archive client contract & final headcount', assignedToId: dina.id, createdById: ceo.id, priority: 'LOW', status: 'COMPLETED', dueDate: D(-20, 17), completedAt: D(-18, 10) },
    { eventId: e5.id, title: 'Follow-up call on proposal decision', description: 'Mostafa asked for a week — call Tuesday.', assignedToId: ceo.id, createdById: ceo.id, priority: 'MEDIUM', status: 'TODO', dueDate: D(2, 11) },
  ];
  const taskIds: string[] = [];
  for (const t of taskDefs) {
    const created = await db.task.create({
      data: {
        companyId: cid,
        eventId: t.eventId,
        title: t.title,
        description: t.description ?? null,
        assignedToId: t.assignedToId,
        createdById: t.createdById,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate ?? null,
        completedAt: t.completedAt ?? null,
      },
    });
    taskIds.push(created.id);
  }

  // task comments
  await db.taskComment.create({
    data: { taskId: taskIds[10], userId: dina.id, body: 'Called 3× today, no answer. Sent WhatsApp voice note. Escalating to issue tracker.' },
  });
  await db.taskComment.create({
    data: { taskId: taskIds[10], userId: ceo.id, body: 'If no response by tomorrow 12:00, switch to the backup sound vendor and inform finance.' },
  });
  await db.taskComment.create({
    data: { taskId: taskIds[6], userId: hassan.id, body: 'Venue office said the permit copy will be ready for pickup today after 4 PM.' },
  });

  // ---------------------------------------------------------------- run sheets
  type R = {
    eventId: string; time: string; activity: string; responsibleId?: string;
    responsibleName?: string; eventVendorKey?: string; location?: string;
    notes?: string; status?: string;
  };
  const runDefs: R[] = [
    { eventId: e1.id, time: '10:00', activity: 'Venue access & team briefing', responsibleId: dina.id, location: 'Grand Ballroom — service entrance', notes: 'Collect freight elevator card from security.', status: 'PENDING' },
    { eventId: e1.id, time: '11:00', activity: 'Decoration team arrival & ceiling draping', responsibleId: hassan.id, eventVendorKey: `${e1.id}:Velvet Rose Decor`, location: 'Grand Ballroom', status: 'PENDING' },
    { eventId: e1.id, time: '12:00', activity: 'Flowers installation', responsibleId: dina.id, eventVendorKey: `${e1.id}:Bloom District`, location: 'Ballroom & foyer', status: 'PENDING' },
    { eventId: e1.id, time: '13:00', activity: 'Lighting & sound setup', responsibleId: hassan.id, eventVendorKey: `${e1.id}:Beacon Lighting Co.`, location: 'Stage & dance floor', notes: 'Sound check at 16:30.', status: 'PENDING' },
    { eventId: e1.id, time: '15:00', activity: 'Furniture & stage placement', responsibleId: hassan.id, eventVendorKey: `${e1.id}:Apex Stage Systems`, location: 'Grand Ballroom', status: 'PENDING' },
    { eventId: e1.id, time: '16:00', activity: 'Photography pre-shoot with the couple', responsibleId: dina.id, eventVendorKey: `${e1.id}:Lens & Light Studio`, location: 'Nile terrace', status: 'PENDING' },
    { eventId: e1.id, time: '17:00', activity: 'Final inspection & punch list', responsibleId: dina.id, location: 'Full venue', notes: 'Walk through with venue engineer.', status: 'PENDING' },
    { eventId: e1.id, time: '18:30', activity: 'Guest arrival & welcome drinks', responsibleId: hassan.id, location: 'Foyer', status: 'PENDING' },
    { eventId: e1.id, time: '19:00', activity: 'Zaffa & couple entrance', responsibleId: dina.id, eventVendorKey: `${e1.id}:Zaffa Troupe Cairo`, location: 'Main aisle', notes: 'Live takht band. Confirm entrance song with MC.', status: 'PENDING' },
    { eventId: e1.id, time: '20:00', activity: 'Dinner service', responsibleId: hassan.id, eventVendorKey: `${e1.id}:Cairo Feast Catering`, location: 'Grand Ballroom', status: 'PENDING' },
    { eventId: e1.id, time: '22:00', activity: 'Cake cutting & first dance', responsibleId: dina.id, location: 'Stage', status: 'PENDING' },
    { eventId: e1.id, time: '23:00', activity: 'Last dance, send-off & vendor checkout', responsibleId: dina.id, location: 'Grand Ballroom', notes: 'Sign vendor checkout sheet; collect equipment.', status: 'PENDING' },
    // E3 run sheet
    { eventId: e3.id, time: '09:00', activity: 'Garden access & power check', responsibleId: dina.id, location: 'Palm Garden — main gate', notes: 'Test 2×63A lines with venue engineer.', status: 'PENDING' },
    { eventId: e3.id, time: '10:00', activity: 'Decoration setup', responsibleId: dina.id, eventVendorKey: `${e3.id}:Velvet Rose Decor`, location: 'Garden aisle & glasshouse', status: 'PENDING' },
    { eventId: e3.id, time: '12:00', activity: 'Flowers placement', responsibleId: dina.id, eventVendorKey: `${e3.id}:Bloom District`, location: 'Garden', status: 'PENDING' },
    { eventId: e3.id, time: '13:00', activity: 'Lighting rig & garden string lights', responsibleId: dina.id, eventVendorKey: `${e3.id}:Beacon Lighting Co.`, location: 'Garden', notes: 'Connect to generator, not venue main.', status: 'PENDING' },
    { eventId: e3.id, time: '14:00', activity: 'Sound check', responsibleId: dina.id, eventVendorKey: `${e3.id}:Echo Pro Audio`, location: 'Stage area', notes: 'VENDOR NOT CONFIRMED — resolve first.', status: 'DELAYED' },
    { eventId: e3.id, time: '15:00', activity: 'Photography arrival & garden shots', responsibleId: dina.id, eventVendorKey: `${e3.id}:Lens & Light Studio`, status: 'PENDING' },
    { eventId: e3.id, time: '17:00', activity: 'Final walkthrough', responsibleId: dina.id, location: 'Full garden', status: 'PENDING' },
    { eventId: e3.id, time: '18:30', activity: 'Guest arrival', responsibleId: dina.id, location: 'Main gate', status: 'PENDING' },
    { eventId: e3.id, time: '19:00', activity: 'Zaffa entrance', responsibleId: dina.id, location: 'Garden aisle', status: 'PENDING' },
    { eventId: e3.id, time: '20:30', activity: 'Dinner & cake', responsibleId: dina.id, eventVendorKey: `${e3.id}:Cairo Feast Catering`, location: 'Glasshouse', status: 'PENDING' },
  ];
  let order = 0;
  for (const r of runDefs) {
    await db.runSheetItem.create({
      data: {
        eventId: r.eventId,
        time: r.time,
        activity: r.activity,
        responsibleId: r.responsibleId ?? null,
        responsibleName: r.responsibleName ?? null,
        eventVendorId: r.eventVendorKey ? evIds[r.eventVendorKey] : null,
        location: r.location ?? null,
        notes: r.notes ?? null,
        status: r.status ?? 'PENDING',
        sortOrder: order++,
      },
    });
  }

  // ---------------------------------------------------------------- issues
  const issueDefs = [
    { eventId: e3.id, title: 'Sound vendor unconfirmed — 10 days to event', description: 'Echo Pro Audio has not confirmed the contract or received the deposit. No response for 5 days. Backup vendor identified (Sound Hub) at EGP 26,000.', priority: 'CRITICAL', status: 'OPEN', assignedToId: dina.id },
    { eventId: e3.id, title: 'Backup generator not reserved yet', description: 'Venue power is limited; without the generator the garden lighting cannot run.', priority: 'HIGH', status: 'IN_PROGRESS', assignedToId: dina.id },
    { eventId: e1.id, title: 'Flower delivery window unconfirmed', description: 'Bloom District has not committed to a delivery window; run sheet item at 12:00 may slip.', priority: 'MEDIUM', status: 'OPEN', assignedToId: dina.id },
    { eventId: e1.id, title: 'Ceiling draping load capacity', description: 'Velvet Rose needs written sign-off from the venue engineer for the truss.', priority: 'MEDIUM', status: 'RESOLVED', assignedToId: hassan.id, resolutionNotes: 'Engineer approved 400kg distributed load. Sign-off scanned to documents.', resolvedAt: D(-4, 15) },
    { eventId: e2.id, title: 'Beach permit pending collection', description: 'Permit ready at venue office; Hassan picks it up today.', priority: 'HIGH', status: 'IN_PROGRESS', assignedToId: hassan.id },
    { eventId: e2.id, title: 'Guest bus schedule mismatch', description: 'Two buses arrive 90 min apart — renegotiated with fleet.', priority: 'LOW', status: 'RESOLVED', assignedToId: hassan.id, resolutionNotes: 'Fleet confirmed convoy arrival 15:00.', resolvedAt: D(-8, 12) },
    { eventId: e4.id, title: 'Catering headcount mismatch on the day', description: '+12 guests showed up; kitchen absorbed them after confirmation.', priority: 'MEDIUM', status: 'RESOLVED', assignedToId: dina.id, resolutionNotes: 'Charged additional services EGP 30,000 — collected in cash.', resolvedAt: D(-21, 22) },
  ];
  for (const i of issueDefs) {
    await db.issue.create({
      data: {
        companyId: cid,
        eventId: i.eventId,
        title: i.title,
        description: i.description,
        priority: i.priority,
        status: i.status,
        assignedToId: i.assignedToId,
        resolutionNotes: (i as { resolutionNotes?: string }).resolutionNotes ?? null,
        resolvedAt: (i as { resolvedAt?: Date }).resolvedAt ?? null,
        createdAt: D(-6, 10),
      },
    });
  }

  // ---------------------------------------------------------------- documents
  const doc = async (
    eventId: string, name: string, category: string, fileName: string,
    text: string, uploadedById: string
  ) => {
    const data = Buffer.from(text, 'utf-8');
    await db.document.create({
      data: {
        companyId: cid, eventId, name, category,
        fileName, mimeType: 'text/plain; charset=utf-8',
        sizeBytes: data.byteLength, data, uploadedById,
      },
    });
  };
  await doc(e1.id, 'Signed wedding contract', 'CONTRACT', 'youssef-mariam-contract.txt',
    'LOTUS & NILE WEDDINGS — SERVICES CONTRACT (demo data)\nClients: Youssef Khalil & Mariam Sherif\nEvent: Grand Nile Wedding — The Grand Nile Ballroom\nContract value: EGP 850,000 | Additional services: EGP 65,000\nPayment schedule: 35% deposit, installment 2, installment 3, final balance.\nAll figures are fictional demo data.', ceo.id);
  await doc(e1.id, 'Ballroom floor plan notes', 'FLOOR_PLAN', 'youssef-mariam-floor-plan.txt',
    'Floor plan notes (demo): 42 rounds of 10 + 2 head tables.\nStage 12x6m north wall. Dance floor 8x8m center.\nAisle 3m wide from foyer doors. Service corridor behind stage.', dina.id);
  await doc(e3.id, 'Venue power & generator memo', 'GENERAL', 'karim-nour-power-memo.txt',
    'Palm Garden power memo (demo): venue provides 2x63A only.\nLighting rig must run from the backup generator.\nGenerator rental recorded as an event expense.', dina.id);
  await doc(e3.id, 'Vendor contact sheet', 'SCHEDULE', 'karim-nour-vendors.txt',
    'Karim & Nour vendor sheet (demo):\nPalm Garden Venue — confirmed\nCairo Feast — confirmed, paid\nLens & Light — confirmed\nVelvet Rose — confirmed\nBloom District — confirmed\nEcho Pro Audio — NOT CONFIRMED (critical)\nBeacon — deposit required', dina.id);
  await doc(e4.id, 'Final settlement summary', 'CONTRACT', 'hany-dahlia-settlement.txt',
    'Final settlement (demo): collected EGP 980,000.\nExpenses paid EGP 800,000. Actual profit EGP 180,000.\nClient referral bonus pending.', finance.id);

  // ---------------------------------------------------------------- notices
  await db.notice.create({
    data: {
      companyId: cid, eventId: e2.id, fromUserId: finance.id, level: 'WARNING',
      message: 'Omar & Salma: installment 2 (EGP 475,000) is scheduled but the client asked to shift it. Confirm the new date with the CEO before locking the payment plan.',
      createdAt: D(-1, 11),
    },
  });
  await db.notice.create({
    data: {
      companyId: cid, eventId: e3.id, fromUserId: finance.id, level: 'CRITICAL',
      message: 'Karim & Nour: sound vendor deposit (EGP 11,000) is overdue while the vendor is still unconfirmed. Recommend switching to the backup vendor at EGP 26,000 — needs CEO approval.',
      createdAt: D(0, 9),
    },
  });

  // ---------------------------------------------------------------- audit log
  const log = (userId: string, action: string, entityType: string, entityId: string, eventId: string | null, summary: string, financial = false) =>
    db.auditLog.create({
      data: {
        companyId: cid, userId, eventId, action, entityType, entityId, summary,
        metadata: JSON.stringify({ financial }),
      },
    });
  const logs: Array<Parameters<typeof log>> = [
    [ceo.id, 'event.created', 'Event', e1.id, e1.id, 'Created event "Youssef & Mariam — Grand Nile Wedding"'],
    [ceo.id, 'event.created', 'Event', e2.id, e2.id, 'Created event "Omar & Salma — North Coast Reception"'],
    [ceo.id, 'event.created', 'Event', e3.id, e3.id, 'Created event "Karim & Nour — Garden Zaffa"'],
    [ceo.id, 'event.created', 'Event', e4.id, e4.id, 'Created event "Hany & Dahlia — Zamalek Wedding"'],
    [ceo.id, 'event.created', 'Event', e5.id, e5.id, 'Created event "Mostafa & Aya — Proposal"'],
    [ceo.id, 'event.status_changed', 'Event', e1.id, e1.id, 'Status changed to IN_PREPARATION'],
    [ceo.id, 'event.status_changed', 'Event', e2.id, e2.id, 'Status changed to CONFIRMED'],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e1.id, 'Client deposit EGP 300,000 recorded', true],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e1.id, 'Client installment EGP 200,000 recorded', true],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e1.id, 'Vendor deposits paid: EGP 350,000 across 6 vendors', true],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e2.id, 'Client deposit EGP 500,000 recorded', true],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e3.id, 'Venue & catering fully paid EGP 230,000', true],
    [finance.id, 'notice.created', 'Notice', 'seed', e3.id, 'Raised CRITICAL financial-risk notice to CEO'],
    [ceo.id, 'task.created', 'Task', taskIds[10], e3.id, 'Created critical task "Resolve Echo Pro Audio confirmation"'],
    [dina.id, 'issue.created', 'Issue', 'seed', e3.id, 'Reported critical issue "Sound vendor unconfirmed"'],
    [dina.id, 'issue.resolved', 'Issue', 'seed', e1.id, 'Resolved issue "Ceiling draping load capacity"'],
    [dina.id, 'runsheet.updated', 'RunSheetItem', 'seed', e3.id, 'Marked 14:00 sound check as DELAYED'],
    [ceo.id, 'team.member_added', 'User', hassan.id, null, 'Invited Hassan Adel as Operations'],
    [finance.id, 'payment.recorded', 'Payment', 'seed', e4.id, 'Final settlement completed — event delivered', true],
  ];
  for (const args of logs) await log(...args);

  return { companyId: cid };
}
