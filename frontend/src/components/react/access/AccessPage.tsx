import '@/styles/access.css';
import { lazy, Suspense, useEffect, useState, type JSX } from 'react';
//-- Types
import type {
    AccessTranslation,
    ApiKeyRevealPayload,
    ApiKeySortKey,
    Language,
} from '@/types';
import type { Translation } from '@/i18n';
//-- Icons
import { AlertTriangle, KeyRound, KeySquare } from 'lucide-react';
//-- Components
import { Button } from '@/components/react/ui/button';
import { EmptyState } from '@/components/react/ui/EmptyState';
import { AccessFilterBar } from './AccessFilterBar';
import { AccessKeysTable } from './AccessKeysTable';
//-- Services
import {
    useApiKeyService,
    type ApiKeyRow,
} from '@/lib/api/services/apiKeyService';
import { useDeviceService } from '@/lib/api/services/deviceService';
//-- Utils
import { interpolateTemplate } from '@/lib';
//-- Stores
import { toastBus } from '@/lib/stores/toast.store';
//-- Lazy components
const AddAccessKeyModal = lazy(() =>
    import('@/components/react/modal/AddAccessKeyModal').then(m => ({
        default: m.AddAccessKeyModal,
    }))
);
const DeleteAccessKeyModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.DeleteAccessKeyModal,
    }))
);

/**
 * Props for the AccessPage component.
 * @interface AccessPageProps
 * @prop {Language} locale - Active locale.
 * @prop {AccessTranslation} translations - Localized strings.
 * @prop {Translation['date']} dateTranslations - Date-related translation strings.
 * @prop {string} pageLabel - Page label rendered in the topbar.
 */
interface AccessPageProps {
    locale: Language;
    translations: AccessTranslation;
    dateTranslations: Translation['date'];
    pageLabel: string;
}

/**
 * AccessPage — top-level island for `/[lan]/access`. Lists every
 * active API key across the user's devices, supports a search query
 * and sort, and exposes issue / revoke through the two modals.
 * @param {AccessPageProps} props
 * @returns {JSX.Element}
 */
export function AccessPage({
    locale,
    translations: t,
    dateTranslations: date,
    pageLabel,
}: AccessPageProps): JSX.Element {
    const { rows, isLoading, error, getAllApiKeys, issueApiKey, revokeApiKey } =
        useApiKeyService();
    const { devices, getAllDevices } = useDeviceService();

    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<ApiKeySortKey>('created-desc');
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ApiKeyRow | null>(null);
    const [revokeLoading, setRevokeLoading] = useState(false);

    /**
     * Initial data fetch — keys (the table data) and devices (the add
     * modal picker). Keys can render without devices; the modal guards
     * against an empty device list.
     */
    useEffect(() => {
        void getAllApiKeys();
        void getAllDevices();
    }, []);

    const q = query.trim().toLowerCase();
    const filtered = rows.filter(r => {
        if (!q) return true;
        return (
            r.device_name.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q) ||
            r.device_id.toLowerCase().includes(q)
        );
    });
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'created-desc':
                return (
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
            case 'created-asc':
                return (
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
            case 'device-asc':
                return a.device_name.localeCompare(b.device_name);
            default:
                return 0;
        }
    });

    const hasFilters = !!query;
    const totalDevices = new Set(rows.map(r => r.device_id)).size;

    const refresh = (): void => {
        void getAllApiKeys();
    };

    /**
     * Clear filters.
     * @returns {void}
     */
    const clearFilters = (): void => {
        setQuery('');
    };

    /**
     * Issue a key for the chosen device. Called by the add modal;
     * returns the reveal payload so the modal can flip into reveal
     * state, or `null` on failure (the service already pushes a toast).
     * @param {string} deviceId - The device to issue a key for.
     * @returns {Promise<ApiKeyRevealPayload | null>}
     */
    const handleIssue = async (
        deviceId: string
    ): Promise<ApiKeyRevealPayload | null> => {
        const device = devices.find(d => d.id === deviceId);
        const result = await issueApiKey(deviceId);
        if (!result) return null;
        // Refresh so the new row shows up once the user closes the
        // reveal state.
        void getAllApiKeys();
        toastBus.push({
            variant: 'success',
            title: t.page.addKey,
            message: interpolateTemplate(t.page.issuedToast, {
                device: device?.name ?? result.id,
            }),
        });
        return {
            deviceName: device?.name ?? result.id,
            plainKey: result.plain_key,
        };
    };

    /**
     * Confirm a revoke.
     * @returns {Promise<void>}
     */
    const handleRevoke = async (): Promise<void> => {
        if (!deleteTarget) return;
        setRevokeLoading(true);
        try {
            await revokeApiKey(deleteTarget.device_id, deleteTarget.id);
            toastBus.push({
                variant: 'success',
                title: t.page.revokedToast.split('"')[0] || '',
                message: interpolateTemplate(t.page.revokedToast, {
                    device: deleteTarget.device_name,
                }),
            });
            setDeleteTarget(null);
        } catch {
            toastBus.push({
                variant: 'error',
                title: t.modals.revokeTitle,
                message: t.modals.revokeFailed,
            });
        } finally {
            setRevokeLoading(false);
        }
    };

    return (
        <>
            <header className="access-page-header">
                <div>
                    <h1>{pageLabel}</h1>
                    <div className="access-page-header-sub">
                        {interpolateTemplate(t.page.summary, {
                            total: rows.length,
                            devices: totalDevices,
                        })}
                    </div>
                </div>
                <div className="access-page-header-actions">
                    <Button
                        variant="primary"
                        icon={<KeyRound size={14} strokeWidth={1.6} />}
                        onClick={() => setAddOpen(true)}
                    >
                        {t.page.addKey}
                    </Button>
                </div>
            </header>

            <AccessFilterBar
                t={t.filters}
                query={query}
                onQuery={setQuery}
                sortBy={sortBy}
                onSortBy={setSortBy}
                onRefresh={refresh}
            />

            {error && (
                <div className="access-error" role="alert">
                    <AlertTriangle size={14} strokeWidth={1.6} />
                    {error.message}
                    <Button variant="secondary" size="sm" onClick={refresh}>
                        {t.table.refresh}
                    </Button>
                </div>
            )}

            <div className="access-result-row">
                <div className="access-result-count">
                    {filtered.length === rows.length
                        ? `${rows.length} ${t.title.toLowerCase()}`
                        : `${filtered.length} / ${rows.length}`}
                </div>
                {hasFilters && (
                    <button
                        type="button"
                        className="access-clear"
                        onClick={clearFilters}
                    >
                        {t.page.clearFilters}
                    </button>
                )}
            </div>

            {rows.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<KeySquare size={28} strokeWidth={1.6} />}
                    title={t.title}
                    message={t.page.addFirstKey}
                    action={
                        <Button
                            variant="primary"
                            icon={<KeyRound size={14} strokeWidth={1.6} />}
                            onClick={() => setAddOpen(true)}
                        >
                            {t.page.addKey}
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
                    <Button variant="secondary" onClick={clearFilters}>
                        {t.page.clearFilters}
                    </Button>
                </div>
            ) : (
                <AccessKeysTable
                    t={t.table}
                    date={date}
                    rows={filtered}
                    locale={locale}
                    onDelete={setDeleteTarget}
                />
            )}

            {/* Add key modal */}
            <Suspense fallback={null}>
                <AddAccessKeyModal
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    onIssue={handleIssue}
                    devices={devices}
                    rows={rows}
                    t={t.modals}
                />
            </Suspense>

            {/* Revoke key modal */}
            <Suspense fallback={null}>
                <DeleteAccessKeyModal
                    open={deleteTarget !== null}
                    row={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleRevoke}
                    loading={revokeLoading}
                    t={t.modals}
                />
            </Suspense>
        </>
    );
}
