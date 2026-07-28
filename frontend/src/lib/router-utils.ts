import type { Translation } from '@/i18n';
import type { Language } from '@/types';
import type { SidebarNavItem } from '@/types/layout';
import {
    Cpu,
    KeyRound,
    LayoutDashboard,
    ShieldCheck,
    User,
} from 'lucide-react';

/**
 * Redirects the user to a new page, preserving the current locale.
 * @param {string} path - The path to redirect to.
 * @returns {void}
 */
export function redirectTo(path: string): void {
    const supported = new Set(['en', 'es']);
    const fromPath = window.location.pathname.split('/').filter(Boolean)[0];
    let lang = supported.has(fromPath) ? fromPath : undefined;
    if (!lang) {
        lang = (navigator.language || 'en').split('-')[0];
        if (!supported.has(lang)) lang = 'en';
    }
    window.location.replace('/' + lang + path);
}
/**
 * Generates an array of navigation items for the sidebar.
 * @param {Language} locale - Current locale code ('en' | 'es').
 * @param {Translation} translation - Translation bundle (en/es) used for nav labels.
 * @param {boolean} showAdmin - Whether to surface the Admin nav item (super_admin only).
 * @returns {Array<SidebarNavItem>} An array of navigation items.
 */
export function generateNavbarItems(
    locale: Language,
    translation: Translation,
    showAdmin: boolean
): Array<SidebarNavItem> {
    const navItems: Array<SidebarNavItem> = [
        {
            key: 'dashboard',
            href: `/${locale}/`,
            label: translation.nav.dashboard,
            Icon: LayoutDashboard,
        },
        {
            key: 'devices',
            href: `/${locale}/devices/`,
            label: translation.nav.devices,
            Icon: Cpu,
        },
        {
            key: 'api-keys',
            href: `/${locale}/api-keys`,
            label: translation.apiKeys.title,
            Icon: KeyRound,
        },
    ];
    if (showAdmin) {
        navItems.push({
            key: 'admin',
            href: `/${locale}/admin/`,
            label: translation.nav.admin,
            Icon: ShieldCheck,
        });
    }
    navItems.push({
        key: 'profile',
        href: `/${locale}/profile`,
        label: translation.nav.profile,
        Icon: User,
    });
    return navItems;
}
