import { getTranslation } from '@/i18n';
import { parseChangePasswordStrings, redirectTo } from '@/lib';
//-- Stores
import { useStore } from '@nanostores/react';
import {
    $isRoleLoaded,
    $mustChangePassword,
    $profile,
} from '@/lib/stores/auth';
import type { JSX } from 'react/jsx-runtime';
import type { Language } from '@/types';
//-- Constants
import { DASHBOARD_PATH } from '@/constants/auth';
//-- Components
import { ChangePasswordModal } from '@/components/react/modal';
import { LanguageToggle, ThemeToggle } from '@/components/react/ui';

/**
 * Props for the ChangePasswordGate component
 * @interface ChangePasswordGateProps
 * @prop {Language} locale - Locale
 */
interface ChangePasswordGateProps {
    locale: Language;
}
/**
 * Sleeper gate that forces the {@link ChangePasswordModal} open whenever
 * the local profile or the middleware signal says the user must rotate
 * their password. Mounted once at the layout level so the modal overlays
 * every authenticated view. Closed automatically once
 * `authService.changePassword()` flips `must_change_password` to
 * `false`; the gate then redirects to the dashboard. Theme and language
 * toggles live in the modal header so the user can adjust them even
 * while pinned to the flow.
 * @param {ChangePasswordGateProps} props - Props for the component
 * @returns {JSX.Element} The rendered component
 */
export function ChangePasswordGate({
    locale,
}: ChangePasswordGateProps): JSX.Element {
    const profile = useStore($profile);
    const mustChangePassword = useStore($mustChangePassword);
    const isRoleLoaded = useStore($isRoleLoaded);

    const strings = parseChangePasswordStrings(getTranslation(locale).auth);

    const open =
        isRoleLoaded &&
        (profile?.must_change_password === true || mustChangePassword === true);

    return (
        <ChangePasswordModal
            open={open}
            strings={strings}
            locked={true}
            onSuccess={() => redirectTo(DASHBOARD_PATH)}
            headerActions={
                <>
                    <ThemeToggle />
                    <LanguageToggle locale={locale} />
                </>
            }
        />
    );
}