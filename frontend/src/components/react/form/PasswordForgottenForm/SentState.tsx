//-- Components
import { Alert } from '@/components/react/ui/Alert';
import { REPO_ENVIRONMENT } from '@/constants';
import { maskEmail } from '@/lib';
import type { PasswordForgottenFormStrings } from '@/types/components';
//-- Icons
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Clock,
    Copy,
    Inbox,
    Send,
} from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the internal sent-state view.
 * @interface SentStateProps
 * @prop {PasswordForgottenFormStrings} strings - The form strings.
 * @prop {string} email - The email address.
 * @prop {number} cooldown - The resend cooldown in seconds.
 * @prop {boolean} resent - Whether the email has been resent.
 * @prop {boolean} copied - Whether the email has been copied to the clipboard.
 * @prop {boolean} loading - Whether the resend request is in flight.
 * @prop {string | null} err - An error message, if any.
 * @prop {() => void} onCopy - Callback for the copy button.
 * @prop {() => void} onResend - Callback for the resend button.
 * @prop {() => void} onEdit - Callback for the edit button.
 */
interface SentStateProps {
    strings: PasswordForgottenFormStrings;
    email: string;
    cooldown: number;
    resent: boolean;
    copied: boolean;
    loading: boolean;
    err: string | null;
    onCopy: () => void;
    onResend: () => void;
    onEdit: () => void;
}

/**
 * State B: the "check your inbox" card with copy / resend / mail shortcuts.
 * @param {SentStateProps} props
 * @returns {JSX.Element}
 */
export function SentState({
    strings,
    email,
    cooldown,
    resent,
    copied,
    loading,
    err,
    onCopy,
    onResend,
    onEdit,
}: SentStateProps): JSX.Element {
    const masked = maskEmail(email);
    const minutes = Math.floor(cooldown / 60);
    const seconds = cooldown % 60;
    const cooldownLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <>
            <div className="heading">
                <h1>{strings.sentTitle}</h1>
                <div className="sub">{strings.sentSubtitle}</div>
            </div>

            {err && (
                <Alert
                    tone="danger"
                    title={err}
                    icon={<AlertCircle size={14} aria-hidden="true" />}
                />
            )}

            <div className="sent-card" role="status">
                <div className="glyph">
                    <Send size={18} strokeWidth={1.6} aria-hidden="true" />
                </div>
                <div className="body">
                    <div className="title">{strings.sentTitlePrefix}</div>
                    <div className="msg">
                        <span className="email">{masked}</span>
                        <button
                            className="linkish"
                            type="button"
                            onClick={onCopy}
                            aria-label={strings.copyEmail}
                        >
                            {copied ? (
                                <Check
                                    size={14}
                                    strokeWidth={1.6}
                                    aria-hidden="true"
                                />
                            ) : (
                                <Copy
                                    size={14}
                                    strokeWidth={1.6}
                                    aria-hidden="true"
                                />
                            )}
                            {copied ? strings.copiedEmail : strings.copyEmail}
                        </button>
                    </div>
                    {/* Expiration timer */}
                    <div className="row">
                        <span>
                            <Clock
                                size={14}
                                strokeWidth={1.6}
                                aria-hidden="true"
                            />{' '}
                            {strings.expiresIn}{' '}
                            <span className="mono-num">15:00</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{strings.singleUseToken}</span>
                    </div>
                </div>
            </div>

            <div className="resend" aria-live="polite">
                <span>{strings.resendPrompt}</span>
                <button
                    className="action"
                    type="button"
                    onClick={onResend}
                    disabled={cooldown > 0 || loading}
                >
                    {cooldown > 0 ? (
                        <>
                            {strings.resendCooldown}{' '}
                            <span className="timer mono-num">
                                <strong>{cooldownLabel}</strong>
                            </span>
                        </>
                    ) : resent ? (
                        strings.resendResent
                    ) : (
                        strings.resendCta
                    )}
                </button>
            </div>

            <div className="mail-helper">
                <Inbox size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>{strings.mailHelper}</span>
                <div className="apps">
                    <button
                        type="button"
                        onClick={() =>
                            window.location.assign('mailto:')
                        }
                    >
                        {strings.mailApple}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            window.open(
                                'https://mail.google.com',
                                '_blank',
                                'noopener',
                            )
                        }
                    >
                        {strings.mailGmail}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            window.open(
                                'https://outlook.live.com/mail',
                                '_blank',
                                'noopener',
                            )
                        }
                    >
                        {strings.mailOutlook}
                    </button>
                </div>
            </div>

            {
                REPO_ENVIRONMENT === 'development' && (
                    <div
                        className="identity-list"
                        aria-label={strings.identitySubject}
                    >
                        <div className="row">
                            <span className="k">{strings.identityFrom}</span>
                            <span className="v">
                                {strings.identityFromValue}{' '}
                                <span className="pill">
                                    {strings.identityFromBadge}
                                </span>
                            </span>
                        </div>
                        <div className="row">
                            <span className="k">{strings.identitySubject}</span>
                            <span className="v">
                                {strings.identitySubjectValue}
                            </span>
                        </div>
                        <div className="row">
                            <span className="k">{strings.identityReplyTo}</span>
                            <span className="v mono">
                                {strings.identityReplyToValue}
                            </span>
                        </div>
                    </div>
                )
            }

            <div className="alt">
                <a
                    href="#"
                    onClick={e => {
                        e.preventDefault();
                        onEdit();
                    }}
                >
                    <ArrowLeft size={12} strokeWidth={1.6} aria-hidden />{' '}
                    {strings.useDifferentEmail}
                </a>
            </div>
        </>
    );
}