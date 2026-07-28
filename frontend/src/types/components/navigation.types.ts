/**
 * Navigation icon.
 * @type {ShellNavIcon}
 */
export type ShellNavIcon =
    | 'dashboard'
    | 'devices'
    | 'admin'
    | 'settings'
    | 'reports'
    | 'access';
/**
 * Minimum user role required to see this item in the sidebar. Items
 * without a `requiresRole` are visible to every authenticated user.
 * The server is still the source of truth — this flag only filters
 * client-side rendering.
 * @typedef {'super_admin'} ShellNavItemRole
 */
export type ShellNavItemRole = 'super_admin';
/**
 * Navigation item.
 * @interface ShellNavItem
 * @prop {ShellNavIcon} id - Navigation icon.
 * @prop {string} href - Navigation link.
 * @prop {'dashboard' | 'devices' | 'usersRoles' | 'settings' | 'reports' | 'access'} labelKey - Navigation label.
 * @prop {ShellNavIcon} icon - Navigation icon.
 * @prop {number} [count] - Notification count.
 * @prop {ShellNavItemRole} [requiresRole] - When set, the item is only shown to users with at least this role.
 */
export interface ShellNavItem {
    id: ShellNavIcon;
    href: string;
    labelKey:
        | 'dashboard'
        | 'devices'
        | 'admin'
        | 'settings'
        | 'reports'
        | 'access';
    icon: ShellNavIcon;
    count?: number;
    requiresRole?: ShellNavItemRole;
}
