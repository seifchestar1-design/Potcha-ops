'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ShieldCheck, UserPlus, Copy, KeyRound, Ban, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { api, ApiClientError } from '@/lib/client/api';
import type { TeamMemberRow, LimitsData } from '@/lib/client/types';
import { PERMISSIONS } from '@/lib/permissions';
import { fmtDate, fmtRelative } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

export function TeamView() {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [grantsFor, setGrantsFor] = useState<TeamMemberRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ member: TeamMemberRow; action: 'activate' | 'deactivate' | 'makeceo' | 'demote' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: TeamMemberRow[] }>('/team'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['team'] });
    queryClient.invalidateQueries({ queryKey: ['limits'] });
  };

  // Platform-admin seat quota — shown as a badge; the Invite button is
  // disabled when all seats are taken (the API rejects with 409 anyway).
  const { data: limits } = useQuery({
    queryKey: ['limits'],
    queryFn: () => api<LimitsData>('/limits'),
    staleTime: 30_000,
  });
  const seatsFull = !!limits?.members && limits.members.used >= limits.members.max;

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/team/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { toast.success('Team member updated'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const doAction = (member: TeamMemberRow, action: 'activate' | 'deactivate' | 'makeceo' | 'demote') => {
    if (action === 'activate') {
      update.mutate({ id: member.id, body: { status: 'ACTIVE' } });
      setConfirmAction(null);
    } else if (action === 'deactivate') {
      update.mutate({ id: member.id, body: { status: 'DISABLED' } });
      setConfirmAction(null);
    } else if (action === 'makeceo') {
      update.mutate({ id: member.id, body: { role: 'CEO' } });
      setConfirmAction(null);
    } else if (action === 'demote') {
      update.mutate({ id: member.id, body: { role: 'OPERATIONS' } });
      setConfirmAction(null);
    }
  };

  const members = data?.members ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team & permissions"
        description="Invite members, assign roles and grant extra permissions. Role changes revoke the member's active sessions immediately."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {limits?.members && (
              <Badge
                variant={seatsFull ? 'destructive' : 'outline'}
                className="text-[10px] tabular"
                aria-label={`${limits.members.used} of ${limits.members.max} team seats used`}
              >
                {limits.members.used} / {limits.members.max} seats
              </Badge>
            )}
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              disabled={seatsFull}
              title={seatsFull ? 'Team seat limit reached — ask the platform administrator to add seats' : undefined}
            >
              <UserPlus className="mr-1 h-4 w-4" aria-hidden /> Invite member
            </Button>
          </div>
        }
      />

      {/* Permission matrix legend */}
      <Card>
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Security levels
          </p>
          <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
            <p><span className="font-medium text-foreground">CEO — Level 3:</span> full company oversight, finances, team and settings.</p>
            <p><span className="font-medium text-foreground">Finance — Level 2:</span> financial access; no company administration.</p>
            <p><span className="font-medium text-foreground">Operations — Level 1:</span> assigned events and execution; no financial data.</p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            All permissions are enforced server-side on every request. Extra permissions can be granted per user below.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-slim">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Extra permissions</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium">{m.name} {m.id === user?.id && <span className="text-[10px] text-muted-foreground">(you)</span>}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                        {m.lastLoginAt && (
                          <p className="text-[10px] text-muted-foreground">last seen {fmtRelative(m.lastLoginAt)}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="role" value={m.role} />
                        <div className="mt-1">
                          <Select
                            value={m.role}
                            onValueChange={(v) => {
                              if (v === m.role) return;
                              if (v === 'CEO') setConfirmAction({ member: m, action: 'makeceo' });
                              else setConfirmAction({ member: m, action: 'demote' });
                            }}
                          >
                            <SelectTrigger className="h-7 w-32 text-[11px]" aria-label={`Change role for ${m.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CEO">CEO</SelectItem>
                              <SelectItem value="FINANCE">Finance</SelectItem>
                              <SelectItem value="OPERATIONS">Operations</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge variant={m.status === 'ACTIVE' ? 'default' : m.status === 'INVITED' ? 'secondary' : 'destructive'} className="text-[10px]">
                            {m.status === 'ACTIVE' ? 'Active' : m.status === 'INVITED' ? 'Invited' : 'Disabled'}
                          </Badge>
                          {m.status !== 'ACTIVE' && m.status !== 'DISABLED' && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                              onClick={() => update.mutate({ id: m.id, body: { status: 'ACTIVE' } })}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.role === 'CEO' ? (
                          <span className="text-xs text-muted-foreground">All permissions</span>
                        ) : m.extraPerms.length > 0 ? (
                          <div className="flex max-w-48 flex-wrap gap-1">
                            {m.extraPerms.slice(0, 3).map((p) => (
                              <Badge key={p} variant="outline" className="text-[9px]">{p}</Badge>
                            ))}
                            {m.extraPerms.length > 3 && (
                              <Badge variant="outline" className="text-[9px]">+{m.extraPerms.length - 3}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Role defaults only</span>
                        )}
                        {m.role !== 'CEO' && (
                          <Button size="sm" variant="ghost" className="mt-1 h-6 px-2 text-[10px]"
                            onClick={() => setGrantsFor(m)}>
                            {m.extraPerms.length > 0 ? 'Adjust grants' : 'Grant permission…'}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.assignedEvents !== undefined && <p>{m.assignedEvents} events</p>}
                        {m.openTasks !== undefined && <p>{m.openTasks} tasks</p>}
                        <p className="text-[10px]">joined {fmtDate(m.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${m.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.status === 'INVITED' && (
                              <DropdownMenuItem onClick={() => update.mutate({ id: m.id, body: { status: 'ACTIVE' } })}>
                                <CheckCircle2 className="h-4 w-4" /> Activate account
                              </DropdownMenuItem>
                            )}
                            {m.status === 'ACTIVE' && m.id !== user?.id && (
                              <DropdownMenuItem variant="destructive" onClick={() => setConfirmAction({ member: m, action: 'deactivate' })}>
                                <Ban className="h-4 w-4" /> Deactivate
                              </DropdownMenuItem>
                            )}
                            {m.status === 'DISABLED' && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ member: m, action: 'activate' })}>
                                <CheckCircle2 className="h-4 w-4" /> Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={invalidate} />
      <GrantDialog member={grantsFor} onOpenChange={(v) => !v && setGrantsFor(null)} onSaved={invalidate} />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title={
          confirmAction?.action === 'deactivate'
            ? `Deactivate ${confirmAction.member.name}?`
            : confirmAction?.action === 'activate'
              ? `Reactivate ${confirmAction.member.name}?`
              : confirmAction?.action === 'makeceo'
                ? `Promote ${confirmAction?.member.name} to CEO?`
                : `Change ${confirmAction?.member.name} to Operations?`
        }
        description={
          confirmAction?.action === 'deactivate'
            ? 'Their sessions are revoked immediately and they cannot sign in until reactivated.'
            : confirmAction?.action === 'makeceo'
              ? 'They will gain full company oversight. Their active sessions are refreshed with the new role.'
              : 'Their active sessions are refreshed with the new role.'
        }
        confirmLabel={confirmAction?.action === 'deactivate' ? 'Deactivate' : 'Confirm'}
        destructive={confirmAction?.action === 'deactivate'}
        onConfirm={() => confirmAction && doAction(confirmAction.member, confirmAction.action)}
      />
    </div>
  );
}

function InviteDialog({
  open, onOpenChange, onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInvited: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'OPERATIONS' });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setTempPassword(null);
      setF({ name: '', email: '', phone: '', role: 'OPERATIONS' });
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ tempPassword: string }>('/team', {
        method: 'POST',
        body: { ...f, phone: f.phone || null },
      });
      setTempPassword(res.tempPassword);
      onInvited();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            The account is created in INVITED status. Share the temporary password securely —
            it is shown only once and never stored in plain text.
          </DialogDescription>
        </DialogHeader>
        {tempPassword ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="text-xs font-semibold">Temporary password</p>
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
              <div className="space-y-1.5">
                <Label htmlFor="inv-name">Name</Label>
                <Input id="inv-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Role</Label>
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                  <SelectTrigger id="inv-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATIONS">Operations (L1)</SelectItem>
                    <SelectItem value="FINANCE">Finance (L2)</SelectItem>
                    <SelectItem value="CEO">CEO (L3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="inv-phone">Phone (optional)</Label>
                <Input id="inv-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                <KeyRound className="mr-1 h-4 w-4" aria-hidden />
                {busy ? 'Creating…' : 'Create & generate password'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GrantDialog({
  member, onOpenChange, onSaved,
}: {
  member: TeamMemberRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [lastMember, setLastMember] = useState<string | null | undefined>(undefined);
  const currentMemberId = member?.id ?? null;
  if (currentMemberId !== lastMember) {
    setLastMember(currentMemberId);
    setSelected(member?.extraPerms ?? []);
    setError(null);
  }

  const grantable = (Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).filter(
    (p) => !['audit.view.all', 'team.manage', 'permissions.grant', 'company.settings.manage', 'events.delete'].includes(p)
  );

  // Finance-access quick toggle: the common case the CEO reaches for with an
  // Operations member. Grants `finance.view` (budgets, payments, margins) —
  // recording payments and exports stay opt-in via the advanced list below.
  const FINANCE_VIEW = 'finance.view' as const;
  const FINANCE_DEPS = ['finance.manage', 'finance.export'] as const;
  const hasFinanceView = selected.includes(FINANCE_VIEW);
  // Finance role members already have finance.view via role defaults, so the
  // toggle only matters for Operations members (and CEOs, who have everything).
  const financeToggleRelevant = member?.role === 'OPERATIONS';

  const toggleFinanceView = (on: boolean) => {
    if (on) {
      if (!selected.includes(FINANCE_VIEW)) setSelected([...selected, FINANCE_VIEW]);
    } else {
      // Turning off finance.view also clears the dependent finance perms the
      // CEO may have added — otherwise they'd be silently inert without view.
      setSelected(selected.filter((p) => p !== FINANCE_VIEW && !(FINANCE_DEPS as readonly string[]).includes(p)));
    }
  };

  const save = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/team/${member.id}`, { method: 'PATCH', body: { extraPerms: selected } });
      toast.success('Permissions updated', { description: `${member.name}: ${selected.length} extra permission${selected.length === 1 ? '' : 's'}` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto scroll-slim sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant extra permissions — {member?.name}</DialogTitle>
          <DialogDescription>
            Role defaults always apply. Grant additional capabilities as needed — e.g. let Finance manage tasks.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        {/* Finance access — the one-click control the CEO uses most. */}
        {financeToggleRelevant && (
          <>
            <div className={`rounded-lg border p-3 transition-colors ${hasFinanceView ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
              <label htmlFor="fin-toggle" className="flex cursor-pointer items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Wallet className="h-4 w-4 text-primary" aria-hidden /> Finance access
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                    Let this Operations member see budgets, payments and margins. Off by default —
                    they get the Finance nav link, the ledger and event Budget tabs. Recording payments
                    and report exports can be added below.
                  </span>
                </span>
                <Switch
                  id="fin-toggle"
                  checked={hasFinanceView}
                  onCheckedChange={toggleFinanceView}
                  aria-label={`Grant finance view to ${member?.name}`}
                />
              </label>
            </div>
            <Separator />
          </>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Advanced permissions</p>
        <div className="space-y-1.5">
          {grantable.map((p) => (
            <label key={p} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition-colors hover:bg-accent/40">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(p)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, p] : selected.filter((x) => x !== p))
                }
              />
              <span>
                <span className="font-mono text-[10px] text-muted-foreground">{p}</span>
                <span className="block">{PERMISSIONS[p]}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save grants'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
