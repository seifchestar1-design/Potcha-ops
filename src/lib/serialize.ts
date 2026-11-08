// Potcha Ops — response serializers
// Financial fields are removed server-side before a response ever leaves
// the API for users without finance.view. The frontend never receives
// restricted numbers, so no client-side trick can reveal them.

import type { AuthUser } from '@/lib/auth';
import type { Event, EventVendor, Payment, Task, User, Vendor, Issue, RunSheetItem } from '@prisma/client';

export function canSeeFinancials(auth: AuthUser): boolean {
  return auth.perms.has('finance.view');
}

type EventWithRefs = Event & {
  planner?: { id: string; name: string } | null;
  assignments?: { userId: string; roleNote: string | null }[];
};

export function serializeEvent(auth: AuthUser, e: EventWithRefs) {
  const base: Record<string, unknown> = {
    id: e.id,
    name: e.name,
    clientName: e.clientName,
    clientPhone: e.clientPhone,
    clientEmail: e.clientEmail,
    eventDate: e.eventDate,
    venue: e.venue,
    venueAddress: e.venueAddress,
    guestCount: e.guestCount,
    eventType: e.eventType,
    status: e.status,
    plannerId: e.plannerId,
    plannerName: e.planner?.name ?? null,
    notes: e.notes,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    assignedUserIds: (e.assignments ?? []).map((a) => a.userId),
    hasFinancials: canSeeFinancials(auth),
  };
  if (canSeeFinancials(auth)) {
    base.contractValue = e.contractValue;
    base.additionalRevenue = e.additionalRevenue;
  }
  return base;
}

export function serializeEventVendor(auth: AuthUser, v: EventVendor) {
  const base: Record<string, unknown> = {
    id: v.id,
    eventId: v.eventId,
    vendorId: v.vendorId,
    name: v.name,
    category: v.category,
    contactPerson: v.contactPerson,
    contactPhone: v.contactPhone,
    contactWhatsapp: v.contactWhatsapp,
    confirmationStatus: v.confirmationStatus,
    arrivalTime: v.arrivalTime,
    setupTime: v.setupTime,
    responsibleId: v.responsibleId,
    operationalNotes: v.operationalNotes,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
  if (canSeeFinancials(auth)) {
    base.contractAmount = v.contractAmount;
    base.depositAmount = v.depositAmount;
    base.paidAmount = v.paidAmount;
    base.paymentStatus = v.paymentStatus;
  }
  return base;
}

export function serializeVendor(v: Vendor) {
  return {
    id: v.id,
    name: v.name,
    contactPerson: v.contactPerson,
    phone: v.phone,
    whatsapp: v.whatsapp,
    email: v.email,
    category: v.category,
    notes: v.notes,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

export function serializePayment(
  p: Payment & { event?: { id: string; name: string } | null; recordedBy?: { id: string; name: string } | null }
) {
  return {
    id: p.id,
    eventId: p.eventId,
    eventName: p.event?.name ?? null,
    direction: p.direction,
    kind: p.kind,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    reference: p.reference,
    note: p.note,
    status: p.status,
    dueDate: p.dueDate,
    paidAt: p.paidAt,
    recordedById: p.recordedById,
    recordedByName: p.recordedBy?.name ?? null,
    reversalOfId: p.reversalOfId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeTask(
  t: Task & {
    event?: { id: string; name: string } | null;
    assignedTo?: { id: string; name: string } | null;
    createdBy?: { id: string; name: string } | null;
    comments?: unknown[];
  }
) {
  return {
    id: t.id,
    eventId: t.eventId,
    eventName: t.event?.name ?? null,
    title: t.title,
    description: t.description,
    assignedToId: t.assignedToId,
    assignedToName: t.assignedTo?.name ?? null,
    createdById: t.createdById,
    createdByName: t.createdBy?.name ?? null,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    commentCount: Array.isArray(t.comments) ? t.comments.length : undefined,
  };
}

export function serializeIssue(
  i: Issue & { event?: { id: string; name: string } | null; assignedTo?: { id: string; name: string } | null }
) {
  return {
    id: i.id,
    eventId: i.eventId,
    eventName: i.event?.name ?? null,
    title: i.title,
    description: i.description,
    priority: i.priority,
    assignedToId: i.assignedToId,
    assignedToName: i.assignedTo?.name ?? null,
    status: i.status,
    resolutionNotes: i.resolutionNotes,
    createdAt: i.createdAt,
    resolvedAt: i.resolvedAt,
  };
}

export function serializeRunSheetItem(
  r: RunSheetItem & {
    responsible?: { id: string; name: string } | null;
    eventVendor?: { id: string; name: string } | null;
  }
) {
  return {
    id: r.id,
    eventId: r.eventId,
    time: r.time,
    activity: r.activity,
    responsibleId: r.responsibleId,
    responsibleName: r.responsible?.name ?? r.responsibleName,
    eventVendorId: r.eventVendorId,
    eventVendorName: r.eventVendor?.name ?? null,
    location: r.location,
    notes: r.notes,
    status: r.status,
    sortOrder: r.sortOrder,
  };
}

export function serializeTeamMember(
  u: User & { _count?: { assignments: number; tasksAssigned: number } }
) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    extraPerms: (() => {
      try {
        return JSON.parse(u.extraPerms || '[]');
      } catch {
        return [];
      }
    })(),
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    assignedEvents: u._count?.assignments ?? undefined,
    openTasks: u._count?.tasksAssigned ?? undefined,
  };
}
