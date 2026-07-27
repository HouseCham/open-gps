import '@/styles/components/form/signup-form.css';

import { useState } from 'react';
//-- Types
import type { ChangePasswordStrings } from '@/types/components';
import type { FormEvent, JSX } from 'react';
//-- Utils
import { isApiError } from '@/lib/api/api-utils';
//-- Services
import { useAuthService } from '@/lib/api/services';
//-- Components
import { Alert } from '@/components/react/ui/Alert';
import { Button } from '@/components/react/ui/button';
import { Field } from '@/components/react/form/ui';
import {
    PasswordField,
    PasswordStrength,
    strengthScore,
} from '@/components/react/form/shared';
//-- Icons
import { AlertCircle, Check } from 'lucide-react';

/**
 * Props for the ChangePasswordForm component.
 * @interface ChangePasswordFormProps
 * @prop {ChangePasswordStrings} strings - i18n strings.
 * @prop {() => void} onSuccess - Called once the password change resolves successfully.
 */
export interface ChangePasswordFormProps {
    strings: ChangePasswordStrings;
    onSuccess: () => void;
}

/**
 * ChangePasswordForm — current / new / confirm password with strength meter.
 * Submits through `authService.changePassword` and surfaces the backend
 * error inline. Submit button lives inside the form (the modal does not
 * render its own footer).
 * @param {ChangePasswordFormProps} props
 * @returns {JSX.Element}
 */
export function ChangePasswordForm({
    strings,
    onSuccess,
}: ChangePasswordFormProps): JSX.Element {
    const { changePassword } = useAuthService();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const mismatch = !!confirm && next !== confirm;

    /**
     * Handles form submission.
     * @param {React.FormEvent<HTMLFormElement>} e
     */
    async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setErr(null);
        if (!current || !next || !confirm) {
            setErr(strings.passwordRequired);
            return;
        }
        if (mismatch) {
            setErr(strings.passwordsDoNotMatch);
            return;
        }
        if (strengthScore(next) < 2) {
            setErr(strings.pickStrongerPassword);
            return;
        }
        setLoading(true);
        try {
            await changePassword({ old_password: current, new_password: next });
            onSuccess();
        } catch (error) {
            const message = isApiError(error)
                ? error.message
                : strings.errorGeneric;
            setErr(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Alert tone="info" title={strings.description} />

            {err && (
                <Alert
                    tone="danger"
                    title={err}
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
            )}

            <form onSubmit={submit} noValidate>
                <Field
                    label={strings.currentPassword}
                    htmlFor="cp-current"
                    required
                >
                    <PasswordField
                        id="cp-current"
                        autoComplete="current-password"
                        placeholder={strings.currentPlaceholder}
                        value={current}
                        onChange={setCurrent}
                        invalid={!!err && !current}
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                </Field>

                <div className="form-spacer" />

                <Field
                    label={strings.newPassword}
                    htmlFor="cp-next"
                    required
                    help={!next ? strings.passwordHelp : undefined}
                >
                    <PasswordField
                        id="cp-next"
                        autoComplete="new-password"
                        placeholder={strings.newPlaceholder}
                        value={next}
                        onChange={setNext}
                        invalid={!!err && (!next || next !== confirm)}
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                    <PasswordStrength
                        value={next}
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

                <div className="form-spacer" />

                <Field
                    label={strings.confirmPassword}
                    htmlFor="cp-confirm"
                    required
                    error={mismatch ? strings.passwordsDoNotMatch : undefined}
                >
                    <PasswordField
                        id="cp-confirm"
                        autoComplete="new-password"
                        placeholder={strings.confirmPlaceholder}
                        value={confirm}
                        onChange={setConfirm}
                        invalid={mismatch}
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                </Field>

                <div className="form-spacer" />

                <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    iconRight={
                        loading ? undefined : (
                            <Check size={14} strokeWidth={1.6} />
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