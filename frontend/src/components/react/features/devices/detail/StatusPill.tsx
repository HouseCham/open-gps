//-- Types
import type { DeviceStatus } from '@/types/components';
import type { JSX } from 'react/jsx-runtime';
//-- Constants
import { DEVICE_STATUS_KEYS } from '@/constants';
/**
 * Props for the StatusPill component
 * @interface StatusPillProps
 * @param {DeviceStatus} status - The device status
 */
interface StatusPillProps {
    status: DeviceStatus;
}
/**
 * StatusPill component
 * @prop {StatusPillProps} status - The device status
 * @returns {JSX.Element} The StatusPill component
 */
export function StatusPill({ status }: StatusPillProps): JSX.Element {
    const statusClass = DEVICE_STATUS_KEYS.includes(status.key)
        ? status.key
        : 'never-seen';
    return (
        <span className={`dd-status dd-status-${statusClass}`}>
            <span className="dd-status-dot" />
            {status.label}
        </span>
    );
}
