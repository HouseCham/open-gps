import type { JSX } from 'react/jsx-runtime';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import type { Translation } from '@/i18n';

/**
 * Props for the RolePill component.
 * @interface RolePillProps
 * @prop {'user' | 'super_admin'} role - The role to render.
 * @prop {Translation['admin']['roles']} labels - The localized labels for each role.
 */
interface RolePillProps {
    role: 'user' | 'super_admin';
    labels: Translation['admin']['roles'];
}

/**
 * RolePill — pill showing whether the user is a regular user or super admin.
 * @param {RolePillProps} props
 * @returns {JSX.Element}
 */
export function RolePill({ role, labels }: RolePillProps): JSX.Element {
    const isAdmin = role === 'super_admin';
    return (
        <span className={`role-pill${isAdmin ? ' role-pill-admin' : ''}`}>
            {isAdmin ? (
                <ShieldCheck size={11} strokeWidth={1.8} aria-hidden="true" />
            ) : (
                <UserIcon size={11} strokeWidth={1.8} aria-hidden="true" />
            )}
            {isAdmin ? labels.superAdmin : labels.user}
        </span>
    );
}

/**
 * Props for the EmailStatusPill component.
 * @interface EmailStatusPillProps
 * @prop {boolean} verified - Whether the email is verified.
 * @prop {string} verifiedLabel - Label for the verified state.
 * @prop {string} unverifiedLabel - Label for the unverified state.
 */
interface EmailStatusPillProps {
    verified: boolean;
    verifiedLabel: string;
    unverifiedLabel: string;
}

/**
 * EmailStatusPill — pill showing whether the user's email is verified.
 * @param {EmailStatusPillProps} props
 * @returns {JSX.Element}
 */
export function EmailStatusPill({
    verified,
    verifiedLabel,
    unverifiedLabel,
}: EmailStatusPillProps): JSX.Element {
    return (
        <span
            className={`status-pill${verified ? ' status-pill-verified' : ' status-pill-unverified'}`}
        >
            <span className="status-pill-dot" aria-hidden="true" />
            {verified ? verifiedLabel : unverifiedLabel}
        </span>
    );
}

/**
 * Props for the PasswordPill component.
 * @interface PasswordPillProps
 * @prop {boolean} mustChange - Whether the user must change their password.
 * @prop {string} okLabel - Label shown when password is fine.
 * @prop {string} changeLabel - Label shown when password must change.
 */
interface PasswordPillProps {
    mustChange: boolean;
    okLabel: string;
    changeLabel: string;
}

/**
 * PasswordPill — pill showing whether the user must change their password.
 * @param {PasswordPillProps} props
 * @returns {JSX.Element}
 */
export function PasswordPill({
    mustChange,
    okLabel,
    changeLabel,
}: PasswordPillProps): JSX.Element {
    return (
        <span
            className={`password-pill${mustChange ? ' password-pill-change' : ' password-pill-ok'}`}
        >
            {mustChange ? changeLabel : okLabel}
        </span>
    );
}
