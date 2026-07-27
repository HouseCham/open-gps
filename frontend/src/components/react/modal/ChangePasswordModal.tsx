import type { JSX, ReactNode } from 'react';
//-- Types
import type { ChangePasswordStrings } from '@/types/components';
//-- Components
import { Modal } from '@/components/react/ui';
import { ChangePasswordForm } from '@/components/react/form/ChangePasswordForm';

/**
 * Props for the ChangePasswordModal component.
 * @interface ChangePasswordModalProps
 * @prop {boolean} open - Whether the modal is visible.
 * @prop {ChangePasswordStrings} strings - i18n strings for the modal.
 * @prop {() => void} onSuccess - Called by the form when the password change resolves.
 * @prop {boolean} [locked=false] - When `true`, suppresses backdrop / Escape / close-button dismissal. The modal can only leave via a successful submit.
 * @prop {ReactNode} [headerActions] - Optional action buttons rendered in the modal header (e.g. theme/language toggles).
 */
export interface ChangePasswordModalProps {
    open: boolean;
    strings: ChangePasswordStrings;
    onSuccess: () => void;
    locked?: boolean;
    headerActions?: ReactNode;
}

/**
 * ChangePasswordModal — wrapper around {@link ChangePasswordForm} that
 * pins the user to the flow when `locked` is set. Used by the gate to
 * force a temporary-password change; reusable elsewhere with `locked`
 * `false`.
 * @param {ChangePasswordModalProps} props
 * @returns {JSX.Element | null}
 */
export function ChangePasswordModal({
    open,
    strings,
    onSuccess,
    locked = false,
    headerActions,
}: ChangePasswordModalProps): JSX.Element | null {
    if (!open) return null;
    return (
        <Modal
            open={open}
            onClose={() => undefined}
            title={strings.title}
            subtitle={strings.subtitle}
            size="md"
            dismissible={!locked}
            hideCloseButton={locked}
            headerActions={headerActions}
        >
            <ChangePasswordForm strings={strings} onSuccess={onSuccess} />
        </Modal>
    );
}
