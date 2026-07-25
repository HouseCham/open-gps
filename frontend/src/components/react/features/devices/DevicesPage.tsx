import '@/styles/devices.css';
import { useEffect, useState, type JSX, lazy, Suspense } from 'react';
//-- Types
import type { DeviceVehicleType, DeviceWithAccess } from '@/types/api';
import type { Translation } from '@/i18n';
import {
    type DeviceAccessRole,
    type DeviceSortKey,
    type DeviceStatusKey,
    type DeviceStatusFilter,
    type DeviceVehicleFilter,
} from '@/constants/device';
import type { Language } from '@/types';
//-- Constants
import {
    DEVICE_SORT_OPTIONS,
    DEVICE_VEHICLE_FILTER_ALL,
    VEHICLE_TYPE_OPTIONS,
} from '@/constants/device';
//-- Icons
import { AlertTriangle, List as ListIcon, Plus, Satellite } from 'lucide-react';
//-- Components
import { Button } from '@/components/react/ui/button';
import { EmptyState } from '@/components/react/ui/EmptyState';
import { DeviceFilterBar } from './DeviceFilterBar';
import { DevicesTable } from './DevicesTable';
//-- Services
import { useDeviceService } from '@/lib/api/services/deviceService';
//-- Utils
import { deriveDeviceStatus } from '@/lib/device-utils';
import { interpolateTemplate } from '@/lib';
//-- Lazy components
const AddDeviceModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.AddDeviceModal,
    }))
);
const DeleteDeviceModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.DeleteDeviceModal,
    }))
);
const EditDeviceModal = lazy(() =>
    import('@/components/react/modal').then(m => ({
        default: m.EditDeviceModal,
    }))
);

/**
 * Props for the DevicesPage component.
 * @interface DevicesPageProps
 * @prop {Language} locale - The locale for the page.
 * @prop {Translation['device']} translations - The translations for the page.
 * @prop {string} pageLabel - The label for the page.
 */
interface DevicesPageProps {
    locale: Language;
    translations: Translation['device'];
    pageLabel: string;
}
/**
 * The DevicesPage component.
 * @param {DevicesPageProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function DevicesPage({
    locale,
    translations: t,
    pageLabel,
}: DevicesPageProps): JSX.Element {
    const {
        devices,
        isLoading,
        error,
        getAllDevices,
        createDevice,
        updateDevice,
        deleteDevice,
    } = useDeviceService();

    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>('all');
    const [vehicleFilter, setVehicleFilter] = useState<DeviceVehicleFilter>(
        DEVICE_VEHICLE_FILTER_ALL
    );
    const [sortBy, setSortBy] = useState<DeviceSortKey>('name-asc');

    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<DeviceWithAccess | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeviceWithAccess | null>(
        null
    );

    useEffect(() => {
        void getAllDevices();
    }, []);

    /**
     * Options for the status dropdown.
     * @type {Record<string, string>}
     */
    const statusOptions: Record<string, string> = {
        all: t.table.filter.allStatuses,
        online: t.online,
        stale: t.stale,
        offline: t.offline,
        'never-seen': t.neverSeen,
    };
    /**
     * Options for the vehicle type dropdown.
     * @type {{ value: DeviceVehicleFilter; label: string }[]}
     */
    const vehicleOptions: { value: DeviceVehicleFilter; label: string }[] = [
        { value: DEVICE_VEHICLE_FILTER_ALL, label: t.table.filter.allVehicles },
        ...VEHICLE_TYPE_OPTIONS.map(v => ({
            value: v,
            label: t.table.vehicleTypes[v],
        })),
    ];
    /**
     * Options for the sort key dropdown.
     * @type {{ value: DeviceSortKey; label: string }[]}
     */
    const sortOptions = DEVICE_SORT_OPTIONS.map(k => ({
        value: k,
        label: t.table.sort[k],
    }));
    /**
     * Filter the devices based on the query, status filter, vehicle filter, and sort key.
     * @returns {DeviceWithAccess[]} The filtered devices.
     */
    const filtered: DeviceWithAccess[] = ((): DeviceWithAccess[] => {
        const q = query.trim().toLowerCase();
        let list = devices.filter(d => {
            if (
                q &&
                !`${d.name} ${d.uuid_firmware} ${d.id} ${t.table.vehicleTypes[d.vehicle_type]}`
                    .toLowerCase()
                    .includes(q)
            ) {
                return false;
            }
            if (
                vehicleFilter !== DEVICE_VEHICLE_FILTER_ALL &&
                d.vehicle_type !== vehicleFilter
            ) {
                return false;
            }
            if (statusFilter !== 'all') {
                const s = deriveDeviceStatus(d.last_seen_at, t).key;
                if (s !== statusFilter) return false;
            }
            return true;
        });
        list = [...list].sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'recent':
                    return (
                        new Date(b.last_seen_at ?? 0).getTime() -
                        new Date(a.last_seen_at ?? 0).getTime()
                    );
                case 'oldest':
                    return (
                        new Date(a.last_seen_at ?? 0).getTime() -
                        new Date(b.last_seen_at ?? 0).getTime()
                    );
                default:
                    return 0;
            }
        });
        return list;
    })();

    /**
     * Count the number of devices in each status.
     * @returns {Record<DeviceStatusKey | 'total', number>} The counts.
     */
    const counts: Record<DeviceStatusKey | 'total', number> = {
        online: 0,
        stale: 0,
        offline: 0,
        'never-seen': 0,
        total: devices.length,
    };

    for (const d of devices) {
        counts[deriveDeviceStatus(d.last_seen_at, t).key]++;
    }
    /**
     * Handle the creation of a new device.
     * @param {object} data - The data for the new device.
     * @returns {Promise<void>} A promise that resolves when the device is created.
     */
    const handleCreate = async (data: {
        name: string;
        uuid_firmware: string;
        vehicle_type: DeviceVehicleType;
        access_role: DeviceAccessRole;
    }): Promise<void> => {
        await createDevice({
            name: data.name,
            uuid_firmware: data.uuid_firmware,
            vehicle_type: data.vehicle_type,
        });
        setAddOpen(false);
    };

    /**
     * Handle the editing of a device.
     * @param {string} id - The ID of the device to edit.
     * @param {object} data - The data for the edited device.
     * @returns {Promise<void>} A promise that resolves when the device is edited.
     */
    const handleSave = async (
        id: string,
        data: {
            name: string;
            vehicle_type: DeviceVehicleType;
            access_role: DeviceAccessRole;
        }
    ): Promise<void> => {
        await updateDevice(id, {
            name: data.name,
            vehicle_type: data.vehicle_type,
        });
        setEditTarget(null);
    };
    /**
     * Handle the deletion of a device.
     * @returns {Promise<void>} A promise that resolves when the device is deleted.
     */
    const handleDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        await deleteDevice(deleteTarget.id);
        setDeleteTarget(null);
    };

    return (
        <>
            <header className="dev-page-header">
                <div>
                    <h1>{pageLabel}</h1>
                    <div className="dev-page-header-sub">
                        {interpolateTemplate(t.page.summary, {
                            total: counts.total,
                            online: counts.online,
                            stale: counts.stale,
                            offline: counts.offline,
                            never: counts['never-seen'],
                        })}
                    </div>
                </div>
                <div className="dev-page-header-actions">
                    <Button
                        variant="secondary"
                        icon={<ListIcon size={14} strokeWidth={1.6} />}
                    >
                        {t.page.export}
                    </Button>
                    <Button
                        variant="primary"
                        icon={<Plus size={14} strokeWidth={1.6} />}
                        onClick={() => setAddOpen(true)}
                    >
                        {t.table.addDevice}
                    </Button>
                </div>
            </header>
            {/* Filter bar */}
            <DeviceFilterBar
                t={t}
                query={query}
                onQuery={setQuery}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                statusOptions={statusOptions}
                vehicleFilter={vehicleFilter}
                onVehicleFilter={setVehicleFilter}
                vehicleOptions={vehicleOptions}
                sortBy={sortBy}
                onSortBy={setSortBy}
                sortOptions={sortOptions}
                onRefresh={() => void getAllDevices()}
            />

            {error && (
                <div className="dev-error" role="alert">
                    <AlertTriangle size={14} strokeWidth={1.6} />
                    {error.message}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void getAllDevices()}
                    >
                        {t.table.retry}
                    </Button>
                </div>
            )}

            {devices.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<Satellite size={28} strokeWidth={1.6} />}
                    title={t.title}
                    message={t.table.failedToLoad}
                    action={
                        <Button
                            variant="primary"
                            icon={<Plus size={14} strokeWidth={1.6} />}
                            onClick={() => setAddOpen(true)}
                        >
                            {t.page.addFirstDevice}
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
                        variant="secondary"
                        onClick={() => {
                            setQuery('');
                            setStatusFilter('all');
                            setVehicleFilter(DEVICE_VEHICLE_FILTER_ALL);
                        }}
                    >
                        {t.page.clearFilters}
                    </Button>
                </div>
            ) : (
                <DevicesTable
                    t={t}
                    devices={filtered}
                    locale={locale}
                    onEdit={setEditTarget}
                    onDelete={setDeleteTarget}
                />
            )}

            <Suspense fallback={null}>
                <AddDeviceModal
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    onCreate={handleCreate}
                    t={t}
                />
            </Suspense>

            <Suspense fallback={null}>
                <EditDeviceModal
                    open={editTarget !== null}
                    device={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSave={handleSave}
                    t={t}
                />
            </Suspense>

            <Suspense fallback={null}>
                <DeleteDeviceModal
                    open={deleteTarget !== null}
                    device={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                    t={t}
                />
            </Suspense>
        </>
    );
}
