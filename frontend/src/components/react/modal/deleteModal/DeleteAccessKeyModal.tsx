import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { ApiKeyRow } from '@/lib/api/services/apiKeyService';
import type { Translation } from '@/i18n';
//-- Icons
import { KeyRound } from 'lucide-react';
//-- Local
//-- Utils
import { interpolateTemplate } from '@/lib';
import { DeleteModal } from './index';

/**
 * Props for the DeleteAccessKeyModal component.
 * @interface DeleteAccessKeyModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {ApiKeyRow | null} row - The key row to revoke, or null when closed.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onConfirm - Callback invoked when
 *   the destructive button is clicked.
 * @prop {boolean} loading - Disable the destructive button while the
 *   revocation is in flight.
 * @prop {Translation['apiKeys']['modals']} t - Translation strings.
 */
interface DeleteAccessKeyModalProps {
    open: boolean;
    row: ApiKeyRow | null;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    loading: boolean;
    t: Translation['apiKeys']['modals'];
}

/**
 * DeleteAccessKeyModal — type-to-confirm wrapper around `DeleteModal`
 * where the value to type is the device name (the only human-readable
 * label the row carries besides the truncated key id).
 * @param {DeleteAccessKeyModalProps} props
 * @returns {JSX.Element | null}
 */
export function DeleteAccessKeyModal({
    open,
    row,
    onClose,
    onConfirm,
    loading,
    t,
}: DeleteAccessKeyModalProps): JSX.Element | null {
    if (!row) return null;

    const deviceName = row.device_name;

    return (
        <DeleteModal
            open={open}
            onClose={onClose}
            onConfirm={onConfirm}
            loading={loading}
            title={t.revokeTitle}
            subtitle={interpolateTemplate(t.revokeSubtitle, {
                device: deviceName,
            })}
            warningTitle={t.revokeWarningTitle}
            warningMessage={t.revokeWarningMessage}
            targetIcon={
                <KeyRound size={18} strokeWidth={1.6} aria-hidden="true" />
            }
            targetName={deviceName}
            targetMeta={<code>{row.id}</code>}
            confirmLabel={interpolateTemplate(t.revokeTypeToConfirm, {
                name: deviceName,
            })}
            confirmPlaceholder={deviceName}
            confirmValue={deviceName}
            confirmError={t.revokeMismatch}
            tip={t.revokeTip}
            cancelLabel={t.cancel}
            confirmButtonLabel={loading ? t.revoking : t.revoke}
        />
    );
}
