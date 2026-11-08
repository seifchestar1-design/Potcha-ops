// Potcha Ops — financial calculations (single source of truth)
// Ledger model: payments are immutable. Reversals are new rows with
// negative amounts, so all sums below net out automatically.

import type { Event, EventVendor, Payment } from '@prisma/client';

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
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isReversalRow(p: Payment): boolean {
  return p.reversalOfId !== null;
}

export function isOverdue(p: Payment, now = new Date()): boolean {
  return p.status === 'PENDING' && p.dueDate !== null && p.dueDate < now;
}

export function eventFinancials(
  event: Pick<Event, 'contractValue' | 'additionalRevenue' | 'currency'>,
  payments: Payment[],
  eventVendors: Pick<EventVendor, 'contractAmount'>[]
): EventFinancials {
  const totalRevenue = round2(event.contractValue + event.additionalRevenue);

  const inflow = round2(
    payments
      .filter((p) => p.direction === 'INFLOW' && p.kind === 'CLIENT_PAYMENT' && p.status === 'COMPLETED')
      .reduce((s, p) => s + p.amount, 0)
  );
  // Reversal rows carry negative amounts and COMPLETED status -> netted above.

  const plannedExpenses = round2(eventVendors.reduce((s, v) => s + v.contractAmount, 0));

  const actualExpenses = round2(
    payments
      .filter((p) => p.direction === 'OUTFLOW' && p.status === 'COMPLETED')
      .reduce((s, p) => s + p.amount, 0)
  );

  const collectedFromClient = inflow;
  const outstandingClientBalance = round2(Math.max(0, totalRevenue - collectedFromClient));
  const remainingBudget = round2(plannedExpenses - actualExpenses);
  const grossEstimatedProfit = round2(totalRevenue - plannedExpenses);
  const actualProfit = round2(collectedFromClient - actualExpenses);
  const profitMargin = totalRevenue > 0 ? round2((grossEstimatedProfit / totalRevenue) * 100) : 0;

  return {
    currency: event.currency,
    contractValue: round2(event.contractValue),
    additionalRevenue: round2(event.additionalRevenue),
    totalRevenue,
    collectedFromClient,
    outstandingClientBalance,
    plannedExpenses,
    actualExpenses,
    remainingBudget,
    grossEstimatedProfit,
    actualProfit,
    profitMargin,
  };
}

export const FINANCIAL_FIELDS_EVENT = ['contractValue', 'additionalRevenue'] as const;
