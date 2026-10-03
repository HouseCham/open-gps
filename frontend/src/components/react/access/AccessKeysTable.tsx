import type { JSX, MouseEvent } from 'react';
//-- Types
import type { ApiKeyRow } from '@/lib/api/services/apiKeyService';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Utils
import { formatRelativeTime } from '@/lib';
import { truncateId } from '@/lib/api-keys-utils';
//-- Icons
import { KeyRound } from 'lucide-react';
//-- Components
import { IconButton } from '@/components/react/ui/button';

/**
 * Props for the AccessKeysTable component.
 * @interface AccessKeysTableProps
 * @prop {Translation['apiKeys']['table']} t - Localized column labels.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {ApiKeyRow[]} rows - Filtered API key rows to render.
 * @prop {Language} locale - Active locale for relative-time formatting.
 * @prop {(row: ApiKeyRow) => void} onDelete - Open the revoke confirmation.
 */
interface AccessKeysTableProps {
    t: Translation['apiKeys']['table'];
    date: Translation['date'];
    rows: ApiKeyRow[];
    locale: Language;
    onDelete: (row: ApiKeyRow) => void;
}

/**
 * AccessKeysTable — list of active API keys with device, truncated id,
 * created/last-used/expires relative timestamps, and a single
 * destructive action per row.
 * @param {AccessKeysTableProps} props
 * @returns {JSX.Element}
 */
export function AccessKeysTable({
    t,
    date,
    rows,
    locale,
    onDelete,
}: AccessKeysTableProps): JSX.Element {
    /**
     * Resolve the click target to a row and dispatch the revoke action.
     * @param {MouseEvent<HTMLButtonElement>} e - The click event.
     * @returns {void}
     */
    const handleAction = (e: MouseEvent<HTMLButtonElement>): void => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        if (!id || action !== 'delete') return;
        const row = rows.find(r => r.id === id);
        if (!row) return;
        onDelete(row);
    };

    return (
        <div className="access-table-wrap">
            <table className="access-table">
                <thead>
                    <tr>
                        <th>{t.device}</th>
                        <th>{t.keyId}</th>
                        <th>{t.created}</th>
                        <th>{t.lastUsed}</th>
                        <th>{t.expires}</th>
                        <th className="is-right" aria-label={t.actions}>
                            {t.actions}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.id}>
                            {/* Device */}
                            <td>
                                <div className="access-cell-device">
                                    <span className="access-cell-icon">
                                        <KeyRound
                                            size={15}
                                            strokeWidth={1.6}
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div className="access-cell-device-text">
                                        <div className="access-cell-name">
                                            {row.device_name}
                                        </div>
                                        <div className="access-cell-id">
                                            {row.device_id}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            {/* Key ID (truncated) */}
                            <td>
                                <span className="access-key-id">
                                    <code>{truncateId(row.id)}</code>
                                </span>
                            </td>
                            {/* Created */}
                            <td
                                className={`access-cell-time${row.created_at ? '' : ' never'}`}
                            >
                                {formatRelativeTime(
                                    row.created_at,
                                    locale,
                                    date
                                )}
                            </td>
                            {/* Last used — ApiKeyRow omits this; backend
                                endpoint will add it later. */}
                            <td className="access-cell-time never">
                                {t.notAvailable}
                            </td>
                            {/* Expires — same */}
                            <td className="access-cell-time never">
                                {t.notAvailable}
                            </td>
                            {/* Actions */}
                            <td className="is-right">
                                <div className="access-row-actions">
                                    <IconButton
                                        dataID={row.id}
                                        danger
                                        ariaLabel={`${t.actions} ${row.device_name}`}
                                        title={t.actions}
                                        handleAction={handleAction}
                                    />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
