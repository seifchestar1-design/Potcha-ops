'use client';

import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns';
import {
  EVENT_STATUS_LABELS, VENDOR_CATEGORY_LABELS, VENDOR_STATUS_LABELS,
  TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, RUNSHEET_STATUS_LABELS,
  ISSUE_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS, DOCUMENT_CATEGORY_LABELS, EVENT_TYPE_LABELS,
  type EventStatus, type VendorCategory, type VendorStatus, type TaskStatus,
  type TaskPriority, type RunSheetStatus, type IssueStatus, type PaymentKind,
  type PaymentMethod, type PaymentStatus, type DocumentCategory, type EventType,
} from '@/lib/constants';

// ------------------------------------------------------------------ money
export function formatMoney(amount: number | null | undefined, currency = 'EGP'): string {
  if (amount === null || amount === undefined) return '—';
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(abs));
  const symbol = currency === 'EGP' ? 'EGP' : currency;
  return `${neg ? '−' : ''}${symbol} ${formatted}`;
}

/** Short alias used across dashboard components. */
export const fmtMoney = formatMoney;

export function formatMoneyPrecise(amount: number | null | undefined, currency = 'EGP'): string {
  if (amount === null || amount === undefined) return '—';
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${neg ? '−' : ''}${currency} ${formatted}`;
}

// ------------------------------------------------------------------ dates
export function fmtDate(iso: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), pattern);
  } catch {
    return '—';
  }
}

export function fmtDateTime(iso: string | null | undefined, pattern = 'dd MMM yyyy, HH:mm'): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), pattern);
  } catch {
    return '—';
  }
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    return differenceInCalendarDays(new Date(iso), new Date());
  } catch {
    return null;
  }
}

export function countdownLabel(iso: string | null | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return '—';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
  return `in ${d} days`;
}

export function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

export function toInputDay(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------ labels
export function eventStatusLabel(s: string): string {
  return EVENT_STATUS_LABELS[s as EventStatus] ?? s;
}
export function vendorCategoryLabel(s: string): string {
  return VENDOR_CATEGORY_LABELS[s as VendorCategory] ?? s;
}
export function vendorStatusLabel(s: string): string {
  return VENDOR_STATUS_LABELS[s as VendorStatus] ?? s;
}
export function taskStatusLabel(s: string): string {
  return TASK_STATUS_LABELS[s as TaskStatus] ?? s;
}
export function taskPriorityLabel(s: string): string {
  return TASK_PRIORITY_LABELS[s as TaskPriority] ?? s;
}
export function runSheetStatusLabel(s: string): string {
  return RUNSHEET_STATUS_LABELS[s as RunSheetStatus] ?? s;
}
export function issueStatusLabel(s: string): string {
  return ISSUE_STATUS_LABELS[s as IssueStatus] ?? s;
}
export function paymentKindLabel(s: string): string {
  return PAYMENT_KIND_LABELS[s as PaymentKind] ?? s;
}
export function paymentMethodLabel(s: string): string {
  return PAYMENT_METHOD_LABELS[s as PaymentMethod] ?? s;
}
export function paymentStatusLabel(s: string): string {
  return PAYMENT_STATUS_LABELS[s as PaymentStatus] ?? s;
}
export function documentCategoryLabel(s: string): string {
  return DOCUMENT_CATEGORY_LABELS[s as DocumentCategory] ?? s;
}
export function eventTypeLabel(s: string): string {
  return EVENT_TYPE_LABELS[s as EventType] ?? s;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
