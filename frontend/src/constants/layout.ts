//-- Types
import type {
    ShellNavIcon,
    ShellNavItem,
    ShellNotification,
} from '@/types/components';
//-- Icons
import {
    Key,
    LayoutGrid,
    List,
    type LucideIcon,
    Satellite,
    Settings,
    Users,
} from 'lucide-react';

/**
 * Storage key for the user's theme.
 * @constant {string}
 */
export const THEME_STORAGE_KEY = 'open-gps:theme';
/**
 * Breakpoint for mobile layout.
 * @constant {number}
 */
export const MOBILE_BREAKPOINT = 920;
/**
 * @constant SHELL_NOTIFICATIONS
 * @description Sample notifications
 */
export const SHELL_NOTIFICATIONS: ShellNotification[] = [
    {
        tone: 'danger',
        title: 'Device offline — Vigo Cold-01',
        message: 'No heartbeat in 42m. Battery at 6%.',
        timeAgo: '4m',
        unread: true,
    },
    {
        tone: 'warning',
        title: 'Geofence breach — Van Madrid-01',
        message: 'Exited Plaza Norte perimeter at 12:03 UTC.',
        timeAgo: '12m',
        unread: true,
    },
    {
        tone: 'success',
        title: 'Firmware v2.4.1 deployed',
        message: '42 devices updated · 4 in progress.',
        timeAgo: '38m',
        unread: true,
    },
    {
        tone: 'accent',
        title: 'New driver assigned — J. Vidal',
        message: 'Assigned to Truck BCN-04 by M. Estévez.',
        timeAgo: '1h',
    },
    {
        tone: 'warning',
        title: 'Battery low — Moto Malaga-02',
        message: 'Battery at 31%, last fix 15m ago.',
        timeAgo: '2h',
    },
    {
        tone: 'success',
        title: 'Sync completed',
        message: 'All 128 devices reconciled with gateway.',
        timeAgo: '3h',
    },
];
/**
 * @constant SHELL_NAV_ITEMS
 * @description Navigation items for the shell.
 * @type {ShellNavItem[]}
 */
export const SHELL_NAV_ITEMS: ShellNavItem[] = [
    { id: 'dashboard', href: '/', labelKey: 'dashboard', icon: 'dashboard' },
    {
        id: 'admin',
        href: '/admin',
        labelKey: 'admin',
        icon: 'admin',
        count: 14,
        requiresRole: 'super_admin',
    },
    {
        id: 'devices',
        href: '/devices',
        labelKey: 'devices',
        icon: 'devices',
        count: 128,
    },
    { id: 'access', href: '/access', labelKey: 'access', icon: 'access' },
    {
        id: 'settings',
        href: '/settings',
        labelKey: 'settings',
        icon: 'settings',
    },
    { id: 'reports', href: '/reports', labelKey: 'reports', icon: 'reports' },
];
/**
 * @constant SIDEBAR_ICONS
 * @description Icon for each sidebar item
 * @type {Record<ShellNavIcon, LucideIcon>}
 */
export const SIDEBAR_ICONS: Record<ShellNavIcon, LucideIcon> = {
    dashboard: LayoutGrid,
    devices: Satellite,
    admin: Users,
    settings: Settings,
    reports: List,
    access: Key,
};
