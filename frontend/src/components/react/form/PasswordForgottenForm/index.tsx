import '@/styles/components/form/password-forgotten-form.css';

import { useEffect, useState, lazy } from 'react';
//-- Types
import type { PasswordForgottenFormStrings, PasswordRecoveryPhase } from '@/types/components';
import type { FormEvent, JSX } from 'react';
import type { Language } from '@/types';
//-- Constants
import { EMAIL_REGEX } from '@/constants/regex';
import { PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS } from '@/constants/auth';
//-- Components
import { RequestState } from './RequestState';
//-- Utils
import { copyToClipboard } from '@/lib';
import { isApiError } from '@/lib/api/api-utils';
//-- Services
import { useAuthService } from '@/lib/api/services';
//-- Lazy components
const SentState = lazy(() => import('./SentState').then(module => ({ default: module.SentState })));

/**
 * Props for the PasswordForgottenForm component.
 * @interface PasswordForgottenFormProps
 * @prop {PasswordForgottenFormStrings} strings - i18n strings.
 * @prop {Language} locale - Locale code forwarded to the recovery API.
 * @prop {string} resetPasswordUrlPrefix - URL prefix for the reset link
 *   (the backend appends `?token=…`). Built by the .astro page.
 * @prop {string} origin - Absolute origin used to render the dev API
 *   inspector body. SSR-safe because it's a string, not `window`.
 */
export interface PasswordForgottenFormProps {
    strings: PasswordForgottenFormStrings;
    locale: Language;
    resetPasswordUrlPrefix: string;
    origin: string;
}

/**
 * PasswordForgottenForm — request a password-reset email, then show the
 * "check your inbox" confirmation card with a 60s resend cooldown.
 * @param {PasswordForgottenFormProps} props
 * @returns {JSX.Element}
 */
export function PasswordForgottenForm({
    strings,
    locale,
    resetPasswordUrlPrefix,
    origin,
}: PasswordForgottenFormProps): JSX.Element {
    const { requestPasswordRecovery } = useAuthService();
    const [phase, setPhase] = useState<PasswordRecoveryPhase>('request');
    const [email, setEmail] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [resent, setResent] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const id = window.setInterval(
            () => setCooldown(c => Math.max(0, c - 1)),
            1000,
        );
        return (): void => window.clearInterval(id);
    }, [cooldown]);

    /**
     * Handles the form submission for requesting a password recovery email.
     * Validates the email and sends a request to the backend.
     * @param {FormEvent<HTMLFormElement>} e - The form submission event.
     * @returns {Promise<void>}
     */
    async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setErr(null);
        const trimmed = email.trim();
        if (!trimmed) {
            setErr(strings.emailRequired);
            return;
        }
        if (!EMAIL_REGEX.test(trimmed)) {
            setErr(strings.emailInvalid);
            return;
        }
        setLoading(true);
        try {
            await requestPasswordRecovery({
                email: trimmed,
                locale,
                reset_password_url: resetPasswordUrlPrefix,
            });
            setEmail(trimmed);
            setResent(false);
            setCooldown(PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS);
            setPhase('sent');
        } catch (error) {
            setErr(
                isApiError(error) ? error.message : strings.requestFailed,
            );
        } finally {
            setLoading(false);
        }
    }
    /**
     * Resends the password recovery email.
     * @returns {Promise<void>}
     */
    async function resend(): Promise<void> {
        if (cooldown > 0) return;
        setErr(null);
        setLoading(true);
        try {
            await requestPasswordRecovery({
                email,
                locale,
                reset_password_url: resetPasswordUrlPrefix,
            });
            setResent(true);
            setCooldown(PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS);
        } catch (error) {
            setErr(
                isApiError(error) ? error.message : strings.requestFailed,
            );
        } finally {
            setLoading(false);
        }
    }
    /**
     * Copies the email to the clipboard.
     * @returns {Promise<void>}
     */
    async function handleCopy(): Promise<void> {
        const ok = await copyToClipboard(email);
        if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        }
    }

    if (phase === 'sent') {
        return (
            <SentState
                strings={strings}
                email={email}
                cooldown={cooldown}
                resent={resent}
                copied={copied}
                loading={loading}
                err={err}
                onCopy={handleCopy}
                onResend={resend}
                onEdit={() => {
                    setPhase('request');
                    setErr(null);
                }}
            />
        );
    }

    return (
        <RequestState
            strings={strings}
            email={email}
            err={err}
            loading={loading}
            origin={origin}
            locale={locale}
            onChange={setEmail}
            onSubmit={submit}
        />
    );
}
