import type { JSX } from 'react/jsx-runtime';
import { UserRound } from 'lucide-react';
//-- Types
import type { DeviceAccessListItem } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Local
import { DeleteModal } from './index';
//-- Utils
import { interpolateTemplate } from '@/lib';

/**
 * Props for the RevokeAccessModal component.
 * @interface RevokeAccessModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {DeviceAccessListItem | null} user - User to revoke access for.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onConfirm - Callback for confirming the revocation.
 * @prop {boolean} [loading] - Disable the destructive button while the request runs.
 * @prop {Translation['device']['detail']['accessTable']} t - Translation strings.
 */
interface RevokeAccessModalProps {
    open: boolean;
    user: DeviceAccessListItem | null;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
    t: Translation['device']['detail']['accessTable'];
}

/**
 * RevokeAccessModal — type-to-confirm wrapper around `DeleteModal`
 * where the value to type is the literal `confirm` phrase.
 * @param {RevokeAccessModalProps} props
 * @returns {JSX.Element | null}
 */
export function RevokeAccessModal({
    open,
    user,
    onClose,
    onConfirm,
    loading = false,
    t,
}: RevokeAccessModalProps): JSX.Element | null {
    if (!user) return null;

    const warning = interpolateTemplate(t.revokeConfirm.warning, {
        name: user.name,
    });

    return (
        <DeleteModal
            open={open}
            onClose={onClose}
            onConfirm={onConfirm}
            loading={loading}
            title={t.revokeConfirm.title}
            warningTitle={t.revokeConfirm.title}
            warningMessage={warning}
            targetIcon={<UserRound size={18} strokeWidth={1.6} />}
            targetName={user.name}
            targetMeta={user.email}
            confirmLabel={t.revokeConfirm.typeConfirmLabel}
            confirmPlaceholder={t.revokeConfirm.typeConfirmPlaceholder}
            confirmValue={t.revokeConfirm.confirmPhrase}
            confirmError={t.revokeConfirm.mismatch}
            cancelLabel={t.revokeConfirm.cancel}
            confirmButtonLabel={
                loading ? t.revokeConfirm.removing : t.revokeConfirm.confirm
            }
        />
    );
}
