/** Staff roles → permissions. Mirrors docs/04-authentication.md#roles-and-permissions. */
export const PERMISSIONS = [
  'catalog.read',
  'catalog.write',
  'pricing.write',
  'inventory.write',
  'dispatch.manage',
  'customers.read',
  'customers.write',
  'wallet.adjust',
  'wallet.adjust.unlimited',
  'orders.refund',
  'content.write',
  'marketing.send',
  'reports.finance',
  'settings.write',
  'staff.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = 'owner' | 'admin' | 'ops_manager' | 'dispatch' | 'support' | 'content' | 'accountant';

const all = new Set<Permission>(PERMISSIONS);

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  owner: all,
  admin: new Set(PERMISSIONS.filter((p) => p !== 'staff.manage')),
  ops_manager: new Set<Permission>([
    'catalog.read', 'catalog.write', 'inventory.write', 'dispatch.manage', 'customers.read',
    'customers.write', 'wallet.adjust', 'orders.refund',
  ]),
  dispatch: new Set<Permission>(['catalog.read', 'inventory.write', 'dispatch.manage', 'customers.read']),
  support: new Set<Permission>(['catalog.read', 'customers.read', 'customers.write', 'wallet.adjust']),
  content: new Set<Permission>(['catalog.read', 'catalog.write', 'content.write', 'marketing.send']),
  accountant: new Set<Permission>(['catalog.read', 'customers.read', 'reports.finance', 'audit.read']),
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  return !!role && (ROLE_PERMISSIONS[role as StaffRole]?.has(permission) ?? false);
}

export function permissionsFor(role: string): Permission[] {
  return [...(ROLE_PERMISSIONS[role as StaffRole] ?? [])];
}

/** Roles that must use a TOTP second factor (enforcement lands with the admin TOTP flow). */
export const TOTP_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'accountant']);

/** Max wallet adjustment in paise without wallet.adjust.unlimited. */
export const WALLET_ADJUST_LIMIT_PAISE = 50_000;
