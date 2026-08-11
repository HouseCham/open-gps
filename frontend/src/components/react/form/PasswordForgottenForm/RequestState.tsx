//-- Types
import { lazy, type ChangeEvent, type FormEvent, type JSX } from 'react';
import type { Language } from '@/types';
import type { PasswordForgottenFormStrings } from '@/types/components';
//-- Components
import { Alert } from '@/components/react/ui';
import { Field, Input } from '@/components/react/form/ui';
import { Button } from '@/components/react/ui/button';
//-- Icons
import { AlertCircle, ArrowLeft, Send } from 'lucide-react';
//-- Utils
//-- Constants
import { LOGIN_PATH } from '@/constants/auth';
import { APP_ORIGIN, REPO_ENVIRONMENT } from '@/constants';
//-- Lazy components
const ApiInspector = lazy(() =>
    import('@/components/react/form/shared/ApiInspector').then(module => ({
        default: module.ApiInspector,
    }))
);

/**
 * Props for the internal request-state view.
 * @interface RequestStateProps
 * @prop {PasswordForgottenFormStrings} strings - The form strings.
 * @prop {string} email - The email address.
 * @prop {string | null} err - An error message, if any.
 * @prop {boolean} loading - Whether the request is in flight.
 * @prop {Language} locale - The current locale.
 * @prop {(value: string) => void} onChange - Callback for the email input.
 * @prop {(e: FormEvent<HTMLFormElement>) => Promise<void>} onSubmit - Callback for the form submit event.
 */
interface RequestStateProps {
    strings: PasswordForgottenFormStrings;
    email: string;
    err: string | null;
    loading: boolean;
    locale: Language;
    onChange: (value: string) => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * State A: the "enter your email" form, with the dev API inspector under it.
 * @param {RequestStateProps} props
 * @returns {JSX.Element}
 */
export function RequestState({
    strings,
    email,
    err,
    loading,
    locale,
    onChange,
    onSubmit,
}: RequestStateProps): JSX.Element {
    return (
        <>
            {/* Heading */}
            <div className="heading">
                <h1>{strings.title}</h1>
                <div className="sub">{strings.subtitle}</div>
            </div>
            {/* Error message */}
            {err && (
                <Alert
                    tone="danger"
                    title={err}
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
            )}
            {/* Reset password form */}
            <form onSubmit={onSubmit} noValidate>
                <Field
                    label={strings.emailLabel}
                    htmlFor="forgot-email"
                    required
                    help={strings.emailHelp}
                    error={err ?? undefined}
                >
                    <Input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        placeholder={strings.emailPlaceholder}
                        value={email}
                        invalid={!!err}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onChange(e.target.value)
                        }
                        aria-label={strings.emailLabel}
                    />
                </Field>

                <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    icon={
                        loading ? undefined : (
                            <Send size={14} strokeWidth={1.6} />
                        )
                    }
                    className="btn-block"
                >
                    {loading ? strings.submitting : strings.submit}
                </Button>

                {/* Back to login link */}
                <div className="alt">
                    <a
                        href={`/${locale}${LOGIN_PATH}`}
                        className="linkish mono"
                    >
                        <ArrowLeft size={12} aria-hidden="true" />{' '}
                        {strings.backToLogin}
                    </a>
                </div>
            </form>
            {/* Dev API inspector */}
            {REPO_ENVIRONMENT === 'development' && (
                <ApiInspector
                    method="POST"
                    path="/api/v1/auth/generate-pwd-recovery-token"
                    body={{
                        email: email || strings.apiInspectorBody.email,
                        locale,
                        reset_password_url: `${APP_ORIGIN}${strings.apiInspectorBody.redirectPath}`,
                    }}
                    title={strings.badge}
                    cookieNote={strings.rateLimitNote}
                />
            )}
        </>
    );
}
