import type { ChangeEvent, JSX } from 'react';

import { VEHICLE_TYPE_OPTIONS } from '@/constants';
import { Select } from '@/components/react/form/ui';
import type { DeviceVehicleType } from '@/types/api';

/**
 * Props for the VehicleTypeSelect component.
 * @interface VehicleTypeSelectProps
 * @prop {DeviceVehicleType} value - Currently selected vehicle type.
 * @prop {(next: DeviceVehicleType) => void} onChange - Fires with a valid value only.
 * @prop {Record<DeviceVehicleType, string>} labels - Localized labels per option.
 */
interface VehicleTypeSelectProps {
    value: DeviceVehicleType;
    onChange: (next: DeviceVehicleType) => void;
    labels: Record<DeviceVehicleType, string>;
}

/**
 * Native select bound to VEHICLE_TYPE_OPTIONS. Forwards only validated values
 * to `onChange`, so callers don't need to null-guard the option lookup.
 * @param {VehicleTypeSelectProps} props
 * @returns {JSX.Element}
 */
export function VehicleTypeSelect({
    value,
    onChange,
    labels,
}: VehicleTypeSelectProps): JSX.Element {
    return (
        <Select
            options={VEHICLE_TYPE_OPTIONS.map(v => ({
                value: v,
                label: labels[v],
            }))}
            value={value}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const next = VEHICLE_TYPE_OPTIONS.find(
                    option => option === e.target.value
                );
                if (!next) return;
                onChange(next);
            }}
        />
    );
}
