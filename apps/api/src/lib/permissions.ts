/** Staff roles → permissions. Mirrors docs/04-authentication.md#roles-and-permissions. */
export const PERMISSIONS = [
  'dashboard.read',
  'orders.read',
  'orders.fulfil',
  'orders.refund',
  'catalog.read',
  'catalog.write',
  'pricing.write',
  'inventory.write',
  'customers.read',
  'reports.finance',
  'settings.write',
  'staff.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = 'owner' | 'admin' | 'ops_manager' | 'warehouse' | 'support' | 'content' | 'accountant';

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(PERMISSIONS.filter((p) => p !== 'staff.manage')),
  ops_manager: new Set<Permission>(['dashboard.read', 'orders.read', 'orders.fulfil', 'orders.refund', 'catalog.read', 'catalog.write', 'inventory.write', 'customers.read']),
  warehouse: new Set<Permission>(['dashboard.read', 'orders.read', 'orders.fulfil', 'catalog.read', 'inventory.write']),
  support: new Set<Permission>(['dashboard.read', 'orders.read', 'orders.refund', 'catalog.read', 'customers.read']),
  content: new Set<Permission>(['catalog.read', 'catalog.write']),
  accountant: new Set<Permission>(['dashboard.read', 'orders.read', 'catalog.read', 'customers.read', 'reports.finance', 'audit.read']),
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  return !!role && (ROLE_PERMISSIONS[role as StaffRole]?.has(permission) ?? false);
}

export function permissionsFor(role: string): Permission[] {
  return [...(ROLE_PERMISSIONS[role as StaffRole] ?? [])];
}
