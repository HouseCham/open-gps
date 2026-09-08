import '@/styles/device-detail.css';
import '@/styles/devices.css';

import { useEffect, useState, lazy, type JSX, Suspense } from 'react';
//-- Types
import type {
    DeviceAccessListItem,
    DeviceDetail,
    DeviceVehicleType,
} from '@/types/api';
import type { Language } from '@/types';
import type { Translation } from '@/i18n';
//-- Utils
import { deviceStatusFromPresence } from '@/lib/device-utils';
import { useDeviceService } from '@/lib/api/services/deviceService';
import { useLocationService } from '@/lib/api/services/locationService';
import { useDeviceLocationStream } from '@/hooks/useDeviceLocationStream';
import { redirectTo } from '@/lib';
//-- Components
import { Breadcrumbs, EmptyState } from '@/components/react/ui';
import { DeviceDetailError } from './DeviceDetailError';
import { VehicleDetailHeader } from './VehicleDetailHeader';
import { DeviceInfoCard } from './DeviceInfoCard';
import { Button } from '@/components/react/ui/button';
import { DeviceAccessTable } from '@/components/react/features/devices/access';
import { GpsTelemetrySection } from './GpsTelemetrySection';
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
    const { latestLoading: locationLoading, latestError: locationError } =
        useLocationService();
    const [deviceId, setDeviceId] = useState<string | undefined>();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] =
        useState<DeviceAccessListItem | null>(null);
    const { snapshot, refresh: refreshLive } = useDeviceLocationStream(
        deviceId ?? null
    );
    const latest = snapshot?.location ?? null;

    useEffect(() => {
        setDeviceId(
            new URLSearchParams(window.location.search).get('id') ?? ''
        );
    }, []);

    useEffect(() => {
        if (!deviceId) return;
        void Promise.all([getDeviceById(deviceId)]);
    }, [deviceId]);

    const status = device
        ? deviceStatusFromPresence(snapshot?.presence.state ?? 'never_seen', t)
        : null;
    /**
     * Go back to the devices page
     * @returns {void}
     */
    const goBack = (): void => redirectTo(`/devices/`);
    /**
     * Reload the device and location data
     * @returns {void}
     */
    const reload = (): void => {
        if (!deviceId) return;
        void Promise.all([getDeviceById(deviceId), refreshLive()]);
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

            {/* Header Section */}
            <VehicleDetailHeader
                device={{
                    ...device,
                    last_seen_at: latest?.recorded_at ?? null,
                }}
                status={status}
                locale={locale}
                translations={t}
                date={date}
                onBack={goBack}
                onShare={() => setInviteOpen(true)}
                onEdit={() => setEditOpen(true)}
                onDelete={() => setDeleteOpen(true)}
            />

            {/* Error Section */}
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

            {/* GPS Telemetry Section */}
            <GpsTelemetrySection
                showGoLive
                title={t.detail.gpsTelemetry}
                description={t.detail.gpsTelemetryDescription}
                latest={
                    latest
                        ? {
                              ...latest,
                              recorded_at: device.created_at,
                          }
                        : null
                }
                locale={locale}
                translations={t}
                date={date}
                loading={locationLoading}
                deviceId={deviceId}
                getLatestLocation={async () => refreshLive()}
            />

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
