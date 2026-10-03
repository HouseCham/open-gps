import '@/styles/device-share.css';
//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { Translation } from '@/i18n';
//-- Components
import { Button } from '@/components/react/ui/button';
import { Modal } from '@/components/react/ui/Modal';
//-- Icons
import { Link2, Users } from 'lucide-react';

/**
 * Props for the ShareChoiceModal component
 * @interface ShareChoiceModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => void} onRegisteredUser - Callback for sharing with a registered user.
 * @prop {() => void} onGuest - Callback for sharing with a guest.
 * @prop {Translation['device']['detail']['sharing']} t - Translation strings.
 */
interface ShareChoiceModalProps {
    open: boolean;
    onClose: () => void;
    onRegisteredUser: () => void;
    onGuest: () => void;
    t: Translation['device']['detail']['sharing'];
}
/**
 * The ShareChoiceModal component
 * @param {ShareChoiceModalProps} props - Props for the component.
 * @returns {JSX.Element | null} The rendered component.
 */
export function ShareChoiceModal({
    open,
    onClose,
    onRegisteredUser,
    onGuest,
    t,
}: ShareChoiceModalProps): JSX.Element | null {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t.chooseTitle}
            subtitle={t.chooseDescription}
            size="md"
            footer={
                <Button type="button" variant="secondary" onClick={onClose}>
                    {t.cancel}
                </Button>
            }
        >
            <div className="device-share-options">
                <button
                    type="button"
                    className="device-share-option"
                    onClick={onRegisteredUser}
                >
                    <Users size={18} aria-hidden="true" />
                    <span>
                        <strong>{t.registeredTitle}</strong>
                        <span>{t.registeredDescription}</span>
                    </span>
                </button>
                <button
                    type="button"
                    className="device-share-option"
                    onClick={onGuest}
                >
                    <Link2 size={18} aria-hidden="true" />
                    <span>
                        <strong>{t.guestTitle}</strong>
                        <span>{t.guestDescription}</span>
                    </span>
                </button>
            </div>
        </Modal>
    );
}
