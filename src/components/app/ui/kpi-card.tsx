'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/client/format';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  isMoney = false,
  currency,
  loading,
  onPress,
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'positive' | 'warning' | 'negative' | 'info';
  isMoney?: boolean;
  currency?: string;
  loading?: boolean;
  /** When provided, the whole card becomes a tappable button. */
  onPress?: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-28" />
        </CardContent>
      </Card>
    );
  }
  const display =
    isMoney && typeof value === 'number'
      ? formatMoney(value, currency)
      : value === null || value === undefined
        ? '—'
        : String(value);

  const valueTone = {
    default: 'text-foreground',
    positive: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    negative: 'text-red-600 dark:text-red-400',
    info: 'text-primary',
  }[tone];

  const inner = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-4">
          {label}
        </p>
        <div className="flex items-center gap-1">
          {onPress && (
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70 group-focus-visible:text-muted-foreground/70"
              aria-hidden
            />
          )}
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />}
        </div>
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular tracking-tight', valueTone)}>{display}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{hint}</p>}
    </CardContent>
  );

  // Tappable KPI — wraps the card in a real button so touch, keyboard and
  // screen readers all get first-class behaviour (44px+ target, focus ring).
  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={`${label}: ${display}${hint ? ` (${hint})` : ''}`}
        className="group block h-full w-full cursor-pointer rounded-xl text-left transition-transform active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
          {inner}
        </Card>
      </button>
    );
  }

  return (
    <Card className="group transition-shadow hover:shadow-sm">
      {inner}
    </Card>
  );
}
