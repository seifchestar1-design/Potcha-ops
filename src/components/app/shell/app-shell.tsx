'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, CalendarDays, ListChecks, Building2, Wallet, Users,
  ScrollText, FileBarChart2, Settings, Menu, LogOut, Sun, Moon, KeyRound,
  ChevronDown, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/components/app/store';
import { navigate, useRoute, routeToHash, type Route } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { initials } from '@/lib/client/format';
import { api, clearSessionToken } from '@/lib/client/api';

type NavItem = {
  view: Route['view'];
  label: string;
  icon: typeof LayoutDashboard;
  perm?: string;
};

const NAV: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'events', label: 'Events', icon: CalendarDays },
  { view: 'tasks', label: 'Tasks', icon: ListChecks, perm: 'tasks.view' },
  { view: 'vendors', label: 'Vendors', icon: Building2, perm: 'vendors.contacts.view' },
  { view: 'finance', label: 'Finance', icon: Wallet, perm: 'finance.view' },
  { view: 'team', label: 'Team', icon: Users, perm: 'team.manage' },
  { view: 'audit', label: 'Audit log', icon: ScrollText, perm: 'audit.view.finance' },
  { view: 'reports', label: 'Reports', icon: FileBarChart2, perm: 'tasks.view' },
  { view: 'settings', label: 'Settings', icon: Settings },
];

// Platform ADMIN nav — subscriber management is the whole surface. Company
// sections never appear (the role holds zero company-level permissions).
const ADMIN_NAV: NavItem[] = [
  { view: 'admin', label: 'Subscribers', icon: Building2 },
];

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Subscribers — platform admin',
  events: 'Events',
  event: 'Event workspace',
  tasks: 'Tasks',
  vendors: 'Vendor directory',
  finance: 'Finance',
  team: 'Team',
  audit: 'Audit log',
  reports: 'Reports & exports',
  settings: 'Settings',
};

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground">
        P
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Potcha Ops</p>
        <p className="text-[10px] text-muted-foreground">Wedding operations control</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const route = useRoute();
  const user = useAppStore((s) => s.user);
  if (!user) return null;
  const items = user.role === 'ADMIN' ? ADMIN_NAV : NAV.filter((n) => !n.perm || user.perms.includes(n.perm));

  const isActive = (view: Route['view']) =>
    route.view === view || (view === 'events' && route.view === 'event') ||
    (view === 'admin' && user.role === 'ADMIN');

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main navigation">
      {items.map((item) => {
        const active = isActive(item.view);
        return (
          // Plain <a>, not Next <Link>: hash-only hrefs go through Next's
          // router (history.pushState), which never fires `hashchange`, so
          // the SPA view would stay stale. Native anchors fire hashchange.
          <a
            key={item.view}
            href={routeToHash({ view: item.view } as Route)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAppStore((s) => s.user);
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-4">
        <BrandMark />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto scroll-slim px-2 py-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <Separator />
      <div className="px-3 py-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {user?.companyName}
          <br />
          Potcha Ops v1.0 — Trial plan
        </p>
      </div>
    </div>
  );
}

function UserMenu() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const { theme, setTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (!user) return null;

  const logout = async () => {
    try {
      // Sends either the session cookie or the Authorization bearer token —
      // both revoke the session server-side.
      await api('/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    clearSessionToken();
    setUser(null);
    navigate('/dashboard');
    window.location.reload();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2 pl-1.5">
            <Avatar className="h-6.5 w-6.5 h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.name}</span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <StatusBadge kind="role" value={user.role} />
              <span className="text-[10px] text-muted-foreground">
                {user.role === 'ADMIN' ? 'Platform' : `Lvl ${user.role === 'CEO' ? 3 : user.role === 'FINANCE' ? 2 : 1}`}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user.role !== 'ADMIN' && (
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" /> Company & profile settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <KeyRound className="h-4 w-4" /> Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg">
            <p className="font-semibold">Sign out of Potcha Ops?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You will need your email and password to sign back in.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void logout()}>Sign out</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const route = useRoute();
  const user = useAppStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  // The platform admin lands on the subscriber console for every hash route.
  const title = user?.role === 'ADMIN' ? VIEW_TITLES.admin : (VIEW_TITLES[route.view] ?? 'Potcha Ops');

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <SheetDescription className="sr-only">Move between the dashboard, events, tasks, finance and other sections.</SheetDescription>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-serif text-sm font-bold text-primary-foreground">
              P
            </div>
          </div>

          <p className="truncate text-sm font-semibold">{title}</p>

          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 md:inline-flex">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Server-side RBAC active
            </span>
            <UserMenu />
          </div>
        </header>

        {/* Content */}
        <main className="min-w-0 flex-1 px-3 py-4 pb-20 sm:px-5 sm:py-6 md:pb-6">{children}</main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[11px] text-muted-foreground">
          Potcha Ops — Every Wedding. Every Detail. Under Control. · Demo environment ·
          All data is fictional
        </footer>
      </div>
    </div>
  );
}
