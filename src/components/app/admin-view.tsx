'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Plus, Users, CalendarDays, Ban, RotateCcw, Pencil, Copy, KeyRound,
  ShieldCheck, Inbox, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { LimitsData } from '@/lib/client/types';
import { fmtDate, fmtRelative } from '@/lib/client/format';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';
import { KpiCard } from '@/components/app/ui/kpi-card';

// ============================================================================
// AdminView — the platform administrator's console (role === 'ADMIN').
// Subscriber management: create company workspaces with their CEO account,
// set event & team quotas, suspend or restore access.
// ============================================================================

type AdminCompanyRow = {
  id: string;
  name: string;
  plan: string;
  currency: string;
  isDemo: boolean;
  maxEvents: number;
  maxTeamMembers: number;
  usedEvents: number;
  usedMembers: number;
  memberCount: number;
  disabledAt: string | null;
  createdAt: string;
  ceoName: string | null;
  ceoEmail: string | null;
  ceoLastLoginAt: string | null;
};

export function AdminView() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<AdminCompanyRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ company: AdminCompanyRow; action: 'suspend' | 'restore' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api<{ companies: AdminCompanyRow[] }>('/admin/companies'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-companies'] });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/admin/companies/${id}`, { method: 'PATCH', body }),
    onSuccess: (_res, vars) => {
      const c = data?.companies.find((x) => x.id === vars.id);
      toast.success(
        vars.body.disabled === true ? 'Workspace suspended' : vars.body.disabled === false ? 'Workspace restored' : 'Subscriber updated',
        { description: c ? `${c.name} — changes apply immediately.` : undefined }
      );
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const companies = data?.companies ?? [];
  const active = companies.filter((c) => !c.disabledAt);
  const suspended = companies.filter((c) => c.disabledAt);
  const eventsInUse = companies.reduce((s, c) => s + c.usedEvents, 0);
  const seatsInUse = companies.reduce((s, c) => s + c.usedMembers, 0);

  const doAction = (company: AdminCompanyRow, action: 'suspend' | 'restore') => {
    patch.mutate({ id: company.id, body: { disabled: action === 'suspend' } });
    setConfirmAction(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscribers"
        description="Create company workspaces, set their event & team quotas, suspend or restore access. Only you can create companies — self-registration is closed."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> New company
          </Button>
        }
      />

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Subscribers" value={companies.length} icon={Building2} loading={isLoading} />
        <KpiCard label="Active" value={active.length} icon={ShieldCheck} tone="positive" loading={isLoading} />
        <KpiCard label="Events in use" value={eventsInUse} icon={CalendarDays} tone="info" loading={isLoading} />
        <KpiCard label="Team seats in use" value={seatsInUse} icon={Users} tone="info" loading={isLoading} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Inbox}
              title="No subscriber companies yet"
              description="Create the first company workspace — you set its CEO account, event quota and team seats."
              className="border-0"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-slim">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>CEO</TableHead>
                    <TableHead>Event quota</TableHead>
                    <TableHead>Team seats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.id} className={c.disabledAt ? 'opacity-60' : undefined}>
                      <TableCell>
                        <p className="font-medium">
                          {c.name}
                          {c.isDemo && <Badge variant="outline" className="ml-1.5 text-[9px]">demo</Badge>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.plan} plan · {c.currency} · joined {fmtDate(c.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        {c.ceoName ? (
                          <>
                            <p className="text-xs font-medium">{c.ceoName}</p>
                            <p className="text-[11px] text-muted-foreground">{c.ceoEmail}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.ceoLastLoginAt ? `last seen ${fmtRelative(c.ceoLastLoginAt)}` : 'never signed in'}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <QuotaBar used={c.usedEvents} max={c.maxEvents} label="events" />
                      </TableCell>
                      <TableCell>
                        <QuotaBar used={c.usedMembers} max={c.maxTeamMembers} label="seats" />
                      </TableCell>
                      <TableCell>
                        {c.disabledAt ? (
                          <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px]">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditFor(c)}>
                            <Pencil className="mr-1 h-3 w-3" aria-hidden /> Limits
                          </Button>
                          {c.disabledAt ? (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setConfirmAction({ company: c, action: 'restore' })}>
                              <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> Restore
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 border-red-500/40 px-2 text-[11px] text-red-700 dark:text-red-400" onClick={() => setConfirmAction({ company: c, action: 'suspend' })}>
                              <Ban className="mr-1 h-3 w-3" aria-hidden /> Suspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy note */}
      <Card>
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> How subscriber limits work
          </p>
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <li>· <span className="font-medium text-foreground">Event quota</span> — a CEO can create events until the quota is reached; archiving a completed event frees its slot.</li>
            <li>· <span className="font-medium text-foreground">Team seats</span> — the CEO invites team members up to the seat count; deactivating a member frees their seat.</li>
            <li>· <span className="font-medium text-foreground">Suspend</span> — blocks every login and kills all live sessions of that company instantly; restore brings it back unchanged.</li>
            <li>· Every quota change and suspension is written to the subscriber's own audit trail.</li>
          </ul>
        </CardContent>
      </Card>

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditLimitsDialog company={editFor} onOpenChange={(v) => !v && setEditFor(null)} onSaved={invalidate} />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title={
          confirmAction?.action === 'suspend'
            ? `Suspend ${confirmAction.company.name}?`
            : `Restore ${confirmAction?.company.name}?`
        }
        description={
          confirmAction?.action === 'suspend'
            ? 'Every member of this company is signed out immediately and cannot log in until you restore the workspace. No data is deleted.'
            : 'Members can sign in again — the workspace and all its data are exactly as they were.'
        }
        confirmLabel={confirmAction?.action === 'suspend' ? 'Suspend workspace' : 'Restore workspace'}
        destructive={confirmAction?.action === 'suspend'}
        onConfirm={() => confirmAction && doAction(confirmAction.company, confirmAction.action)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- quota bar
function QuotaBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / max) * 100));
  const tone = used >= max ? 'bg-red-500' : used >= max * 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
  const text = used >= max ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
  return (
    <div className="w-36 max-w-full">
      <p className={`text-xs font-medium tabular ${text}`} aria-label={`${used} of ${max} ${label} used`}>
        {used} / {max} <span className="text-[10px] font-normal">{label}</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label={`${label} quota usage`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- create dialog
function CreateCompanyDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [f, setF] = useState({
    companyName: '', ceoName: '', ceoEmail: '', password: '',
    currency: 'EGP', plan: 'TRIAL',
    maxEvents: '10', maxTeamMembers: '5',
  });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setTempPassword(null);
      setF({ companyName: '', ceoName: '', ceoEmail: '', password: '', currency: 'EGP', plan: 'TRIAL', maxEvents: '10', maxTeamMembers: '5' });
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ tempPassword?: string }>('/admin/companies', {
        method: 'POST',
        body: {
          companyName: f.companyName,
          ceoName: f.ceoName,
          ceoEmail: f.ceoEmail,
          ...(f.password ? { password: f.password } : {}),
          currency: f.currency,
          plan: f.plan,
          maxEvents: Number(f.maxEvents),
          maxTeamMembers: Number(f.maxTeamMembers),
        },
      });
      setTempPassword(res.tempPassword ?? null);
      onCreated();
      if (!res.tempPassword) {
        toast.success('Company created', { description: `${f.companyName} — CEO ${f.ceoEmail} can sign in now.` });
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Creation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a subscriber company</DialogTitle>
          <DialogDescription>
            You are the only one who can create workspaces. The CEO signs in, builds the team and
            creates events within the quotas you set here.
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="text-xs font-semibold">Company created — temporary CEO password</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Share it securely with {f.ceoEmail}. It is shown only once and never stored in plain text.
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">{tempPassword}</code>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(tempPassword); toast.success('Copied to clipboard'); }}>
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nc-company">Company name</Label>
                <Input id="nc-company" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} required minLength={2} placeholder="e.g. Nile Vows Wedding Planning" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-ceo-name">CEO name</Label>
                <Input id="nc-ceo-name" value={f.ceoName} onChange={(e) => setF({ ...f, ceoName: e.target.value })} required minLength={2} placeholder="e.g. Mona Salah" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-ceo-email">CEO email</Label>
                <Input id="nc-ceo-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={f.ceoEmail} onChange={(e) => setF({ ...f, ceoEmail: e.target.value })} required placeholder="ceo@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-password">CEO password (optional)</Label>
                <Input id="nc-password" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Leave empty to auto-generate" aria-describedby="nc-password-hint" />
                <p id="nc-password-hint" className="text-[10px] text-muted-foreground">Min 8 chars with a letter and a number if provided.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
                  <SelectTrigger aria-label="Company currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['EGP', 'USD', 'EUR', 'SAR', 'AED'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={f.plan} onValueChange={(v) => setF({ ...f, plan: v })}>
                  <SelectTrigger aria-label="Subscription plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                    <SelectItem value="GROWTH">Growth</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden /> Quotas — the limits you give this company
              </p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nc-events">Max events</Label>
                  <Input id="nc-events" type="number" min={0} max={10000} value={f.maxEvents} onChange={(e) => setF({ ...f, maxEvents: e.target.value })} required aria-describedby="nc-events-hint" />
                  <p id="nc-events-hint" className="text-[10px] text-muted-foreground">Concurrent non-archived events.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-seats">Team seats</Label>
                  <Input id="nc-seats" type="number" min={1} max={1000} value={f.maxTeamMembers} onChange={(e) => setF({ ...f, maxTeamMembers: e.target.value })} required aria-describedby="nc-seats-hint" />
                  <p id="nc-seats-hint" className="text-[10px] text-muted-foreground">Members the CEO can invite (CEO included).</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                <KeyRound className="mr-1 h-4 w-4" aria-hidden />
                {busy ? 'Creating…' : 'Create company & CEO'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- edit limits dialog
function EditLimitsDialog({
  company, onOpenChange, onSaved,
}: {
  company: AdminCompanyRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', plan: 'TRIAL', maxEvents: '10', maxTeamMembers: '5' });

  const [lastId, setLastId] = useState<string | null | undefined>(undefined);
  const currentId = company?.id ?? null;
  if (currentId !== lastId) {
    setLastId(currentId);
    if (company) {
      setF({ name: company.name, plan: company.plan, maxEvents: String(company.maxEvents), maxTeamMembers: String(company.maxTeamMembers) });
      setError(null);
    }
  }

  const save = async () => {
    if (!company) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/companies/${company.id}`, {
        method: 'PATCH',
        body: {
          name: f.name,
          plan: f.plan,
          maxEvents: Number(f.maxEvents),
          maxTeamMembers: Number(f.maxTeamMembers),
        },
      });
      toast.success('Subscriber updated', { description: `${f.name} — quotas apply immediately.` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quotas — {company?.name}</DialogTitle>
          <DialogDescription>
            Current usage: {company?.usedEvents}/{company?.maxEvents} events · {company?.usedMembers}/{company?.maxTeamMembers} seats.
            Lowering a quota below current usage does not delete anything — it only blocks new creation.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="el-name">Company name</Label>
            <Input id="el-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={f.plan} onValueChange={(v) => setF({ ...f, plan: v })}>
              <SelectTrigger aria-label="Subscription plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="GROWTH">Growth</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="el-events">Max events</Label>
              <Input id="el-events" type="number" min={0} max={10000} value={f.maxEvents} onChange={(e) => setF({ ...f, maxEvents: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="el-seats">Team seats</Label>
              <Input id="el-seats" type="number" min={1} max={1000} value={f.maxTeamMembers} onChange={(e) => setF({ ...f, maxTeamMembers: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
