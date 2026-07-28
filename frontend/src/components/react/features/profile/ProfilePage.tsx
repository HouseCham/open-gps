import '@/styles/profile.css';
import { lazy, Suspense, useEffect, useState, type JSX } from 'react';
//-- Stores
import { useStore } from '@nanostores/react';
import { $user } from '@/lib/stores/auth';
//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
import type { UpdateUserDto } from '@/types/api';
//-- Components
import { EmptyState } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
//-- Icons
import {
    AlertTriangle,
    CalendarDays,
    Check,
    Cpu,
    Hash,
    Mail,
    Pencil,
    RefreshCw,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
//-- Services
import { useUserService } from '@/lib/api/services/userService';
//-- Utils
import { toastBus } from '@/lib/stores/toast.store';
import { formatDate } from '@/lib/date-utils';
import { getInitials, interpolateTemplate } from '@/lib';
//-- Lazy components
const EditProfileModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.EditProfileModal,
    }))
);

/**
 * Props for the ProfilePage component
 * @interface ProfilePageProps
 * @prop {Language} locale - The current locale
 * @prop {Translation['profile']} translations - The translations
 */
interface ProfilePageProps {
    locale: Language;
    translations: Translation['profile'];
}
/**
 * Profile page component
 * @param {ProfilePageProps} props - The props for the component
 * @returns {JSX.Element} The rendered component
 */
export function ProfilePage({
    locale,
    translations: t,
}: ProfilePageProps): JSX.Element {
    const authUser = useStore($user);
    const { user, isLoading, error, getUserByID, updateUser } =
        useUserService();
    const [editOpen, setEditOpen] = useState(false);

    useEffect(() => {
        if (!authUser?.id) return;
        void getUserByID(authUser.id).catch(error => {
            void error;
        });
    }, [authUser?.id]);

    /**
     * Reload the user data manually
     * @returns {void}
     */
    const reload = (): void => {
        if (!authUser?.id) return;
        void getUserByID(authUser.id).catch(error => {
            void error;
        });
    };
    /**
     * Save/Update the user profile
     * @param {UpdateUserDto} payload - The user profile data
     * @returns {Promise<void>}
     */
    const saveProfile = async (payload: UpdateUserDto): Promise<void> => {
        if (!user) return;
        await updateUser(user.id, payload);
        setEditOpen(false);
        toastBus.push({
            variant: 'success',
            title: t.edit.savedTitle,
            message: t.edit.saved,
        });
    };

    if (!authUser || (isLoading && !user)) {
        return (
            <div className="profile-loading" role="status">
                <RefreshCw size={18} aria-hidden="true" />
                {t.loading}
            </div>
        );
    }

    if (!user) {
        return (
            <EmptyState
                icon={<AlertTriangle size={28} aria-hidden="true" />}
                title={t.failedToLoad}
                message={error?.message ?? t.failedToLoadDescription}
                action={
                    <Button type="button" variant="primary" onClick={reload}>
                        {t.retry}
                    </Button>
                }
            />
        );
    }

    const fullName = `${user.name} ${user.lastname}`.trim() || user.email;
    const roleLabel =
        user.role === 'super_admin' ? t.roles.superAdmin : t.roles.user;

    return (
        <div className="profile-page">
            <header className="profile-page-header">
                <div>
                    <div className="profile-page-eyebrow">
                        {t.eyebrow} · {roleLabel}
                    </div>
                    <h1>{t.title}</h1>
                    <p>{t.subtitle}</p>
                </div>
                <div className="profile-page-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        icon={<RefreshCw size={14} aria-hidden="true" />}
                        onClick={reload}
                    >
                        {t.refresh}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        icon={<Pencil size={14} aria-hidden="true" />}
                        onClick={() => setEditOpen(true)}
                    >
                        {t.editProfile}
                    </Button>
                </div>
            </header>

            <section className="profile-hero" aria-labelledby="profile-heading">
                <div className="profile-avatar" aria-hidden="true">
                    {getInitials(`${user.name} ${user.lastname}`)}
                </div>
                <div className="profile-hero-body">
                    <div className="profile-name-row">
                        <h2 id="profile-heading">{fullName}</h2>
                        <span
                            className={`profile-role profile-role--${user.role}`}
                        >
                            <span aria-hidden="true" />
                            {roleLabel}
                        </span>
                    </div>
                    <div className="profile-hero-meta">
                        <span>
                            <Mail size={14} aria-hidden="true" />
                            {user.email}
                        </span>
                        <span>
                            <CalendarDays size={14} aria-hidden="true" />
                            {t.joined} {formatDate(locale, user.created_at)}
                        </span>
                        <span className="mono">
                            <ShieldCheck size={14} aria-hidden="true" />
                            {t.id} {user.id}
                        </span>
                    </div>
                </div>
            </section>

            <div className="profile-grid">
                <section className="profile-card">
                    <header className="profile-card-header">
                        <div>
                            <h2>
                                <UserRound size={16} aria-hidden="true" />
                                {t.account.title}
                            </h2>
                            <p>{t.account.description}</p>
                        </div>
                    </header>
                    <div className="profile-card-body">
                        <div className="profile-row">
                            <div className="profile-row-label">
                                {t.account.fullName}
                            </div>
                            <div className="profile-row-value">{fullName}</div>
                        </div>
                        <div className="profile-row">
                            <div className="profile-row-label">
                                {t.account.email}
                            </div>
                            <div className="profile-row-value profile-row-value--wrap">
                                <span>{user.email}</span>
                                <span
                                    className={`profile-status profile-status--${user.email_verified ? 'verified' : 'unverified'}`}
                                >
                                    {user.email_verified && (
                                        <Check size={12} aria-hidden="true" />
                                    )}
                                    {user.email_verified
                                        ? t.account.verified
                                        : t.account.unverified}
                                </span>
                            </div>
                        </div>
                        <div className="profile-row">
                            <div className="profile-row-label">
                                {t.account.role}
                            </div>
                            <div className="profile-row-value">{roleLabel}</div>
                        </div>
                        <div className="profile-row">
                            <div className="profile-row-label">
                                {t.account.memberSince}
                            </div>
                            <div className="profile-row-value">
                                {formatDate(locale, user.created_at)}
                            </div>
                        </div>
                        <div className="profile-row">
                            <div className="profile-row-label">
                                {t.account.userId}
                            </div>
                            <div className="profile-row-value mono">
                                {user.id}
                            </div>
                        </div>
                    </div>
                    <footer className="profile-card-footer">
                        <ShieldCheck size={14} aria-hidden="true" />
                        {t.account.readOnlyNote}
                    </footer>
                </section>

                <section className="profile-card">
                    <header className="profile-card-header">
                        <div>
                            <h2>
                                <Cpu size={16} aria-hidden="true" />
                                {t.devices.title}
                            </h2>
                            <p>{t.devices.description}</p>
                        </div>
                        <span className="profile-count">
                            {user.pagination.total}
                        </span>
                    </header>
                    <div className="profile-device-list">
                        {user.devices.length > 0 ? (
                            user.devices.map(device => (
                                <div className="profile-device" key={device.id}>
                                    <div className="profile-device-icon">
                                        <Cpu size={16} aria-hidden="true" />
                                    </div>
                                    <div className="profile-device-body">
                                        <div>{device.name}</div>
                                        <span className="mono">
                                            {device.uuid_firmware}
                                        </span>
                                    </div>
                                    <Hash size={14} aria-hidden="true" />
                                </div>
                            ))
                        ) : (
                            <div className="profile-devices-empty">
                                {t.devices.empty}
                            </div>
                        )}
                    </div>
                    <footer className="profile-card-footer">
                        <Cpu size={14} aria-hidden="true" />
                        {interpolateTemplate(t.devices.summary, {
                            shown: user.devices.length,
                            total: user.pagination.total,
                        })}
                    </footer>
                </section>
            </div>

            {/* Edit Profile Informatino Modal */}
            <Suspense fallback={null}>
                <EditProfileModal
                    open={editOpen}
                    user={user}
                    translations={t.edit}
                    onClose={() => setEditOpen(false)}
                    onSave={saveProfile}
                />
            </Suspense>
        </div>
    );
}
