//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { DeviceDetail } from '@/types/api';
import type { DeviceStatus } from '@/types/components';
import type { Language } from '@/types';
import type { Translation } from '@/i18n';
//-- Components
import { StatusPill } from './StatusPill';
import { VehicleTag } from './VehicleTag';
import { Button } from '@/components/react/ui/button';
import { RolePill } from '@/components/react/RolePill';
//-- Icons
import {
    Activity,
    ArrowLeft,
    Clock3,
    Pencil,
    Shield,
    Trash2,
    Users,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib';
/**
 * Props for the VehicleDetailHeader component
 * @interface VehicleDetailHeaderProps
 * @prop {DeviceDetail} device - Device details.
 * @prop {DeviceStatus} status - Device status.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {() => void} onBack - Callback for the back button.
 * @prop {() => void | undefined} [onShare] - Callback for the share button.
 * @prop {() => void | undefined} [onEdit] - Callback for the edit button.
 * @prop {() => void | undefined} [onDelete] - Callback for the delete button.
 */
interface VehicleDetailHeaderProps {
    device: DeviceDetail;
    status: DeviceStatus;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
    onBack: () => void;
    onShare?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}
/**
 * VehicleDetailHeader component
 * @param {VehicleDetailHeaderProps} props - Props for the VehicleDetailHeader component.
 * @returns {JSX.Element} The rendered VehicleDetailHeader component.
 */
export function VehicleDetailHeader({
    device,
    status,
    locale,
    translations,
    date,
    onBack,
    onShare,
    onEdit,
    onDelete,
}: VehicleDetailHeaderProps): JSX.Element {
    const t = translations.detail;
    return (
        <header className="dd-header">
            <div className="dd-header-main">
                <div className="dd-title-row">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconOnly
                        onClick={onBack}
                        aria-label={t.backToDevices}
                        title={t.backToDevices}
                        icon={<ArrowLeft size={14} />}
                    />
                    <h1 className="dd-title">{device.name}</h1>
                    <StatusPill status={status} />
                    <VehicleTag
                        type={device.vehicle_type}
                        translations={translations}
                    />
                    <RolePill
                        role={device.access_role}
                        translations={translations}
                    />
                </div>
                <div className="dd-sub">
                    <span className="dd-sub-item">
                        <Activity size={12} />
                        {t.deviceId} {device.id}
                    </span>
                    <span className="dd-sub-item">
                        <Clock3 size={12} />
                        {t.lastPing}{' '}
                        {' - '}
                        {formatRelativeTime(device.last_seen_at, locale, date)}
                    </span>
                    <span className="dd-sub-item">
                        <Shield size={12} />
                        {t.uuidShort} {device.uuid_firmware.slice(0, 8)}…
                    </span>
                </div>
            </div>
            <div className="dd-actions">
                {
                    onShare && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Users size={14} />}
                            onClick={onShare}
                        >
                            {t.share}
                        </Button>        
                    )
                }
                {
                    onEdit && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Pencil size={14} />}
                            onClick={onEdit}
                        >
                            {t.edit}
                        </Button>
                    )
                }
                {
                    onDelete && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            icon={<Trash2 size={14} />}
                            onClick={onDelete}
                        >
                            {t.delete}
                        </Button>
                    )
                }
            </div>
        </header>
    );
}
