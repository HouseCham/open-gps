import '@/styles/device-detail.css';
import '@/styles/devices.css';

import { useEffect, useRef, useState, lazy, type JSX, Suspense } from 'react';
//-- Types
import type {
    DeviceAccessListItem,
    DeviceDetail,
    DeviceVehicleType,
    LocationPoint,
} from '@/types/api';
import type { Language } from '@/types';
import type { Translation } from '@/i18n';
//-- Utils
import { deriveDeviceStatus } from '@/lib/device-utils';
import { useDeviceService } from '@/lib/api/services/deviceService';
import { useLocationService } from '@/lib/api/services/locationService';
import { toastBus } from '@/lib/stores/toast.store';
import {
    LIVE_POLL_INTERVAL_MS,
    LIVE_STALE_RETRIES,
    LIVE_STALE_THRESHOLD_MS,
} from '@/constants/components';
import { redirectTo } from '@/lib';
//-- Components
import { Breadcrumbs, EmptyState } from '@/components/react/ui';
import { DeviceDetailError } from './DeviceDetailError';
import { VehicleDetailHeader } from './VehicleDetailHeader';
import { KpiStrip } from './Kpi';
import { DeviceInfoCard } from './DeviceInfoCard';
import { Button } from '@/components/react/ui/button';
import {
    MapCard,
    TelemetryCard,
} from '@/components/react/features/devices/location';
import { DeviceAccessTable } from '@/components/react/features/devices/access';
//-- Icons
import { AlertTriangle } from 'lucide-react';
//-- Lazy components
const EditDeviceModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.EditDeviceModal,
    }))
);
const DeleteDeviceModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.DeleteDeviceModal,
    }))
);
const GrantAccessModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.GrantAccessModal,
    }))
);
const RevokeAccessModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.RevokeAccessModal,
    }))
);

/**
 * Props for the DeviceDetailPage component
 * @interface DeviceDetailPageProps
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} dateTranslations - Date-related translation strings.
 * @prop {string} pageLabel - Page label.
 */
interface DeviceDetailPageProps {
    locale: Language;
    translations: Translation['device'];
    dateTranslations: Translation['date'];
    pageLabel: string;
}

/**
 * DeviceDetailPage component
 * @param {DeviceDetailPageProps} props - Props for the DeviceDetailPage component.
 * @returns {JSX.Element} The rendered DeviceDetailPage component
 */
export function DeviceDetailPage({
    locale,
    translations: t,
    dateTranslations: date,
    pageLabel,
}: DeviceDetailPageProps): JSX.Element {
    const {
        device,
        isLoading: deviceLoading,
        error: deviceError,
        getDeviceById,
        grantAccess,
        revokeAccess,
        updateDevice,
        deleteDevice,
    } = useDeviceService();
    const {
        latest,
        isLoading: locationLoading,
        error: locationError,
        getLatestLocation,
    } = useLocationService();
    const [deviceId, setDeviceId] = useState<string | undefined>();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] =
        useState<DeviceAccessListItem | null>(null);
    const [liveMode, setLiveMode] = useState(false);
    const [liveEntries, setLiveEntries] = useState<LocationPoint[]>([]);
    const latestRef = useRef<LocationPoint | null>(null);

    useEffect(() => {
        setDeviceId(
            new URLSearchParams(window.location.search).get('id') ?? ''
        );
    }, []);

    useEffect(() => {
        if (!deviceId) return;
        void Promise.all([
            getDeviceById(deviceId),
            getLatestLocation(deviceId),
        ]);
        setLiveMode(false);
        setLiveEntries([]);
    }, [deviceId]);

    useEffect(() => {
        if (!liveMode) {
            setLiveEntries([]);
            return;
        }
        if (!latest) return;

        // Prevent duplicate entries
        const lastEntry = liveEntries[0];
        if (lastEntry && lastEntry.recorded_at === latest.recorded_at) return;

        // If latest.recorded_at is older that 30 seconds...

        setLiveEntries(prev => [latest, ...prev]);
    }, [latest, liveMode]);

    useEffect(() => {
        if (!liveMode || !deviceId) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const isLatestStale = (): boolean => {
            const recorded = latestRef.current?.recorded_at;
            if (!recorded) return false;
            return (
                Date.now() - new Date(recorded).getTime() >
                LIVE_STALE_THRESHOLD_MS
            );
        };

        const stopWithNotice = (): void => {
            setLiveMode(false);
            toastBus.push({
                variant: 'warning',
                title: t.detail.deviceNotLiveTitle,
                message: t.detail.deviceNotLiveMessage,
            });
        };

        const poll = async (): Promise<void> => {
            if (cancelled) return;
            await getLatestLocation(deviceId);
            if (cancelled) return;

            if (isLatestStale()) {
                for (let i = 0; i < LIVE_STALE_RETRIES && !cancelled; i += 1) {
                    await getLatestLocation(deviceId);
                    if (cancelled) return;
                    if (!isLatestStale()) break;
                }
                if (cancelled) return;
                if (isLatestStale()) {
                    stopWithNotice();
                    return;
                }
            }

            timer = setTimeout(poll, LIVE_POLL_INTERVAL_MS);
        };
        void poll();
        return (): void => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [liveMode, deviceId]);

    useEffect(() => {
        latestRef.current = latest;
    }, [latest]);

    useEffect(() => {
        if (!liveMode || !locationError) return;
        setLiveMode(false);
        toastBus.push({
            variant: 'error',
            title: t.detail.connectionLost,
            message: locationError.message || t.detail.connectionLostMessage,
        });
    }, [liveMode, locationError]);

    const status = device ? deriveDeviceStatus(device.last_seen_at, t) : null;
    /**
     * Go back to the devices page
     * @returns {void}
     */
    const goBack = (): void => redirectTo(`/${locale}/devices/`);
    /**
     * Reload the device and location data
     * @returns {void}
     */
    const reload = (): void => {
        if (!deviceId) return;
        void Promise.all([
            getDeviceById(deviceId),
            getLatestLocation(deviceId),
        ]);
    };
    /**
     * Handle the invitation of a user
     * @param {string} userId - The ID of the user to invite.
     * @returns {Promise<void>} A promise that resolves when the invitation is sent.
     */
    const handleInvite = async (userId: string): Promise<void> => {
        if (!device) return;
        await grantAccess(device.id, userId);
        setInviteOpen(false);
    };
    /**
     * Handle the revocation of a user
     * @returns {Promise<void>} A promise that resolves when the revocation is sent.
     */
    const handleRevoke = async (): Promise<void> => {
        if (!device || !revokeTarget) return;
        await revokeAccess(device.id, revokeTarget.user_id);
        setRevokeTarget(null);
    };
    /**
     * Handle the editing of a device.
     * @param {string} id - The ID of the device to edit.
     * @param {object} data - The data for the edited device.
     * @returns {Promise<void>} A promise that resolves when the device is edited.
     */
    const handleEdit = async (
        id: string,
        data: {
            name: string;
            vehicle_type: DeviceVehicleType;
            access_role: DeviceDetail['access_role'];
        }
    ): Promise<void> => {
        await updateDevice(id, data);
        setEditOpen(false);
    };
    /**
     * Handle the deletion of a device.
     * @returns {Promise<void>} A promise that resolves when the device is deleted.
     */
    const handleDelete = async (): Promise<void> => {
        if (!device) return;
        await deleteDevice(device.id);
        goBack();
    };

    if (deviceId === undefined || deviceLoading) {
        return (
            <div className="dd-loading" role="status">
                {t.detail.loading}
            </div>
        );
    }

    if (!deviceId) {
        return (
            <EmptyState
                icon={<AlertTriangle size={28} />}
                title={t.detail.missingDeviceTitle}
                message={t.detail.missingDeviceMessage}
                action={
                    <Button type="button" variant="primary" onClick={goBack}>
                        {t.detail.backToDevices}
                    </Button>
                }
            />
        );
    }

    if (!device || !status) {
        return (
            <>
                <DeviceDetailError
                    message={deviceError?.message ?? t.detail.failedToLoad}
                    onRetry={reload}
                    retryLabel={t.detail.retry}
                />
                <Button type="button" variant="secondary" onClick={goBack}>
                    {t.detail.backToDevices}
                </Button>
            </>
        );
    }

    return (
        <div className="device-detail">
            {/* Top Section */}
            <Breadcrumbs
                items={[
                    { label: t.detail.workspace, href: `/${locale}/` },
                    { label: pageLabel, href: `/${locale}/devices/` },
                    { label: device.name },
                ]}
            />
            <VehicleDetailHeader
                device={device}
                status={status}
                locale={locale}
                translations={t}
                date={date}
                onBack={goBack}
                onShare={() => setInviteOpen(true)}
                onEdit={() => setEditOpen(true)}
                onDelete={() => setDeleteOpen(true)}
            />
            {(deviceError || locationError) && (
                <DeviceDetailError
                    message={
                        deviceError?.message ??
                        locationError?.message ??
                        t.detail.failedToLoad
                    }
                    onRetry={reload}
                    retryLabel={t.detail.retry}
                />
            )}
            {/* KPI Cards */}
            <KpiStrip
                device={device}
                location={latest}
                status={status}
                locale={locale}
                translations={t}
                date={date}
            />

            {/* GPS Telemetry Section */}
            <section className="dd-section">
                <div className="dd-section-head">
                    <div>
                        <h2>{t.detail.gpsTelemetry}</h2>
                        <div>{t.detail.gpsTelemetryDescription}</div>
                    </div>
                </div>
                <div className="dd-map-grid">
                    <MapCard
                        location={latest}
                        locale={locale}
                        translations={t}
                        date={date}
                        loading={locationLoading}
                        onRefresh={() => {
                            if (deviceId) void getLatestLocation(deviceId);
                        }}
                        onGoLive={() => setLiveMode(v => !v)}
                        liveMode={liveMode}
                    />
                    <TelemetryCard
                        location={latest}
                        locale={locale}
                        translations={t}
                        date={date}
                        liveEntries={liveEntries}
                        liveMode={liveMode}
                    />
                </div>
            </section>

            {/* Device Information Section */}
            <section className="dd-section">
                <div className="dd-section-head">
                    <div>
                        <h2>{t.detail.deviceSection}</h2>
                        <div>{t.detail.deviceSectionDescription}</div>
                    </div>
                </div>
                <DeviceInfoCard
                    device={device}
                    locale={locale}
                    translations={t}
                    date={date}
                />
            </section>

            {/* Device/Users Access Section */}
            <section className="dd-section">
                <div className="dd-section-head">
                    <div>
                        <h2>{t.detail.access}</h2>
                        <div>{t.detail.accessDescription}</div>
                    </div>
                </div>
                <DeviceAccessTable
                    device={device}
                    locale={locale}
                    translations={t}
                    date={date}
                    onInvite={() => setInviteOpen(true)}
                    onRevoke={setRevokeTarget}
                />
            </section>

            {/* Grant Access Modal */}
            <Suspense fallback={null}>
                <GrantAccessModal
                    open={inviteOpen}
                    onClose={() => setInviteOpen(false)}
                    onGrant={handleInvite}
                    loading={deviceLoading}
                    t={t.detail.accessTable}
                />
            </Suspense>

            {/* Revoke Access Modal */}
            <Suspense fallback={null}>
                <RevokeAccessModal
                    open={revokeTarget !== null}
                    user={revokeTarget}
                    onClose={() => setRevokeTarget(null)}
                    onConfirm={handleRevoke}
                    loading={deviceLoading}
                    t={t.detail.accessTable}
                />
            </Suspense>

            {/* Edit Device Modal */}
            <Suspense fallback={null}>
                <EditDeviceModal
                    open={editOpen}
                    device={device}
                    onClose={() => setEditOpen(false)}
                    onSave={handleEdit}
                    t={t}
                />
            </Suspense>

            {/* Delete Device Modal */}
            <Suspense fallback={null}>
                <DeleteDeviceModal
                    open={deleteOpen}
                    device={device}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={handleDelete}
                    t={t}
                />
            </Suspense>
        </div>
    );
}
