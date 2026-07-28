import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { User } from '@/types/api';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Components
import { RolePill } from '@/components/react/features/users';
//-- Local
import { DeleteModal } from './index';
//-- Utils
import { getInitials } from '@/lib/user-utils';
import { DELETE_USER_CONFIRM_PHRASE } from '@/constants';

/**
 * Props for the DeleteUserModal component.
 * @interface DeleteUserModalProps
 * @prop {User | null} user - The user to delete, or null when the modal is closed.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onConfirm - Callback invoked when the destructive button is clicked.
 * @prop {boolean} loading - Disables the destructive button while the request is in flight.
 * @prop {Translation['user']['delete']} t - Translation strings.
 * @prop {Translation['admin']['roles']} roleLabels - Localized role labels.
 * @prop {Language} locale - Active locale (selects the confirm phrase).
 */
interface DeleteUserModalProps {
    user: User | null;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    loading: boolean;
    t: Translation['user']['delete'];
    roleLabels: Translation['admin']['roles'];
    locale: Language;
}

/**
 * DeleteUserModal — type-to-confirm wrapper around `DeleteModal` where
 * the value to type is the literal phrase "confirm".
 * @param {DeleteUserModalProps} props
 * @returns {JSX.Element | null}
 */
export function DeleteUserModal({
    user,
    onClose,
    onConfirm,
    loading,
    t,
    roleLabels,
    locale,
}: DeleteUserModalProps): JSX.Element | null {
    if (!user) return null;

    const phrase = DELETE_USER_CONFIRM_PHRASE[locale];

    return (
        <DeleteModal
            open={user !== null}
            onClose={onClose}
            onConfirm={onConfirm}
            loading={loading}
            title={t.title}
            warningTitle={t.warningTitle}
            warningMessage={t.warningMessage}
            targetIcon={
                <div className="users-cell-avatar">
                    {getInitials(`${user.name} ${user.lastname}`)}
                </div>
            }
            targetName={`${user.name} ${user.lastname}`}
            targetMeta={
                <>
                    {user.email} ·{' '}
                    <RolePill role={user.role} labels={roleLabels} />
                </>
            }
            confirmLabel={t.confirmLabel}
            confirmPlaceholder={t.confirmPlaceholder}
            confirmValue={phrase}
            confirmError={t.mismatch}
            tip={t.prompt}
            cancelLabel={t.cancel}
            confirmButtonLabel={t.confirm}
        />
    );
}
