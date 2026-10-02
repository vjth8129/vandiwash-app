import type { Permission, Role, UserStatus } from '@/api';

export const USER_STATUS: Record<UserStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: '#0E6B3A', bg: '#D6F5E3' },
  INACTIVE: { label: 'Inactive', color: '#3F4A56', bg: '#E6EAEE' },
  SUSPENDED: { label: 'Suspended', color: '#9B1C1C', bg: '#FDE2E2' },
};

/** "SUPER_ADMIN" -> "Super admin"; custom names are shown as typed. */
export function roleLabel(name: string | undefined) {
  if (!name) return '';
  if (name !== name.toUpperCase()) return name;
  const words = name.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The server only lets a user hand out roles/permissions they hold themselves,
 * so a role is assignable when all of its permissions are in the caller's set.
 */
export function canAssignRole(role: Role, myPermissions: Set<string>) {
  return role.permissions.every((p) => myPermissions.has(p.key));
}

/** Group the permission catalog by module (APP, BOOKINGS, ...) for the role editor. */
export function groupByModule(perms: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const p of perms) {
    const module = p.module ?? p.key.split('_')[0];
    groups.set(module, [...(groups.get(module) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, items]) => ({ module: roleLabel(module), items }));
}
