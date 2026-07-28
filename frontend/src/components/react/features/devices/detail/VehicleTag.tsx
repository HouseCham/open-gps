//-- Types
import type { Translation } from '@/i18n';
import type { DeviceVehicleType } from '@/types/api';
import type { JSX } from 'react/jsx-runtime';
//-- Utils
import { getVehicleLabel } from '@/lib/features';
//-- Components
import { VehicleIcon } from '@/components/react/features/devices';

/**
 * Returns the label for the vehicle type.
 * @interface VehicleTagProps
 * @param {DeviceVehicleType} type - The vehicle type.
 * @param {Translation['device']} translations - The translations object.
 */
interface VehicleTagProps {
    type: DeviceVehicleType;
    translations: Translation['device'];
}
/**
 * The VehicleTag component
 * @prop {VehicleTagProps} type - The vehicle type
 * @returns {JSX.Element} The VehicleTag component
 */
export function VehicleTag({
    type,
    translations,
}: VehicleTagProps): JSX.Element {
    return (
        <span className="dd-vehicle-tag">
            <VehicleIcon type={type} size={13} />
            {getVehicleLabel(type, translations)}
        </span>
    );
}
