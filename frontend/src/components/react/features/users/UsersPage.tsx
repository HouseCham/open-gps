import '@/styles/users.css';

import { lazy, Suspense, useEffect, useState, type JSX } from 'react';
//-- Types
import type {
    CreatedUser,
    CreateUserDto,
    User,
    UsersTranslation,
} from '@/types/api';
import type { Translation } from '@/i18n';
import type { Language, WelcomeEmailRequest } from '@/types';
//-- Utils
import {
    computeFilterCounts,
    filterAndSortUsers,
    interpolateTemplate,
} from '@/lib';
//-- Components
import { Alert } from '@/components/react/ui/Alert';
import { Button } from '@/components/react/ui/button';
import { EmptyState } from '@/components/react/ui/EmptyState';
import { UserFilterBar } from './UserFilterBar';
import { UsersTable } from './UsersTable';
import type {
    UserEmailFilter,
    UserFilterCounts,
    UserSortKey,
} from '@/types/api';
//-- Services
import { useUserService } from '@/lib/api/services/userService';
//-- Stores
import { toastBus } from '@/lib/stores/toast.store';
//-- Icons
import {
    AlertTriangle,
    Download,
    UserPlus,
    Users as UsersIcon,
} from 'lucide-react';
import { useEmailService } from '@/lib/api/services';
//-- Lazy components
const AddUserModal = lazy(() =>
    import('@/components/react/modal/AddUserModal').then(m => ({
        default: m.AddUserModal,
    }))
);
const DeleteUserModal = lazy(() =>
    import('@/components/react/modal/deleteModal/DeleteUserModal').then(m => ({
        default: m.DeleteUserModal,
    }))
);
const TempPasswordModal = lazy(() =>
    import('@/components/react/modal/TempPasswordModal').then(m => ({
        default: m.TempPasswordModal,
    }))
);
const UserDetailModal = lazy(() =>
    import('@/components/react/modal/UserDetailModal').then(m => ({
        default: m.UserDetailModal,
    }))
);

/**
 * Props for the UsersPage component.
 * @interface UsersPageProps
 * @prop {Language} locale - Active locale.
 * @prop {UsersTranslation} translations - Translation bundle.
 * @prop {Translation['date']} dateTranslations - Date-related translation strings.
 * @prop {string} pageLabel - The page label (also rendered in the topbar).
 * @prop {string} pageSubtitle - The page subtitle shown under the title.
 */
interface UsersPageProps {
    locale: Language;
    translations: UsersTranslation;
    dateTranslations: Translation['date'];
    pageLabel: string;
    pageSubtitle: string;
}

/**
 * UsersPage — top-level island for `/[lan]/users`. Lists every user,
 * supports filtering + sorting, and exposes create / view / delete
 * actions through modals.
 * @param {UsersPageProps} props
 * @returns {JSX.Element}
 */
export function UsersPage({
    locale,
    translations: t,
    dateTranslations: date,
    pageLabel,
    pageSubtitle,
}: UsersPageProps): JSX.Element {
    const {
        users,
        user: detailUser,
        isLoading,
        error,
        getAllUsers,
        getUserByID,
        createUser,
        deleteUser,
    } = useUserService();
    const { sendWelcomeEmail } = useEmailService();

    const [query, setQuery] = useState('');
    const [emailFilter, setEmailFilter] = useState<UserEmailFilter>('all');
    const [sortBy, setSortBy] = useState<UserSortKey>('created-desc');

    const [addOpen, setAddOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [detailTarget, setDetailTarget] = useState<User | null>(null);
    const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        void getAllUsers();
    }, []);

    /**
     * Fetch the user's devices when the detail modal opens.
     */
    useEffect(() => {
        if (!detailTarget) return;
        void getUserByID(detailTarget.id);
    }, [detailTarget]);

    const filtered = filterAndSortUsers(users, query, emailFilter, sortBy);

    const counts: UserFilterCounts = computeFilterCounts(users);

    const hasFilters = !!query || emailFilter !== 'all';

    /**
     * Clear all search filters.
     * @returns {void}
     */
    const clearFilters = (): void => {
        setQuery('');
        setEmailFilter('all');
    };
    /**
     * Send a welcome email to a user.
     * @param {User} user - The user to send the email to.
     * @returns {void}
     */
    const handleSendEmail = async (user: CreatedUser): Promise<void> => {
        const request: WelcomeEmailRequest = {
            email: user.email,
            first_name: user.name,
            subject: t.tempPassword.emailSubject,
            temporary_password: user.temporary_password,
            locale,
        };
        const ok = await sendWelcomeEmail(request);
        // if the email was sent successfully, show a toast only
        if (ok) {
            toastBus.push({
                variant: 'success',
                title: t.toast.emailSent.title,
                message: interpolateTemplate(t.toast.emailSent.message, {
                    name: `${user.name} ${user.lastname}`.trim(),
                }),
            });
            // otherwise, show the temporary password in the modal
        } else {
            setCreatedUser(user);
        }
    };
    /**
     * Submit the create-user form.
     * @param {CreateUserDto} payload - The validated form payload.
     * @returns {Promise<void>}
     */
    const handleCreate = async (payload: CreateUserDto): Promise<void> => {
        setCreateLoading(true);
        try {
            const created = await createUser(payload);
            setAddOpen(false);
            const name = `${created.name} ${created.lastname}`.trim();
            toastBus.push({
                variant: 'success',
                title: t.toast.userCreated.title,
                message: interpolateTemplate(t.toast.userCreated.message, {
                    name,
                }),
            });
            handleSendEmail(created);
        } catch (err) {
            // service already pushed a toast via withApiErrorToast; keep
            // the modal open so the admin can retry without re-typing.
            // Log so we have a breadcrumb if the toast ever drops one.
            console.error('[UsersPage] create user failed:', err);
        } finally {
            setCreateLoading(false);
        }
    };

    /**
     * Confirm a destructive delete.
     * @returns {Promise<void>}
     */
    const handleDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        const removed = deleteTarget;
        try {
            await deleteUser(removed.id);
            setDeleteTarget(null);
            toastBus.push({
                variant: 'success',
                title: t.toast.userDeleted.title,
                message: interpolateTemplate(t.toast.userDeleted.message, {
                    name: `${removed.name} ${removed.lastname}`.trim(),
                }),
            });
        } catch (err) {
            // service already pushed a toast via withApiErrorToast; leave
            // the modal open so the admin can retry. Log so we have a
            // breadcrumb if the toast ever drops one.
            console.error('[UsersPage] delete user failed:', err);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
            <header className="users-page-header">
                <div className="users-page-titles">
                    <div className="users-page-eyebrow">{t.admin.title}</div>
                    <h1 className="users-page-title">{pageLabel}</h1>
                    <p className="users-page-sub">{pageSubtitle}</p>
                </div>
                <div className="users-page-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        icon={<Download size={14} strokeWidth={1.6} />}
                    >
                        {t.page.export}
                    </Button>
                    {/* Add user button */}
                    <Button
                        type="button"
                        variant="primary"
                        icon={<UserPlus size={14} strokeWidth={1.6} />}
                        onClick={() => setAddOpen(true)}
                    >
                        {t.admin.userTable.addUser}
                    </Button>
                </div>
            </header>

            <UserFilterBar
                t={t.filters}
                query={query}
                onQuery={setQuery}
                emailFilter={emailFilter}
                onEmailFilter={setEmailFilter}
                sortBy={sortBy}
                onSortBy={setSortBy}
                counts={counts}
                onRefresh={() => void getAllUsers()}
            />

            {error && (
                <Alert
                    tone="danger"
                    icon={<AlertTriangle size={14} />}
                    title={t.admin.userTable.failedToLoad}
                    message={error.message}
                    actions={
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void getAllUsers()}
                        >
                            {t.filters.sortLabel}
                        </Button>
                    }
                />
            )}

            <div className="users-result-row">
                <div className="users-result-count">
                    {interpolateTemplate(t.page.showing, {
                        shown: filtered.length,
                        total: users.length,
                    })}
                </div>
                {hasFilters && (
                    <button
                        type="button"
                        className="users-clear"
                        onClick={clearFilters}
                    >
                        {t.page.clearFilters}
                    </button>
                )}
            </div>

            {users.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<UsersIcon size={28} strokeWidth={1.6} />}
                    title={t.noUsersTitle}
                    message={t.noUsersMessage}
                    action={
                        <Button
                            type="button"
                            variant="primary"
                            icon={<UserPlus size={14} strokeWidth={1.6} />}
                            onClick={() => setAddOpen(true)}
                        >
                            {t.page.addFirstUser}
                        </Button>
                    }
                />
            ) : filtered.length === 0 ? (
                <div className="dev-no-results">
                    <div className="dev-no-results-title">
                        {t.page.noResultsTitle}
                    </div>
                    <div className="dev-no-results-msg">
                        {t.page.noResultsMessage}
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={clearFilters}
                    >
                        {t.page.clearFilters}
                    </Button>
                </div>
            ) : (
                <UsersTable
                    t={t.table}
                    users={filtered}
                    locale={locale}
                    roleLabels={t.admin.roles}
                    onOpen={setDetailTarget}
                    onDelete={setDeleteTarget}
                />
            )}

            <Suspense fallback={null}>
                <AddUserModal
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    onCreate={handleCreate}
                    loading={createLoading}
                    t={t.admin.createUser}
                    createT={t.create}
                />
            </Suspense>

            <Suspense fallback={null}>
                <UserDetailModal
                    user={detailTarget && detailUser}
                    onClose={() => setDetailTarget(null)}
                    locale={locale}
                    t={t.detail}
                    roleLabels={t.admin.roles}
                    tableLabels={t.table}
                    date={date}
                />
            </Suspense>

            <Suspense fallback={null}>
                <TempPasswordModal
                    user={createdUser}
                    onClose={() => setCreatedUser(null)}
                    t={t.tempPassword}
                />
            </Suspense>

            <Suspense fallback={null}>
                <DeleteUserModal
                    user={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                    loading={deleteLoading}
                    t={t.delete}
                    roleLabels={t.admin.roles}
                    locale={locale}
                />
            </Suspense>
        </>
    );
}
