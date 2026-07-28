import type { User } from '@/types/api';
import type { Translation } from '@/i18n';
import type { DataTableColumn } from '@/types/components/ui';
/**
 * @constant USER_TABLE_COLUMNS
 * @description Columns for the user table
 * @type {DataTableColumn[]}
 */
export const USER_TABLE_COLUMNS: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'created', label: 'Created', align: 'center' },
    { key: 'devices', label: 'Devices', align: 'center' },
    { key: 'actions', label: 'Actions', align: 'center' },
];
/**
 * @constant USER_ROLE_VARIANT
 * @description Variant for user role
 * @type {Record<string, 'accent' | 'default'>}
 */
export const USER_ROLE_VARIANT: Record<string, 'accent' | 'default'> = {
    super_admin: 'accent',
    user: 'default',
};
/**
 * @constant USER_ROLE_LABEL
 * @description Label for user role
 * @type {Record<string, string>}
 */
export const USER_ROLE_LABEL: Record<string, string> = {
    super_admin: 'Super Admin',
    user: 'User',
};
/**
 * @constant USER_ROLE_BADGE_VARIANT
 * @description Maps the {@link User.role} enum to the BEM variant used by the
 *   role badge. Shared by `UserTable.tsx` and `UserMobileCard.tsx`.
 * @type {Record<User['role'], 'accent' | 'default'>}
 */
export const USER_ROLE_BADGE_VARIANT: Record<
    User['role'],
    'accent' | 'default'
> = {
    super_admin: 'accent',
    user: 'default',
};
/**
 * @constant USER_ROLE_LABEL_KEY
 * @description Maps the {@link User.role} enum to the localized role label key.
 *   Necessary because the translation keys are camelCase (`superAdmin`,
 *   `user`) while the API role enum is snake_case (`super_admin`, `user`).
 * @type {Record<User['role'], keyof Translation['admin']['roles']>}
 */
export const USER_ROLE_LABEL_KEY: Record<
    User['role'],
    keyof Translation['admin']['roles']
> = {
    super_admin: 'superAdmin',
    user: 'user',
};
