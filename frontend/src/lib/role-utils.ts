import type { UserRole } from '@/types/api';

/**
 * Returns `true` when the role grants admin access. Centralises the
 * comparison so the rest of the app stops repeating
 * `role === 'super_admin'`.
 *
 * @param {UserRole | null | undefined} role - The role to test. A
 *   `null` / `undefined` value (role not yet fetched, or user signed
 *   out) returns `false` — failing closed.
 * @returns {boolean} `true` for super admins.
 */
export function isSuperAdmin(
    role: UserRole | null | undefined
): boolean {
    return role === 'super_admin';
}
