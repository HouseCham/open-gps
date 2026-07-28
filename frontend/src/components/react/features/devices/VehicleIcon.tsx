//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { DeviceVehicleType } from '@/types/api';
//-- Constants
import { VEHICLE_ICON_MAP } from '@/constants';
//-- Icons
import { Package, type LucideProps } from 'lucide-react';

/**
 * Props for the VehicleIcon component.
 * @interface VehicleIconProps
 * @prop {DeviceVehicleType} type - Vehicle type.
 * @prop {number} size - Icon size.
 */
interface VehicleIconProps {
    type: DeviceVehicleType;
    size?: number;
}
/**
 * Vehicle icon component.
 * @param {VehicleIconProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function VehicleIcon({
    type,
    size = 16,
}: VehicleIconProps): JSX.Element {
    const Cmp = VEHICLE_ICON_MAP[type] ?? Package;
    const strokeProps: LucideProps = { strokeWidth: 1.6 };
    return <Cmp size={size} {...strokeProps} aria-hidden="true" />;
}
