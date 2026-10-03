//-- Types
import type { JSX, MouseEvent } from 'react';
import type { DeviceWithAccess } from '@/types/api';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
//-- Utils
import { deriveDeviceStatus, formatRelativeTime } from '@/lib';
import { redirectTo } from '@/lib/router-utils';
//-- Components
import { CopyButton, IconButton } from '@/components/react/ui/button';
import { VehicleIcon } from './VehicleIcon';

/**
 * Props for the DevicesTable component.
 * @interface DevicesTableProps
 * @prop {Translation['device']} t - Translation strings.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {DeviceWithAccess[]} devices - List of devices.
 * @prop {Language} locale - Locale.
 * @prop {(d: DeviceWithAccess) => void} onEdit - Callback for editing a device.
 * @prop {(d: DeviceWithAccess) => void} onDelete - Callback for deleting a device.
 */
interface DevicesTableProps {
    t: Translation['device'];
    date: Translation['date'];
    devices: DeviceWithAccess[];
    locale: Language;
    onEdit: (d: DeviceWithAccess) => void;
    onDelete: (d: DeviceWithAccess) => void;
}
/**
 * The DevicesTable component.
 * @param {DevicesTableProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function DevicesTable({
    t,
    date,
    devices,
    locale,
    onEdit,
    onDelete,
}: DevicesTableProps): JSX.Element {
    const vehicleLabels = t.table.vehicleTypes;
    const roleLabels = t.roles;

    /**
     * Handle an action on a device row.
     * @param {MouseEvent<HTMLButtonElement>} e - The click event.
     * @returns {void}
     */
    const handleAction = (e: MouseEvent<HTMLButtonElement>): void => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        if (!id) return;
        const row = devices.find(d => d.id === id);
        if (!row) return;
        if (action === 'delete') onDelete(row);
        else onEdit(row);
    };

    /**
     * Navigate to a device's detail page from a row link.
     * @param {MouseEvent<HTMLElement>} e - The click event.
     * @returns {void}
     */
    const handleNavigate = (e: MouseEvent<HTMLElement>): void => {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        redirectTo(`/devices/detail?id=${id}`);
    };
    return (
        <div className="dev-table-wrap">
            <table className="dev-table">
                <thead>
                    <tr>
                        <th>{t.table.name}</th>
                        <th className="col-firmware">{t.table.firmwareUuid}</th>
                        <th>{t.table.vehicleType}</th>
                        <th>{t.table.status}</th>
                        <th>{t.table.lastSeen}</th>
                        <th
                            className="col-actions"
                            aria-label={t.table.actions}
                        >
                            {t.table.actions}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {devices.map(d => {
                        const status = deriveDeviceStatus(d.last_contact_at, t);
                        return (
                            <tr key={d.id}>
                                {/* Device name and ID */}
                                <td>
                                    <div className="dev-cell-device">
                                        <span
                                            className={`dev-cell-icon dev-cell-icon-${d.vehicle_type}`}
                                        >
                                            <VehicleIcon
                                                type={d.vehicle_type}
                                            />
                                        </span>
                                        <div className="dev-cell-device-text">
                                            <div
                                                className="dev-cell-name dev-cell-clickable"
                                                role="button"
                                                tabIndex={0}
                                                data-id={d.id}
                                                onClick={handleNavigate}
                                            >
                                                {d.name}
                                            </div>
                                            <div className="dev-cell-id">
                                                {roleLabels[d.access_role]}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                {/* UUID */}
                                <td className="col-firmware">
                                    <div className="col-firmware-wrap">
                                        <code className="dev-firmware">
                                            {d.uuid_firmware}
                                        </code>
                                        <CopyButton
                                            value={d.uuid_firmware}
                                            label={t.table.copy}
                                            copiedLabel={t.table.copied}
                                        />
                                    </div>
                                </td>
                                {/* Vehicle type */}
                                <td>
                                    <span className="dev-vehicle-tag">
                                        {vehicleLabels[d.vehicle_type]}
                                    </span>
                                </td>
                                {/* Status */}
                                <td>
                                    <span
                                        className={`dev-status dev-status-${status.dot}`}
                                    >
                                        <span className="dev-status-dot" />
                                        {status.label}
                                    </span>
                                </td>
                                {/* Last seen */}
                                <td
                                    className={`dev-cell-time${d.last_contact_at ? '' : ' never'}`}
                                >
                                    {formatRelativeTime(
                                        d.last_contact_at,
                                        locale,
                                        date
                                    )}
                                </td>
                                {/* Actions */}
                                <td className="col-actions">
                                    <div className="dev-row-actions">
                                        {/* Edit Button */}
                                        <IconButton
                                            dataID={d.id}
                                            danger={false}
                                            ariaLabel={`${t.table.edit} ${d.name}`}
                                            title={t.table.edit}
                                            handleAction={handleAction}
                                        />
                                        {/* Delete Button */}
                                        <IconButton
                                            danger
                                            dataID={d.id}
                                            ariaLabel={`${t.table.delete} ${d.name}`}
                                            title={t.table.delete}
                                            handleAction={handleAction}
                                        />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
