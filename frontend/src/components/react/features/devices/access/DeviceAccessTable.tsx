//-- Types
import type { Translation } from '@/i18n';
import type { DeviceAccessListItem, DeviceDetail } from '@/types/api';
import type { DeviceAccessTableTranslations } from '@/types/components';
import type { Language } from '@/types/i18n';
import type { JSX, MouseEvent } from 'react';
//-- Components
import { Button, IconButton } from '@/components/react/ui/button';
import { Plus, UserRound, Users } from 'lucide-react';
import { RolePill } from '@/components/react/RolePill';
//-- Utils
import { formatRelativeTime, getInitials, interpolateTemplate } from '@/lib';
/**
 * Props for the DeviceAccessTable component
 * @interface DeviceAccessTableProps
 * @prop {DeviceDetail} device - Device details.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {() => void} onInvite - Callback for the invite button.
 * @prop {(user: DeviceAccessListItem) => void} onRevoke - Callback for the revoke button.
 */
interface DeviceAccessTableProps {
    device: DeviceDetail;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
    onInvite: () => void;
    onRevoke: (user: DeviceAccessListItem) => void;
}
/**
 * Table component for showing the users that have access to the device.
 * @param {DeviceAccessTableProps} props - Props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function DeviceAccessTable({
    device,
    locale,
    translations,
    date,
    onInvite,
    onRevoke,
}: DeviceAccessTableProps): JSX.Element {
    const t: DeviceAccessTableTranslations = translations.detail.accessTable;
    const users = device.users ?? [];
    const owner = device.access_role === 'owner';

    /**
     * Resolve the user id from the clicked button and forward to onRevoke.
     * @param {MouseEvent<HTMLButtonElement>} e - The click event.
     * @returns {void}
     */
    const handleRevoke = (e: MouseEvent<HTMLButtonElement>): void => {
        const userId = e.currentTarget.dataset.id;
        if (!userId) return;
        const user = users.find(u => u.user_id === userId);
        if (!user) return;
        onRevoke(user);
    };

    return (
        <div className="dd-card dd-access-card">
            <div className="dd-card-head">
                <div>
                    <h3>{t.title}</h3>
                    <div className="dd-card-sub">
                        {owner
                            ? interpolateTemplate(t.peopleCanView, {
                                  count: users.length,
                              })
                            : t.visibleToOwnerOnly}
                    </div>
                </div>
                {owner && (
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<Plus size={13} />}
                        onClick={onInvite}
                    >
                        {t.addUser}
                    </Button>
                )}
            </div>
            {!owner ? (
                <div className="dd-users-empty">
                    <UserRound size={28} />
                    <div>{t.ownerOnly}</div>
                </div>
            ) : users.length === 0 ? (
                <div className="dd-users-empty">
                    <Users size={28} />
                    <div>{t.noUsers}</div>
                </div>
            ) : (
                <div className="dd-table-wrap">
                    <table className="dd-table">
                        <thead>
                            <tr>
                                <th>{t.name}</th>
                                <th>{t.role}</th>
                                <th>{t.accessGranted}</th>
                                <th className="dd-table-actions">
                                    {t.actions}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.user_id}>
                                    <td>
                                        <div className="dd-user-cell">
                                            <span className="dd-avatar">
                                                {getInitials(user.name)}
                                            </span>
                                            <span>
                                                <strong>{user.name}</strong>
                                                <small>{user.email}</small>
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <RolePill
                                            role={user.role}
                                            translations={translations}
                                        />
                                    </td>
                                    <td className="dd-muted">
                                        {formatRelativeTime(
                                            user.access_granted_at,
                                            locale,
                                            date
                                        )}
                                    </td>
                                    <td className="dd-table-actions">
                                        {user.role === 'owner' ? (
                                            <span className="dd-protected">
                                                {t.protected}
                                            </span>
                                        ) : (
                                            <IconButton
                                                danger
                                                dataID={user.user_id}
                                                ariaLabel={`${t.remove} ${user.name}`}
                                                title={t.remove}
                                                handleAction={handleRevoke}
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
