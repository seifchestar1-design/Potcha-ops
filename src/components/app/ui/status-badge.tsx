'use client';

import { cn } from '@/lib/utils';
import {
  eventStatusLabel, vendorStatusLabel, taskStatusLabel, taskPriorityLabel,
  runSheetStatusLabel, issueStatusLabel, paymentStatusLabel, paymentKindLabel,
} from '@/lib/client/format';

// Unified status badge system — consistent colors across the product.
// Functional palette: emerald = good, amber = pending, orange = active
// risk, red = critical, neutral = inactive.

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
  red: 'bg-red-500/10 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  slate: 'bg-stone-500/10 text-stone-600 border-stone-500/25 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/25',
  bronze: 'bg-primary/10 text-primary border-primary/30',
  violet: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
};

const EVENT_STATUS_TONES: Record<string, string> = {
  LEAD: 'slate',
  PROPOSAL_SENT: 'amber',
  CONFIRMED: 'emerald',
  IN_PREPARATION: 'orange',
  READY: 'emerald',
  COMPLETED: 'slate',
  ARCHIVED: 'slate',
};

const VENDOR_STATUS_TONES: Record<string, string> = {
  NOT_CONTACTED: 'slate',
  CONTACTED: 'slate',
  NEGOTIATING: 'amber',
  CONFIRMED: 'emerald',
  DEPOSIT_REQUIRED: 'orange',
  PAID: 'emerald',
  COMPLETED: 'slate',
  CANCELLED: 'red',
};

const TASK_STATUS_TONES: Record<string, string> = {
  TODO: 'slate',
  IN_PROGRESS: 'amber',
  WAITING: 'orange',
  COMPLETED: 'emerald',
  BLOCKED: 'red',
};

const PRIORITY_TONES: Record<string, string> = {
  LOW: 'slate',
  MEDIUM: 'amber',
  HIGH: 'orange',
  CRITICAL: 'red',
};

const RUNSHEET_TONES: Record<string, string> = {
  PENDING: 'slate',
  IN_PROGRESS: 'amber',
  DONE: 'emerald',
  DELAYED: 'red',
};

const ISSUE_STATUS_TONES: Record<string, string> = {
  OPEN: 'red',
  IN_PROGRESS: 'orange',
  RESOLVED: 'emerald',
};

const PAYMENT_STATUS_TONES: Record<string, string> = {
  PENDING: 'amber',
  COMPLETED: 'emerald',
  REVERSED: 'red',
};

export function StatusBadge({
  kind,
  value,
  label,
  className,
}: {
  kind:
    | 'event'
    | 'vendor'
    | 'task'
    | 'priority'
    | 'runsheet'
    | 'issue'
    | 'payment'
    | 'paymentKind'
    | 'role'
    | 'tone';
  value: string;
  label?: string;
  className?: string;
}) {
  let tone = 'slate';
  let text = value;
  switch (kind) {
    case 'event':
      tone = EVENT_STATUS_TONES[value] ?? 'slate';
      text = eventStatusLabel(value);
      break;
    case 'vendor':
      tone = VENDOR_STATUS_TONES[value] ?? 'slate';
      text = vendorStatusLabel(value);
      break;
    case 'task':
      tone = TASK_STATUS_TONES[value] ?? 'slate';
      text = taskStatusLabel(value);
      break;
    case 'priority':
      tone = PRIORITY_TONES[value] ?? 'slate';
      text = taskPriorityLabel(value);
      break;
    case 'runsheet':
      tone = RUNSHEET_TONES[value] ?? 'slate';
      text = runSheetStatusLabel(value);
      break;
    case 'issue':
      tone = ISSUE_STATUS_TONES[value] ?? 'slate';
      text = issueStatusLabel(value);
      break;
    case 'payment':
      tone = PAYMENT_STATUS_TONES[value] ?? 'slate';
      text = paymentStatusLabel(value);
      break;
    case 'paymentKind':
      tone = value === 'CLIENT_PAYMENT' ? 'emerald' : value === 'VENDOR_PAYMENT' ? 'orange' : 'slate';
      text = paymentKindLabel(value);
      break;
    case 'role':
      tone = value === 'ADMIN' ? 'violet' : value === 'CEO' ? 'bronze' : value === 'FINANCE' ? 'orange' : 'slate';
      text = value;
      break;
    case 'tone':
      tone = value;
      text = label ?? value;
      break;
  }
  if (label) text = label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        TONES[tone] ?? TONES.slate,
        className
      )}
    >
      {text}
    </span>
  );
}
