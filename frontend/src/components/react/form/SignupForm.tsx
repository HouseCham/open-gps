import '@/styles/components/form/signup-form.css';

import { useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { AlertCircle, ArrowRight, Info, Mail, User } from 'lucide-react';
//-- API
import { isApiError } from '@/lib/api/api-utils';
//-- Services
import { useAuthService } from '@/lib/api/services';
//-- Components
import { Alert } from '@/components/react/ui/Alert';
import { Badge } from '@/components/react/ui/Badge';
import { Button } from '@/components/react/ui/button';
import { Checkbox, Field, Input } from '@/components/react/form/ui';
import {
    ApiInspector,
    GoogleLogo,
    OrDivider,
    PasswordField,
} from '@/components/react/form/shared';
//-- Types
import type { SignupFormStrings } from '@/types/components';

/**
 * Props for the SignupForm component.
 * @interface SignupFormProps
 * @prop {SignupFormStrings} strings - i18n strings.
 * @prop {boolean} [firstUser] - Renders the "first admin" badge when true.
 */
export interface SignupFormProps {
    strings: SignupFormStrings;
    firstUser?: boolean;
}

function strengthScore(pw: string): number {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^\w]/.test(pw)) s++;
    if (pw.length >= 12) s++;
    return Math.min(s, 4);
}

function PasswordStrength({
    value,
    strengthLabel,
    labels,
}: {
    value: string;
    strengthLabel: string;
    labels: [string, string, string, string, string];
}): JSX.Element {
    const lvl = strengthScore(value);
    return (
        <div className="pw-strength" data-level={lvl} aria-live="polite">
            <div className="bars">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
            </div>
            <div className="legend">
                <span className="mono">{strengthLabel}</span>
                <span className="label" data-active="true">
                    {labels[lvl]}
                </span>
            </div>
        </div>
    );
}

/**
 * SignupForm — name + email + password + confirm with strength meter and terms.
 * @param {SignupFormProps} props
 * @returns {JSX.Element}
 */
export function SignupForm({
    strings,
    firstUser,
}: SignupFormProps): JSX.Element {
    const { isLoading, signUp } = useAuthService();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [terms, setTerms] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const mismatch = !!pw2 && pw !== pw2;

    async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setErr(null);
        if (!email || !pw) {
            setErr(strings.emailPasswordRequired);
            return;
        }
        if (mismatch) {
            setErr(strings.passwordsDoNotMatch);
            return;
        }
        if (!terms) {
            setErr(strings.acceptTerms);
            return;
        }
        if (strengthScore(pw) < 2) {
            setErr(strings.pickStrongerPassword);
            return;
        }
        try {
            await signUp({
                email: email.trim(),
                password: pw,
                name: name.trim(),
            });
        } catch (error) {
            const apiError = isApiError(error)
                ? error
                : { status: 0, message: strings.signupFailed };
            setErr(apiError.message);
        }
    }

    return (
        <>
            <div className="heading">
                {firstUser ? (
                    <Badge tone="accent">{strings.firstAdminWelcome}</Badge>
                ) : (
                    <Badge>{strings.createAccountBadge}</Badge>
                )}
                <h1>{strings.signupTitle}</h1>
                <div className="sub">{strings.signupSubtitle}</div>
            </div>

            {err && (
                <Alert
                    tone="danger"
                    title={err}
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
            )}

            <form onSubmit={submit} noValidate>
                <Field
                    label={strings.name}
                    htmlFor="su-name"
                    help={strings.nameHelp}
                >
                    <div className="input-with-prefix">
                        <Input
                            id="su-name"
                            placeholder={strings.namePlaceholder}
                            autoComplete="name"
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setName(e.target.value)
                            }
                        />
                        <User className="icon-16 prefix" />
                    </div>
                </Field>

                <Field label={strings.email} htmlFor="su-email" required>
                    <div className="input-with-prefix">
                        <Input
                            id="su-email"
                            type="email"
                            placeholder={strings.emailPlaceholder}
                            autoComplete="email"
                            required
                            value={email}
                            invalid={!!err && !email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setEmail(e.target.value)
                            }
                        />
                        <Mail className="icon-16 prefix" />
                    </div>
                </Field>

                <Field
                    label={strings.password}
                    htmlFor="su-pw"
                    required
                    help={pw ? undefined : strings.passwordHelp}
                >
                    <PasswordField
                        id="su-pw"
                        autoComplete="new-password"
                        placeholder={strings.passwordPlaceholder}
                        value={pw}
                        onChange={setPw}
                        required
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                    <PasswordStrength
                        value={pw}
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
                    htmlFor="su-pw2"
                    required
                    error={mismatch ? strings.passwordsDoNotMatch : undefined}
                >
                    <PasswordField
                        id="su-pw2"
                        autoComplete="new-password"
                        placeholder={strings.passwordPlaceholder}
                        value={pw2}
                        onChange={setPw2}
                        invalid={mismatch}
                        showLabel={strings.showPassword}
                        hideLabel={strings.hidePassword}
                    />
                </Field>

                <div className="form-check-row">
                    <Checkbox
                        id="terms"
                        checked={terms}
                        onChange={setTerms}
                        label={
                            <>
                                {strings.termsAgree}{' '}
                                <a href="#" onClick={e => e.preventDefault()}>
                                    {strings.termsLabel}
                                </a>{' '}
                                and{' '}
                                <a href="#" onClick={e => e.preventDefault()}>
                                    {strings.privacyLabel}
                                </a>
                                .
                            </>
                        }
                    />
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    loading={isLoading}
                    disabled={isLoading}
                    iconRight={
                        isLoading ? undefined : (
                            <ArrowRight size={14} strokeWidth={1.6} />
                        )
                    }
                    className="btn-block"
                >
                    {isLoading ? strings.creatingAccount : strings.signup}
                </Button>

                <OrDivider label={strings.orDivider} />

                <button
                    type="button"
                    className="btn btn-google btn-block"
                    onClick={() => {
                        window.location.assign(
                            '/api/auth/oauth2/authorize/google'
                        );
                    }}
                >
                    <GoogleLogo />
                    {strings.continueWithGoogle}
                </button>

                <div className="alt">
                    {strings.haveAccount}{' '}
                    <a href="#" onClick={e => e.preventDefault()}>
                        {strings.loginLink}
                    </a>
                </div>
            </form>

            <ApiInspector
                method="POST"
                path="/api/auth/email-password/sign-up"
                body={{
                    email: email || strings.emailPlaceholder,
                    password: pw ? '••••••••' : '…',
                }}
                title={strings.apiInspectorTitle}
                cookieNote={strings.apiInspectorCookieNote}
                extra={
                    <div className="note">
                        <Info className="icon-14" />
                        {strings.autoSignInNote}
                    </div>
                }
            />
        </>
    );
}
