// Potcha Ops — shared client-side types mirroring server serializers

export type PermissionKey = string;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'ADMIN' | 'CEO' | 'FINANCE' | 'OPERATIONS';
  companyId: string;
  companyName: string;
  currency: string;
  dateFormat: string;
  isDemoCompany: boolean;
  perms: PermissionKey[];
};

export type ReadinessCriterion = {
  key: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
  met: boolean;
};

export type ReadinessResult = {
  score: number;
  band: 'on_track' | 'attention' | 'at_risk';
  criteria: ReadinessCriterion[];
  missing: string[];
  criticalBlockers: string[];
  recommendedActions: string[];
};

export type EventFinancials = {
  currency: string;
  contractValue: number;
  additionalRevenue: number;
  totalRevenue: number;
  collectedFromClient: number;
  outstandingClientBalance: number;
  plannedExpenses: number;
  actualExpenses: number;
  remainingBudget: number;
  grossEstimatedProfit: number;
  actualProfit: number;
  profitMargin: number;
  overduePayments?: number;
};

export type EventRow = {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  eventDate: string;
  venue: string | null;
  venueAddress: string | null;
  guestCount: number;
  eventType: string;
  status: string;
  plannerId: string | null;
  plannerName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUserIds: string[];
  hasFinancials: boolean;
  contractValue?: number;
  additionalRevenue?: number;
  readiness: ReadinessResult | null;
  financials: (EventFinancials & { overduePayments?: number }) | null;
  team?: { userId: string; name: string; role: string; roleNote: string | null }[];
};

export type EventVendorRow = {
  id: string;
  eventId: string;
  vendorId: string | null;
  name: string;
  category: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  confirmationStatus: string;
  arrivalTime: string | null;
  setupTime: string | null;
  responsibleId: string | null;
  operationalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  contractAmount?: number;
  depositAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
};

export type VendorRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  category: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRow = {
  id: string;
  eventId: string;
  eventName: string | null;
  direction: 'INFLOW' | 'OUTFLOW';
  kind: 'CLIENT_PAYMENT' | 'VENDOR_PAYMENT' | 'EXPENSE';
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  note: string | null;
  status: 'PENDING' | 'COMPLETED' | 'REVERSED';
  dueDate: string | null;
  paidAt: string | null;
  recordedById: string;
  recordedByName: string | null;
  reversalOfId: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  reversesNote?: string | null;
};

export type TaskRow = {
  id: string;
  eventId: string;
  eventName: string | null;
  title: string;
  description: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdById: string;
  createdByName: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  commentCount?: number;
  isOverdue?: boolean;
};

export type RunSheetItemRow = {
  id: string;
  eventId: string;
  time: string;
  activity: string;
  responsibleId: string | null;
  responsibleName: string | null;
  eventVendorId: string | null;
  eventVendorName: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  sortOrder: number;
};

export type IssueRow = {
  id: string;
  eventId: string;
  eventName: string | null;
  title: string;
  description: string | null;
  priority: string;
  assignedToId: string | null;
  assignedToName: string | null;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type DocumentRow = {
  id: string;
  name: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById: string;
  uploadedByName: string;
};

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  financial: boolean;
  createdAt: string;
  userId: string | null;
  userName: string;
  userRole: string | null;
  eventId: string | null;
  eventName: string | null;
};

export type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CEO' | 'FINANCE' | 'OPERATIONS';
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  extraPerms: string[];
  createdAt: string;
  lastLoginAt: string | null;
  assignedEvents?: number;
  openTasks?: number;
};

export type NoticeRow = {
  id: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
  readAt: string | null;
  eventId: string | null;
  eventName: string | null;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: string;
};

export type ActivityRow = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  userId: string | null;
  userName: string;
  userRole: string | null;
};

// Quota usage for the caller's company (GET /api/limits) — null for the
// platform admin, whose company carries no subscriber quotas.
export type LimitsData = {
  events: { used: number; max: number } | null;
  members: { used: number; max: number } | null;
};

export type DashboardData = {
  role: string;
  currency: string;
  kpis: Record<string, number>;
  events: {
    id: string;
    name: string;
    clientName: string;
    eventDate: string;
    venue: string | null;
    status: string;
    guestCount: number;
    plannerName: string | null;
    daysUntil: number;
    readiness: ReadinessResult | null;
  }[];
  alerts?: {
    overdueTasks?: { id?: string; eventId?: string; title: string; priority: string; dueDate: string | null }[];
    tasksDueToday?: { id?: string; eventId?: string; title: string; priority: string; dueDate: string | null }[];
    openCriticalIssues?: { id?: string; eventId?: string; title: string; createdAt: string }[];
    criticalIssues?: { id?: string; eventId?: string; title: string; createdAt: string }[];
    overduePayments?: { eventId: string; amount: number; dueDate: string | null; note: string | null }[];
    paymentDeadlines?: { eventId: string; amount: number; dueDate: string | null; note: string | null }[];
    atRiskEventIds?: string[];
  };
  recentActivity: ActivityRow[];
  notices?: NoticeRow[];
  eventFinancials?: {
    eventId: string;
    eventName: string;
    eventDate: string;
    status: string;
    totalRevenue?: number;
    collectedFromClient?: number;
    outstandingClientBalance?: number;
    plannedExpenses?: number;
    actualExpenses?: number;
    grossEstimatedProfit?: number;
    profitMargin?: number;
  }[];
  overduePaymentRows?: { id: string; eventId: string; amount: number; dueDate: string | null; note: string | null; kind: string }[];
};
