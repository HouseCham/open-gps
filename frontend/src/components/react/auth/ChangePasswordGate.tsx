import '@/styles/components/auth/change-password-gate.css';

import { useStore } from '@nanostores/react';
import { type PropsWithChildren, type ReactNode } from 'react';
//-- Stores
import {
    $isRoleLoaded,
    $mustChangePassword,
    $profile,
} from '@/lib/stores/auth';
//-- Services
import { useAuthService } from '@/lib/api/services';
//-- i18n
import { parseChangePasswordStrings } from '@/lib/i18n-utils';
import { getTranslation } from '@/i18n';
//-- Types
import type { Language } from '@/types';
//-- Components
import { LanguageToggle } from '@/components/react/ui/LanguageToggle';
import { ThemeToggle } from '@/components/react/ui/ThemeToggle';
import { RouteFallback } from './RouteFallback';

/**
 * Props for the ChangePasswordGate.
 * @interface ChangePasswordGateProps
 * @property {Language} locale - The page's locale; used to look up
 *   the change-password modal's i18n strings and to drive the
 *   language toggle.
 * @property {ReactNode} [fallback] - Optional custom loading UI while
 *   the profile is being fetched. Defaults to `<RouteFallback />`.
 */
interface ChangePasswordGateProps extends PropsWithChildren {
    locale: Language;
    fallback?: ReactNode;
}

/**
 * Gate for the change-password modal. In case the user must change their password, the change-password modal is rendered.
 * @param {ChangePasswordGateProps} props - The component props.
 * @returns {JSX.Element} The fallback, the modal-only block, or the protected children.
 */
export function ChangePasswordGate({
    locale,
    fallback,
    children,
}: ChangePasswordGateProps): React.JSX.Element {
    const profile = useStore($profile);
    const isRoleLoaded = useStore($isRoleLoaded);
    const mustChangePassword = useStore($mustChangePassword);
    const { fetchProfile } = useAuthService();

    const t = parseChangePasswordStrings(getTranslation(locale).auth);

    /**
     * Re-fetch the profile after a successful password change so the
     * gate sees the cleared `must_change_password` flag. `fetchProfile`
     * sets `$isRoleLoaded` in its own `finally`, so this also covers
     * the rare retry-on-error case.
     */
    const onSuccess = (): void => {
        void fetchProfile();
    };

    if (!isRoleLoaded) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    // Two ways the gate can be triggered:
    //   1. Profile is loaded and `must_change_password === true`.
    //   2. The backend's middleware blocked `/users/me` with 403 and
    //      `must_change_password` body — `$profile` stays `null`, the
    //      `$mustChangePassword` atom is the only signal.
    if (profile?.must_change_password || mustChangePassword) {
        return (
            <>
                <div className="cp-gate-controls" aria-label="Display settings">
                    <LanguageToggle locale={locale} />
                    <ThemeToggle />
                </div>
            </>
        );
    }

    return <>{children}</>;
}
