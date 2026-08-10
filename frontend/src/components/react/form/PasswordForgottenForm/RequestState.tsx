//-- Types
import { lazy, type ChangeEvent, type FormEvent, type JSX } from "react";
import type { Language } from "@/types";
import type { PasswordForgottenFormStrings } from "@/types/components";
//-- Components
import { Alert } from "@/components/react/ui";
import { Field, Input } from "@/components/react/form/ui";
import { Button } from "@/components/react/ui/button";
//-- Icons
import { AlertCircle, ArrowLeft, Send } from "lucide-react";
//-- Utils
import { redirectTo } from "@/lib";
//-- Constants
import { LOGIN_PATH } from "@/constants/auth";
import { REPO_ENVIRONMENT } from "@/constants";
//-- Lazy components
const ApiInspector = lazy(() => import("@/components/react/form/shared/ApiInspector").then(module => ({ default: module.ApiInspector })));

/**
 * Props for the internal request-state view.
 * @interface RequestStateProps
 */
interface RequestStateProps {
    strings: PasswordForgottenFormStrings;
    email: string;
    err: string | null;
    loading: boolean;
    origin: string;
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
    origin,
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

                <div className="alt">
                    <a
                        className="linkish"
                        onClick={() => redirectTo(LOGIN_PATH)}
                    >
                        <ArrowLeft
                            size={12}
                            aria-hidden="true"
                        />
                        {' '}
                        {strings.backToLogin}
                    </a>
                </div>
            </form>
            {/* Dev API inspector */}
            {
                REPO_ENVIRONMENT === 'development' && (
                    <ApiInspector
                        method="POST"
                        path="/api/v1/auth/generate-pwd-recovery-token"
                        body={{
                            email: email || strings.apiInspectorBody.email,
                            locale,
                            reset_password_url: `${origin}${strings.apiInspectorBody.redirectPath}`,
                        }}
                        title={strings.badge}
                        cookieNote={strings.rateLimitNote}
                    />
                )
            }
        </>
    );
}