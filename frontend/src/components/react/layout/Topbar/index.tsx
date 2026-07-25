import { useEffect, useRef, useState, type JSX } from 'react';
//-- Stores
import { useStore } from '@nanostores/react';
import { $sidebarOpen, closeSidebar, toggleSidebar } from '@/lib/stores/layout';
import { $user } from '@/lib/stores/auth';
//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
import { useTheme } from '@/lib/hooks/useTheme';
//-- Constants
import { MOBILE_BREAKPOINT } from '@/constants/layout';
//-- Utils
import { getInitials } from '@/lib';
//-- Icons
import { Bell, Globe, Menu, Settings as SettingsIcon } from 'lucide-react';
//-- Components
import { ProfileDropdown } from './ProfileDropdown';
import { NotificationsDropdown } from './NotificationDropdown';
import { ThemeGlyph } from './ThemeGlyph';

/**
 * Props for the Topbar component.
 * @interface TopbarProps
 * @property {Language} locale - The current locale.
 * @property {Translation['layout']} layout - The layout strings.
 */
export interface TopbarProps {
    locale: Language;
    layout: Translation['layout'];
}
/**
 * The Topbar component.
 * @param {TopbarProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function Topbar({ locale, layout }: TopbarProps): JSX.Element {
    const sidebarOpen = useStore($sidebarOpen);
    const user = useStore($user);
    const [theme, setTheme] = useTheme();
    const { signOut } = useAuth();
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const update = (): void => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return (): void => mq.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return (): void => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (!sidebarOpen) return;
        const onResize = (): void => {
            if (window.innerWidth > MOBILE_BREAKPOINT) closeSidebar();
        };
        window.addEventListener('resize', onResize);
        return (): void => window.removeEventListener('resize', onResize);
    }, [sidebarOpen]);

    return (
        <header className="gp-topbar">
            {isMobile && (
                <button
                    type="button"
                    className="gp-mobile-menu"
                    onClick={toggleSidebar}
                    aria-label={layout.openMenu}
                >
                    <Menu size={16} strokeWidth={1.6} />
                </button>
            )}
            {/* Actions */}
            <div className="gp-topbar-actions">
                {/* Theme toggle */}
                <button
                    type="button"
                    className="chrome-icon-btn"
                    onClick={() =>
                        setTheme(theme === 'dark' ? 'light' : 'dark')
                    }
                    aria-label={
                        theme === 'dark'
                            ? layout.switchToLight
                            : layout.switchToDark
                    }
                    title={
                        theme === 'dark' ? layout.themeLight : layout.themeDark
                    }
                >
                    <ThemeGlyph theme={theme} />
                </button>
                {/* Language toggle */}
                <LanguageToggle locale={locale} />
                {/* Notifications */}
                <div className="chrome-pop">
                    <button
                        type="button"
                        className={`chrome-icon-btn${notifOpen ? ' is-active' : ''}`}
                        onClick={() => {
                            setNotifOpen(o => !o);
                            setProfileOpen(false);
                        }}
                        aria-label={layout.notifications}
                    >
                        <Bell size={16} strokeWidth={1.6} />
                        <span className="chrome-notif-dot" />
                    </button>
                    {notifOpen && (
                        <NotificationsDropdown
                            layout={layout}
                            handleClose={() => setNotifOpen(false)}
                        />
                    )}
                </div>
                {/* Settings */}
                <button
                    type="button"
                    className="chrome-icon-btn"
                    aria-label={layout.settingsLabel}
                    title={layout.settingsLabel}
                >
                    <SettingsIcon size={16} strokeWidth={1.6} />
                </button>
                {/* Profile */}
                <div className="chrome-pop">
                    <button
                        type="button"
                        className={`chrome-icon-btn chrome-icon-btn--avatar${profileOpen ? ' is-active' : ''}`}
                        onClick={() => {
                            setProfileOpen(o => !o);
                            setNotifOpen(false);
                        }}
                        aria-label={layout.profileMenu}
                    >
                        <span className="gp-sidebar-avatar">
                            {user ? getInitials(user.name) : '?'}
                        </span>
                    </button>
                    {profileOpen && (
                        <ProfileDropdown
                            user={user}
                            layout={layout}
                            theme={theme}
                            setTheme={setTheme}
                            onSignOut={signOut}
                            handleClose={() => setProfileOpen(false)}
                        />
                    )}
                </div>
            </div>
        </header>
    );
}
/**
 * Language toggle button. Swaps the URL prefix between /en/ and /es/ so
 * the Astro router renders the matching locale. Persists the choice in
 * localStorage so the next visit keeps the same language.
 * @param {{ locale: Language }} props - The current locale.
 * @returns {JSX.Element} The rendered button.
 */
function LanguageToggle({ locale }: { locale: Language }): JSX.Element {
    const [currentLocale, setCurrentLocale] = useState<Language>(() => {
        if (typeof document === 'undefined') return locale;
        // Safe: localStorage.getItem returns string | null; the next guard
        // narrows the value to 'en' | 'es' with an explicit equality check.
        const stored = localStorage.getItem('language') as Language | null;
        if (stored === 'en' || stored === 'es') return stored;
        const browser = navigator.language.toLowerCase();
        return browser.startsWith('es') ? 'es' : 'en';
    });

    useEffect(() => {
        localStorage.setItem('language', currentLocale);
    }, [currentLocale]);

    const toggleLanguage = (): void => {
        const next: Language = currentLocale === 'en' ? 'es' : 'en';
        setCurrentLocale(next);
        const pathname = window.location.pathname;
        const newPath = pathname.replace(/^\/(en|es)/, `/${next}`);
        window.location.href = newPath;
    };

    return (
        <button
            type="button"
            className="chrome-icon-btn"
            onClick={toggleLanguage}
            aria-label={
                currentLocale === 'en'
                    ? 'Cambiar a español'
                    : 'Switch to English'
            }
            title={
                currentLocale === 'en'
                    ? 'Cambiar a español'
                    : 'Switch to English'
            }
        >
            <Globe size={16} strokeWidth={1.6} />
        </button>
    );
}
