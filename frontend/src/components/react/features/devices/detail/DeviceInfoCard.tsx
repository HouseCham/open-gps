//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types/i18n';
import type { DeviceDetail } from '@/types/api';
import type { JSX } from 'react/jsx-runtime';
import type { ReactNode } from 'react';
//-- Components
import { CopyButton } from '@/components/react/ui/button';
import { VehicleTag } from './VehicleTag';
import { RolePill } from '@/components/react/RolePill';
//-- Utils
import { formatRelativeTime } from '@/lib';
import { getVehicleLabel } from '@/lib/features';

/**
 * Props for the DeviceInfoCard component
 * @interface DeviceInfoCardProps
 * @prop {DeviceDetail} device - Device details.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 */
interface DeviceInfoCardProps {
    device: DeviceDetail;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
}
/**
 * Card component for showing device information
 * @param {DeviceInfoCardProps} props - Props for the component.
 * @returns {JSX.Element} The JSX element for the component.
 */
export function DeviceInfoCard({
    device,
    locale,
    translations,
    date,
}: DeviceInfoCardProps): JSX.Element {
    const t = translations.detail;
    const rows: Array<{
        label: string;
        value: string;
        copy?: string;
        content?: ReactNode;
    }> = [
        {
            label: t.info.firmwareUuid,
            value: device.uuid_firmware,
            copy: device.uuid_firmware,
        },
        { label: t.info.deviceId, value: `#${device.id}`, copy: device.id },
        {
            label: t.info.vehicleType,
            value: getVehicleLabel(device.vehicle_type, translations),
            content: (
                <VehicleTag
                    type={device.vehicle_type}
                    translations={translations}
                />
            ),
        },
        {
            label: t.info.yourRole,
            value: translations.roles[device.access_role],
            content: (
                <RolePill
                    role={device.access_role}
                    translations={translations}
                />
            ),
        },
        {
            label: t.info.created,
            value: formatRelativeTime(device.created_at, locale, date),
        },
        {
            label: t.info.lastSeen,
            value: formatRelativeTime(device.last_contact_at, locale, date),
        },
    ];

    return (
        <div className="dd-card">
            <div className="dd-card-head">
                <div>
                    <h3>{t.info.title}</h3>
                    <div className="dd-card-sub">{t.info.subtitle}</div>
                </div>
            </div>
            <div className="dd-card-body">
                <div className="dd-info-list">
                    {rows.map(row => (
                        <div className="dd-info-row" key={row.label}>
                            <span className="dd-info-label">{row.label}</span>
                            <span
                                className={`dd-info-value${row.content ? ' is-text' : ''}`}
                            >
                                {row.content ?? row.value}
                            </span>
                            {row.copy ? (
                                <CopyButton
                                    value={row.copy}
                                    label={t.copy}
                                    copiedLabel={t.copied}
                                />
                            ) : (
                                <span className="dd-info-spacer" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
