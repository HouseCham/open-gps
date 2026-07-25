import { useRef, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { AuthUser } from '@/types/api';
//-- Icons
import {
    HelpCircle,
    LogOut,
    Moon,
    Shield,
    Sun,
    User as UserIcon,
} from 'lucide-react';
//-- Components
import { Button } from '@/components/react/ui/button';
import { MenuItem } from './MenuItem';
//-- Utils
import { getInitials, useClickOutside } from '@/lib';
import { redirectTo } from '@/lib/router-utils';
import { REPOSITORY_URL } from '@/constants';

/**
 * Properties for the profile dropdown component.
 * @interface ProfileDropdownProps
 * @property {Translation['layout']} layout - The layout strings.
 * @property {string} theme - The current theme.
 * @property {AuthUser | null} user - The current user.
 * @property {(next: 'light' | 'dark') => void} setTheme - The function to set the theme.
 * @property {() => void} onSignOut - The function to sign out.
 * @property {() => void} handleClose - The function to close the dropdown.
 */
interface ProfileDropdownProps {
    layout: Translation['layout'];
    theme: 'light' | 'dark';
    user: AuthUser | null;
    setTheme: (next: 'light' | 'dark') => void;
    onSignOut: () => void;
    handleClose: () => void;
}
/**
 * The profile dropdown component.
 * @param {ProfileDropdownProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function ProfileDropdown({
    layout,
    theme,
    user,
    setTheme,
    onSignOut,
    handleClose,
}: ProfileDropdownProps): JSX.Element {
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, handleClose);

    return (
        <div className="chrome-dropdown chrome-dropdown--profile" ref={ref}>
            <div className="chrome-profile-card">
                <div className="chrome-profile-avatar">
                    {user ? getInitials(user.name) : '?'}
                </div>
                <div className="chrome-profile-info">
                    <div className="chrome-profile-name">
                        {user?.name ?? layout.unknownUser}
                    </div>
                    <div className="chrome-profile-mail">
                        {user?.email ?? layout.unknownMail}
                    </div>
                    <div className="chrome-profile-org">
                        <Shield size={10} strokeWidth={1.6} />
                        {layout.superAdminOrg}
                    </div>
                </div>
            </div>
            {/* Appearance */}
            <div className="chrome-menu-section">
                <div className="chrome-menu-label">{layout.appearance}</div>
                <div className="chrome-theme-toggle">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`chrome-theme-toggle-btn${theme === 'light' ? ' is-active' : ''}`}
                        icon={<Sun size={13} strokeWidth={1.6} />}
                        onClick={() => setTheme('light')}
                    >
                        {layout.themeLight}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`chrome-theme-toggle-btn${theme === 'dark' ? ' is-active' : ''}`}
                        icon={<Moon size={13} strokeWidth={1.6} />}
                        onClick={() => setTheme('dark')}
                    >
                        {layout.themeDark}
                    </Button>
                </div>
            </div>
            <div className="chrome-menu-divider" />

            {/* Settings */}
            <div className="chrome-menu-section">
                {/* User settings */}
                <MenuItem
                    icon={UserIcon}
                    label={layout.accountSettings}
                    onClick={() => redirectTo('/profile')}
                />
                {/* Help & docs */}
                <MenuItem
                    icon={HelpCircle}
                    label={layout.helpDocs}
                    href={REPOSITORY_URL}
                />
            </div>
            <div className="chrome-menu-divider" />
            <div className="chrome-menu-section">
                <MenuItem
                    icon={LogOut}
                    label={layout.signOut}
                    shortcut="⌘Q"
                    danger
                    onClick={onSignOut}
                />
            </div>
        </div>
    );
}
