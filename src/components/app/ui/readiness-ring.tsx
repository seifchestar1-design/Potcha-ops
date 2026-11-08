'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReadinessResult } from '@/lib/client/types';

const BAND_COLOR: Record<string, string> = {
  on_track: 'text-emerald-600 dark:text-emerald-400',
  attention: 'text-amber-600 dark:text-amber-400',
  at_risk: 'text-red-600 dark:text-red-400',
};

const BAND_STROKE: Record<string, string> = {
  on_track: 'stroke-emerald-500',
  attention: 'stroke-amber-500',
  at_risk: 'stroke-red-500',
};

const BAND_LABEL: Record<string, string> = {
  on_track: 'On track',
  attention: 'Needs attention',
  at_risk: 'At risk',
};

export function ReadinessRing({
  readiness,
  size = 64,
  showValue = true,
  className,
}: {
  readiness: ReadinessResult | null | undefined;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const score = readiness?.score ?? null;
  const band = readiness?.band ?? null;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.max(0, Math.min(100, score));

  const content = (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted"
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn('transition-all duration-500', band ? BAND_STROKE[band] : 'stroke-muted-foreground')}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (progress / 100) * circumference}
        />
      </svg>
      {showValue && (
        <span className={cn('absolute text-sm font-semibold tabular', band ? BAND_COLOR[band] : 'text-muted-foreground')}>
          {score === null ? '—' : score}
        </span>
      )}
    </div>
  );

  if (!readiness) return content;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="w-64 p-3">
          <p className="text-xs font-semibold">
            Readiness {readiness.score}% — {BAND_LABEL[readiness.band]}
          </p>
          <ul className="mt-1.5 space-y-1">
            {readiness.criteria.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="tabular font-medium">
                  {Math.round(c.score * c.weight)}/{c.weight}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Transparent model: vendors 25 · critical tasks 20 · run sheet 15 · venue 15 · documents 10 · issues 15
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ReadinessBar({ readiness, className }: { readiness: ReadinessResult | null | undefined; className?: string }) {
  if (!readiness) return null;
  const color =
    readiness.band === 'on_track'
      ? 'bg-emerald-500'
      : readiness.band === 'attention'
        ? 'bg-amber-500'
        : 'bg-red-500';
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${readiness.score}%` }} />
    </div>
  );
}
