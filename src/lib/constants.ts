// Potcha Ops — shared domain constants (used by both server & client)

export const EVENT_STATUSES = [
  'LEAD',
  'PROPOSAL_SENT',
  'CONFIRMED',
  'IN_PREPARATION',
  'READY',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  LEAD: 'Lead',
  PROPOSAL_SENT: 'Proposal sent',
  CONFIRMED: 'Confirmed',
  IN_PREPARATION: 'In preparation',
  READY: 'Ready',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const VENDOR_CATEGORIES = [
  'VENUE',
  'CATERING',
  'PHOTOGRAPHY',
  'VIDEOGRAPHY',
  'DECORATION',
  'FLOWERS',
  'LIGHTING',
  'SOUND',
  'ENTERTAINMENT',
  'STAGE_PRODUCTION',
  'FURNITURE',
  'TRANSPORTATION',
  'OTHER',
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  VENUE: 'Venue',
  CATERING: 'Catering',
  PHOTOGRAPHY: 'Photography',
  VIDEOGRAPHY: 'Videography',
  DECORATION: 'Decoration',
  FLOWERS: 'Flowers',
  LIGHTING: 'Lighting',
  SOUND: 'Sound',
  ENTERTAINMENT: 'Entertainment',
  STAGE_PRODUCTION: 'Stage & production',
  FURNITURE: 'Furniture',
  TRANSPORTATION: 'Transportation',
  OTHER: 'Other',
};

export const VENDOR_STATUSES = [
  'NOT_CONTACTED',
  'CONTACTED',
  'NEGOTIATING',
  'CONFIRMED',
  'DEPOSIT_REQUIRED',
  'PAID',
  'COMPLETED',
  'CANCELLED',
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  NOT_CONTACTED: 'Not contacted',
  CONTACTED: 'Contacted',
  NEGOTIATING: 'Negotiating',
  CONFIRMED: 'Confirmed',
  DEPOSIT_REQUIRED: 'Deposit required',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'BLOCKED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const RUNSHEET_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'DELAYED'] as const;
export type RunSheetStatus = (typeof RUNSHEET_STATUSES)[number];

export const RUNSHEET_STATUS_LABELS: Record<RunSheetStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'Running',
  DONE: 'Done',
  DELAYED: 'Delayed',
};

export const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

export const PAYMENT_KINDS = ['CLIENT_PAYMENT', 'VENDOR_PAYMENT', 'EXPENSE'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  CLIENT_PAYMENT: 'Client payment',
  VENDOR_PAYMENT: 'Vendor payment',
  EXPENSE: 'Expense',
};

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'INSTAPAY', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  INSTAPAY: 'InstaPay',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'REVERSED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  REVERSED: 'Reversed',
};

export const DOCUMENT_CATEGORIES = [
  'CONTRACT',
  'FLOOR_PLAN',
  'SCHEDULE',
  'VENDOR_AGREEMENT',
  'GENERAL',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contract',
  FLOOR_PLAN: 'Floor plan',
  SCHEDULE: 'Schedule',
  VENDOR_AGREEMENT: 'Vendor agreement',
  GENERAL: 'General',
};

export const EVENT_TYPES = ['WEDDING', 'ENGAGEMENT', 'HENNA', 'RECEPTION', 'OTHER'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING: 'Wedding',
  ENGAGEMENT: 'Engagement',
  HENNA: 'Henna',
  RECEPTION: 'Reception',
  OTHER: 'Other',
};

export const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB per document

// Readiness score weights (transparent scoring model)
export const READINESS_WEIGHTS = {
  vendorsConfirmed: 25,
  criticalTasks: 20,
  runSheet: 15,
  venueConfirmed: 15,
  documents: 10,
  criticalIssues: 15,
} as const;
