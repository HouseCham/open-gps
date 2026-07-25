import type { JSX } from 'react';
//-- Stores
import { useStore } from '@nanostores/react';
import { $sidebarOpen, closeSidebar } from '@/lib/stores/layout';
import { $user } from '@/lib/stores/auth';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Constants
import { SHELL_NAV_ITEMS, SIDEBAR_ICONS } from '@/constants/layout';
//-- Utils
import { getInitials } from '@/lib';
import { isSuperAdmin } from '@/lib/role-utils';
import { redirectTo } from '@/lib/router-utils';
//-- Components
import { Button } from '@/components/react/ui/button';

/**
 * Properties for the sidebar component.
 * @interface SidebarProps
 * @property {Language} locale - The current locale.
 * @property {string} pathname - The current pathname.
 * @property {Translation['nav']} nav - The navigation items.
 * @property {Translation['layout']} layout - The layout strings.
 */
export interface SidebarProps {
    locale: Language;
    pathname: string;
    nav: Translation['nav'];
    layout: Translation['layout'];
}
/**
 * Renders the sidebar. This is the left-hand navigation for the app.
 * @param {SidebarProps} props - The props for the component.
 * @returns {JSX.Element} The rendered sidebar.
 */
export function Sidebar({
    locale,
    pathname,
    nav,
    layout,
}: SidebarProps): JSX.Element {
    const sidebarOpen = useStore($sidebarOpen);
    const user = useStore($user);
    const { role } = useAuth();

    /**
     * Filter out items that require the user to be a super admin.
     * @returns {ShellNavItem[]} The filtered items.
     */
    const visibleItems = SHELL_NAV_ITEMS.filter(
        item => !item.requiresRole || isSuperAdmin(role)
    );

    return (
        <aside
            className={`gp-sidebar${sidebarOpen ? ' is-open' : ''}`}
            aria-label={layout.primaryNav}
        >
            <div
                className={`gp-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
                onClick={closeSidebar}
                aria-hidden="true"
            />
            <header className="gp-sidebar-head">
                <div className="gp-sidebar-mark">GPS</div>
                <div>
                    <div className="gp-sidebar-title">{layout.appName}</div>
                    <div className="gp-sidebar-sub">{layout.version}</div>
                </div>
            </header>
            <nav className="gp-sidebar-scroll" aria-label={layout.primaryNav}>
                <div className="gp-sidebar-section">{layout.workspace}</div>
                <div className="gp-sidebar-nav">
                    {visibleItems.map(item => {
                        const Icon = SIDEBAR_ICONS[item.icon];
                        const href = `/${locale}${item.href}`;
                        const isActive =
                            pathname === href ||
                            (href !== `/${locale}` &&
                                pathname.startsWith(`${href}/`));
                        return (
                            <a
                                key={item.id}
                                href={href}
                                className={`gp-sidebar-link${isActive ? ' is-active' : ''}`}
                                aria-current={isActive ? 'page' : undefined}
                                onClick={closeSidebar}
                            >
                                <Icon strokeWidth={1.6} />
                                <span>{nav[item.labelKey]}</span>
                                {item.count !== undefined && (
                                    <span className="gp-sidebar-count">
                                        {item.count}
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>
            </nav>
            <footer className="gp-sidebar-foot">
                <Button
                    type="button"
                    variant="ghost"
                    className="gp-sidebar-user"
                    aria-label={layout.profileMenu}
                    onClick={() => redirectTo('/profile')}
                >
                    <span className="gp-sidebar-avatar">
                        {user ? getInitials(user.name) : layout.unknownInitials}
                    </span>
                    <span className="gp-sidebar-user-info">
                        <span className="gp-sidebar-user-name">
                            {user?.name ?? layout.unknownUser}
                        </span>
                        <span className="gp-sidebar-user-mail">
                            {user?.email ?? layout.unknownMail}
                        </span>
                    </span>
                </Button>
            </footer>
        </aside>
    );
}
