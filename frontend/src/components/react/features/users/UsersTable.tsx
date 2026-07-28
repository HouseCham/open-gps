import type { JSX, MouseEvent } from 'react';
//-- Types
import type { User } from '@/types/api';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Utils
import { formatDate } from '@/lib';
import { getInitials } from '@/lib/user-utils';
//-- Components
import {
    EmailStatusPill,
    PasswordPill,
    RolePill,
} from '@/components/react/features/users';
import { IconButton } from '@/components/react/ui/button';

/**
 * Props for the UsersTable component.
 * @interface UsersTableProps
 * @prop {Translation['user']['table']} t - Translation strings for the table.
 * @prop {User[]} users - Filtered users to render.
 * @prop {Language} locale - Active locale for date formatting.
 * @prop {Translation['admin']['roles']} roleLabels - Localized role labels.
 * @prop {(u: User) => void} onOpen - Open the detail modal for the user.
 * @prop {(u: User) => void} onDelete - Open the delete confirmation.
 */
interface UsersTableProps {
    t: Translation['user']['table'];
    users: User[];
    locale: Language;
    roleLabels: Translation['admin']['roles'];
    onOpen: (u: User) => void;
    onDelete: (u: User) => void;
}

/**
 * UsersTable — list of users with role / email-verification / password
 * status pills and a single destructive action per row.
 * @param {UsersTableProps} props
 * @returns {JSX.Element}
 */
export function UsersTable({
    t,
    users,
    locale,
    roleLabels,
    onOpen,
    onDelete,
}: UsersTableProps): JSX.Element {
    /**
     * Resolve the click target to a user and dispatch the right action.
     * @param {MouseEvent<HTMLButtonElement>} e - The click event.
     * @returns {void}
     */
    const handleAction = (e: MouseEvent<HTMLButtonElement>): void => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        if (!id) return;
        const row = users.find(u => u.id === id);
        if (!row) return;
        if (action === 'delete') onDelete(row);
    };

    /**
     * Open the detail modal when the row's name button is clicked.
     * @param {MouseEvent<HTMLButtonElement>} e - The click event.
     * @returns {void}
     */
    const handleOpen = (e: MouseEvent<HTMLButtonElement>): void => {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        const row = users.find(u => u.id === id);
        if (!row) return;
        onOpen(row);
    };

    return (
        <div className="users-table-wrap">
            <table className="users-table">
                <thead>
                    <tr>
                        <th>{t.user}</th>
                        <th>{t.role}</th>
                        <th>{t.email}</th>
                        <th>{t.password}</th>
                        <th>{t.created}</th>
                        <th className="is-right" aria-label={t.actions}>
                            {t.actions}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id}>
                            <td>
                                <div className="users-cell-user">
                                    <div className="users-cell-avatar">
                                        {getInitials(`${u.name} ${u.lastname}`)}
                                    </div>
                                    <div className="users-cell-name-block">
                                        <button
                                            type="button"
                                            className="users-cell-name"
                                            data-id={u.id}
                                            onClick={handleOpen}
                                        >
                                            {u.name} {u.lastname}
                                        </button>
                                        <div className="users-cell-mail">
                                            {u.email}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <RolePill role={u.role} labels={roleLabels} />
                            </td>
                            <td>
                                <EmailStatusPill
                                    verified={u.email_verified}
                                    verifiedLabel={t.verified}
                                    unverifiedLabel={t.unverified}
                                />
                            </td>
                            <td>
                                <PasswordPill
                                    mustChange={u.must_change_password}
                                    okLabel={t.passwordOk}
                                    changeLabel={t.changeRequired}
                                />
                            </td>
                            <td>
                                <span className="users-cell-time">
                                    {formatDate(locale, u.created_at)}
                                </span>
                            </td>
                            {/* Actions */}
                            <td className="is-right">
                                <div className="users-cell-actions">
                                    {/* Delete Button */}
                                    <IconButton
                                        danger
                                        dataID={u.id}
                                        ariaLabel={t.actions}
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
