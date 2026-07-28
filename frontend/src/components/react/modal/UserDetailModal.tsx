import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { UserWithDevices } from '@/types/api';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Utils
import { formatDate, formatRelativeTime, interpolateTemplate } from '@/lib';
import { getInitials } from '@/lib/user-utils';
//-- Components
import { Modal } from '@/components/react/ui';
import { CopyButton } from '@/components/react/ui/button';
//-- Icons
import { Cpu } from 'lucide-react';
//-- Local
import {
    EmailStatusPill,
    PasswordPill,
    RolePill,
} from '@/components/react/features/users';

/**
 * Props for the UserDetailModal component.
 * @interface UserDetailModalProps
 * @prop {UserWithDevices | null} user - The user (with devices) to display, or null when the modal is closed.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {Language} locale - Active locale for date formatting.
 * @prop {Translation['user']['detail']} t - Translation strings for the modal body.
 * @prop {Translation['admin']['roles']} roleLabels - Localized role labels.
 * @prop {Translation['user']['table']} tableLabels - Localized table strings (verified/unverified/password labels).
 * @prop {Translation['date']} date - Date-related translation strings.
 */
interface UserDetailModalProps {
    user: UserWithDevices | null;
    onClose: () => void;
    locale: Language;
    t: Translation['user']['detail'];
    roleLabels: Translation['admin']['roles'];
    tableLabels: Translation['user']['table'];
    date: Translation['date'];
}

/**
 * UserDetailModal — read-only view of a single user, including their
 * paginated list of devices.
 * @param {UserDetailModalProps} props
 * @returns {JSX.Element | null}
 */
export function UserDetailModal({
    user,
    onClose,
    locale,
    t,
    roleLabels,
    tableLabels,
    date,
}: UserDetailModalProps): JSX.Element | null {
    if (!user) return null;
    const devices = user.devices ?? [];
    return (
        <Modal open={user !== null} onClose={onClose} title={t.title} size="lg">
            <div className="userdetail-banner">
                <div className="userdetail-avatar">
                    {getInitials(`${user.name} ${user.lastname}`)}
                </div>
                <div className="userdetail-info">
                    <h2 className="userdetail-name">
                        {user.name} {user.lastname}
                    </h2>
                    <div className="userdetail-mail">{user.email}</div>
                    <div className="userdetail-tags">
                        <RolePill role={user.role} labels={roleLabels} />
                        <EmailStatusPill
                            verified={user.email_verified}
                            verifiedLabel={tableLabels.verified}
                            unverifiedLabel={tableLabels.unverified}
                        />
                        {user.must_change_password && (
                            <PasswordPill
                                mustChange
                                okLabel={tableLabels.passwordOk}
                                changeLabel={tableLabels.changeRequired}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="userdetail-grid">
                <div className="userdetail-row">
                    <div className="userdetail-key">{t.accountId}</div>
                    <div className="userdetail-value is-mono">
                        {user.id}
                        <CopyButton
                            value={user.id}
                            label={t.copy}
                            copiedLabel={t.copied}
                        />
                    </div>
                </div>
                <div className="userdetail-row">
                    <div className="userdetail-key">Email</div>
                    <div className="userdetail-value">{user.email}</div>
                </div>
                <div className="userdetail-row">
                    <div className="userdetail-key">{t.emailVerification}</div>
                    <div className="userdetail-value">
                        <EmailStatusPill
                            verified={user.email_verified}
                            verifiedLabel={tableLabels.verified}
                            unverifiedLabel={tableLabels.unverified}
                        />
                    </div>
                </div>
                <div className="userdetail-row">
                    <div className="userdetail-key">{t.password}</div>
                    <div className="userdetail-value">
                        <PasswordPill
                            mustChange={user.must_change_password}
                            okLabel={tableLabels.passwordOk}
                            changeLabel={tableLabels.changeRequired}
                        />
                    </div>
                </div>
                <div className="userdetail-row">
                    <div className="userdetail-key">{t.memberSince}</div>
                    <div className="userdetail-value">
                        {formatDate(locale, user.created_at)}
                        <span className="userdetail-relative">
                            · {formatRelativeTime(user.created_at, locale, date)}
                        </span>
                    </div>
                </div>
                <div className="userdetail-row">
                    <div className="userdetail-key">{t.role}</div>
                    <div className="userdetail-value">
                        <RolePill role={user.role} labels={roleLabels} />
                    </div>
                </div>
            </div>

            <h3 className="userdetail-section-title">
                {interpolateTemplate(t.devicesAccess, {
                    count: devices.length,
                })}
            </h3>
            {devices.length === 0 ? (
                <div className="userdetail-empty">{t.noDevices}</div>
            ) : (
                <div className="userdetail-devices">
                    {devices.map(d => (
                        <div key={d.id} className="userdetail-device">
                            <div className="userdetail-device-icon">
                                <Cpu size={14} strokeWidth={1.6} />
                            </div>
                            <div className="userdetail-device-body">
                                <div className="userdetail-device-name">
                                    {d.name}
                                </div>
                                <div className="userdetail-device-meta">
                                    {d.uuid_firmware}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
