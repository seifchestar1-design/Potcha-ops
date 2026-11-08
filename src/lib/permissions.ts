// Potcha Ops — Role & permission model (server-enforced)
// ------------------------------------------------------------------
// Effective permissions = role defaults + CEO-granted extras per user.
// Every API route checks permissions server-side; the frontend only
// hides UI — it is never the security boundary.

export const ROLES = ['CEO', 'FINANCE', 'OPERATIONS'] as const;
export type Role = (typeof ROLES)[number];
// Platform-level role — not a company role. ADMIN accounts live in the
// internal "Potcha Platform" company and manage subscribers (companies,
// quotas, suspension) via /api/admin/*. Never selectable in team management.
export const PLATFORM_ADMIN_ROLE = 'ADMIN' as const;

export const PERMISSIONS = {
  // Company
  'company.overview': 'View company-wide overview and analytics',
  'company.settings.manage': 'Change company settings (name, currency)',
  // Events
  'events.view.all': 'View all company events',
  'events.create': 'Create new events',
  'events.edit': 'Edit any event record',
  'events.delete': 'Archive or delete events',
  // Finance
  'finance.view': 'View budgets, payments, profit and margins',
  'finance.manage': 'Manage budgets and record payments',
  'finance.export': 'Export financial reports',
  // Vendors
  'vendors.contacts.view': 'View vendor contact information',
  'vendors.contacts.manage': 'Add and edit vendor contact information',
  // Tasks
  'tasks.view': 'View operational tasks',
  'tasks.manage': 'Create and update operational tasks',
  // Run sheet
  'runsheet.view': 'View the wedding-day run sheet',
  'runsheet.manage': 'Edit the wedding-day run sheet',
  // Issues
  'issues.view': 'View event issues and incidents',
  'issues.manage': 'Create and resolve event issues',
  // Documents
  'documents.view': 'View and download event documents',
  'documents.upload': 'Upload event documents',
  // Team & governance
  'team.manage': 'Invite, deactivate team members and assign roles',
  'permissions.grant': 'Grant extra permissions to other users',
  'audit.view.all': 'View the full audit log',
  'audit.view.finance': 'View financial audit activity',
  'audit.view.own': 'View own activity only',
  // Notices
  'notices.create': 'Raise financial-risk notices to the CEO',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ALL_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

const CEO_DEFAULT: PermissionKey[] = [...ALL_KEYS];

// Level 2 — financial access, no company administration.
const FINANCE_DEFAULT: PermissionKey[] = [
  'company.overview', // financial view only (financial dashboards/KPIs)
  'events.view.all',
  'finance.view',
  'finance.manage',
  'finance.export',
  'vendors.contacts.view',
  'tasks.view',
  'runsheet.view',
  'issues.view',
  'documents.view',
  'audit.view.finance',
  'notices.create',
];

// Level 1 — operational access. No financial data, no administration.
const OPERATIONS_DEFAULT: PermissionKey[] = [
  // NOTE: no 'events.view.all' — Operations users only see events they are
  // assigned to (enforced per-request in the API layer).
  'vendors.contacts.view',
  'vendors.contacts.manage',
  'tasks.view',
  'tasks.manage',
  'runsheet.view',
  'runsheet.manage',
  'issues.view',
  'issues.manage',
  'documents.view',
  'documents.upload',
  'audit.view.own',
];

export const ROLE_DEFAULTS: Record<Role, PermissionKey[]> = {
  CEO: CEO_DEFAULT,
  FINANCE: FINANCE_DEFAULT,
  OPERATIONS: OPERATIONS_DEFAULT,
};

export function parseExtraPerms(raw: string): PermissionKey[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((k): k is PermissionKey =>
      ALL_KEYS.includes(k as PermissionKey)
    );
  } catch {
    return [];
  }
}

export function effectivePermissions(role: string, extraPermsRaw: string): Set<PermissionKey> {
  // Platform ADMIN: company-scoped permissions never apply — the admin's
  // surface is exclusively the /api/admin/* subscriber-management API.
  if (role === 'ADMIN') return new Set<PermissionKey>();
  const defaults = ROLE_DEFAULTS[(role as Role) ?? 'OPERATIONS'] ?? OPERATIONS_DEFAULT;
  return new Set<PermissionKey>([...defaults, ...parseExtraPerms(extraPermsRaw)]);
}

export function hasPerm(perms: Set<PermissionKey>, key: PermissionKey): boolean {
  return perms.has(key);
}
