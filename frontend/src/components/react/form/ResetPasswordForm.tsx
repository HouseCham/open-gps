import '@/styles/components/form/signup-form.css';
import '@/styles/components/form/password-strength.css';

import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import type { Language } from '@/types';
import type { ResetPasswordFormStrings } from '@/types/components';
import { isApiError } from '@/lib/api/api-utils';
import { useAuthService } from '@/lib/api/services';
import { Alert } from '@/components/react/ui/Alert';
import { Button } from '@/components/react/ui/button';
import { Field } from '@/components/react/form/ui';
import {
    PasswordField,
    PasswordStrength,
    strengthScore,
} from '@/components/react/form/shared';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';

/**
 * Props for the ResetPasswordForm component.
 * @interface ResetPasswordFormProps
 * @prop {ResetPasswordFormStrings} strings - i18n strings.
 * @prop {Language} locale - Locale code forwarded to the recovery API.
 */
export interface ResetPasswordFormProps {
    strings: ResetPasswordFormStrings;
    locale: Language;
}
/**
 * ResetPasswordForm component.
 * @param {ResetPasswordFormProps} props - The props for the component.
 * @returns {JSX.Element} The rendered ResetPasswordForm component.
 */
export function ResetPasswordForm({
    strings,
    locale,
}: ResetPasswordFormProps): JSX.Element {
    const { consumePasswordRecovery } = useAuthService();
    const [token, setToken] = useState('');
    const [tokenReady, setTokenReady] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<
        | 'missing'
        | 'invalid'
        | 'generic'
        | 'required'
        | 'mismatch'
        | 'weak'
        | null
    >(null);
    const [success, setSuccess] = useState(false);

    const mismatch = !!confirm && password !== confirm;

    useEffect(() => {
        setToken(
            new URLSearchParams(window.location.search).get('token') ?? ''
        );
        setTokenReady(true);
    }, []);

    useEffect(() => {
        if (!success) return;
        const timeout = window.setTimeout(() => {
            window.location.assign(`/${locale}/login`);
        }, 3000);
        return (): void => window.clearTimeout(timeout);
    }, [locale, success]);
    /**
     * Handles form submission.
     * @param {FormEvent<HTMLFormElement>} event - The form submission event.
     * @returns {Promise<void>} A promise that resolves when the submission is complete.
     */
    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        if (!token) {
            setError('missing');
            return;
        }
        if (!password || !confirm) {
            setError('required');
            return;
        }
        if (mismatch) {
            setError('mismatch');
            return;
        }
        if (strengthScore(password) < 2) {
            setError('weak');
            return;
        }
        setLoading(true);
        try {
            await consumePasswordRecovery({ token, new_password: password });
            setSuccess(true);
        } catch (caught) {
            setError(
                isApiError(caught) && caught.status !== 400
                    ? 'generic'
                    : 'invalid'
            );
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <Alert
                tone="success"
                title={strings.successTitle}
                message={strings.successMessage}
                icon={<Check size={14} aria-hidden="true" />}
            />
        );
    }

    if (tokenReady && !token) {
        return (
            <>
                <Alert
                    tone="danger"
                    title={strings.missingTokenTitle}
                    message={strings.missingTokenMessage}
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
                <a className="alt" href={`/${locale}/forgot-password`}>
                    {strings.backToLogin}
                </a>
            </>
        );
    }

    return (
        <>
            <div className="heading">
                <h1>{strings.title}</h1>
                <div className="sub">{strings.subtitle}</div>
            </div>
            {error && (
                <Alert
                    tone="danger"
                    title={
                        error === 'invalid'
                            ? strings.invalidTokenTitle
                            : error === 'missing'
                              ? strings.missingTokenTitle
                              : error === 'mismatch'
                                ? strings.passwordsDoNotMatch
                                : error === 'weak'
                                  ? strings.pickStrongerPassword
                                  : error === 'required'
                                    ? strings.passwordRequired
                                    : strings.resetFailed
                    }
                    message={
                        error === 'invalid'
                            ? strings.invalidTokenMessage
                            : error === 'missing'
                              ? strings.missingTokenMessage
                              : undefined
                    }
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
            )}
            <form onSubmit={submit} noValidate>
                <Field
                    label={strings.newPassword}
                    htmlFor="rp-password"
                    required
                    help={!password ? strings.passwordHelp : undefined}
                >
                    <PasswordField
                        id="rp-password"
                        autoComplete="new-password"
                        placeholder={strings.newPasswordPlaceholder}
                        value={password}
                        onChange={setPassword}
                        required
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                    <PasswordStrength
                        value={password}
                        strengthLabel={strings.strengthLabel}
                        labels={[
                            strings.strengthTooShort,
                            strings.strengthWeak,
                            strings.strengthFair,
                            strings.strengthGood,
                            strings.strengthStrong,
                        ]}
                    />
                </Field>
                <Field
                    label={strings.confirmPassword}
                    htmlFor="rp-confirm"
                    required
                    error={mismatch ? strings.passwordsDoNotMatch : undefined}
                >
                    <PasswordField
                        id="rp-confirm"
                        autoComplete="new-password"
                        placeholder={strings.confirmPasswordPlaceholder}
                        value={confirm}
                        onChange={setConfirm}
                        invalid={mismatch}
                        required
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                </Field>
                <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    iconRight={
                        loading ? undefined : (
                            <ArrowRight size={14} strokeWidth={1.6} />
                        )
                    }
                    className="btn-block"
                >
                    {loading ? strings.submitting : strings.submit}
                </Button>
            </form>
        </>
    );
}
