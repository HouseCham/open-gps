import { useState } from 'react';
import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { CreatedUser } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Utils
import { copyToClipboard } from '@/lib';
import { interpolateTemplate } from '@/lib';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
//-- Icons
import { AlertTriangle, Check, Copy } from 'lucide-react';

/**
 * Props for the TempPasswordModal component.
 * @interface TempPasswordModalProps
 * @prop {CreatedUser | null} user - The just-created user, or null when the modal is closed.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {Translation['user']['tempPassword']} t - Translation strings.
 */
interface TempPasswordModalProps {
    user: CreatedUser | null;
    onClose: () => void;
    t: Translation['user']['tempPassword'];
}

/**
 * TempPasswordModal — confirmation dialog shown right after a user is
 * created. It surfaces the one-time temporary password for the admin
 * to deliver to the new user through a secure channel.
 * @param {TempPasswordModalProps} props
 * @returns {JSX.Element | null}
 */
export function TempPasswordModal({
    user,
    onClose,
    t,
}: TempPasswordModalProps): JSX.Element | null {
    const [copied, setCopied] = useState(false);

    if (!user) return null;

    const tempPassword = user.temporary_password;

    /**
     * Copy the temporary password to the clipboard.
     * @returns {Promise<void>}
     */
    const copy = async (): Promise<void> => {
        if (!tempPassword) return;
        if (await copyToClipboard(tempPassword)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <Modal
            open={user !== null}
            onClose={onClose}
            title={t.title}
            size="md"
            footer={
                <Button type="button" variant="primary" onClick={onClose}>
                    {t.saved}
                </Button>
            }
        >
            <div className="temp-pwd-banner">
                <AlertTriangle size={14} strokeWidth={1.8} />
                <div>
                    {interpolateTemplate(t.banner, {
                        name: `${user.name} ${user.lastname}`.trim(),
                    })}
                </div>
            </div>
            <div className="temp-pwd-display">
                <code className="temp-pwd-value">{tempPassword}</code>
                <div className="temp-pwd-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        icon={
                            copied ? (
                                <Check size={14} strokeWidth={1.6} />
                            ) : (
                                <Copy size={14} strokeWidth={1.6} />
                            )
                        }
                        onClick={() => void copy()}
                    >
                        {copied ? t.copied : t.copy}
                    </Button>
                </div>
            </div>
            <p className="temp-pwd-meta">{t.meta}</p>
        </Modal>
    );
}
