import type { Translation } from '@/i18n';
import type { DeviceVehicleType } from '@/types/api';

/**
 * Returns the tone for the vehicle battery metric.
 * @param {number | null} percent - The battery percentage.
 * @returns {string} The tone for the battery metric.
 */
export function getVehicleBatteryMetricTone(
    percent: number | null
): 'ok' | 'warn' | 'bad' | '' {
    if (percent == null) return '';
    if (percent < 20) return 'bad';
    if (percent < 50) return 'warn';
    return 'ok';
}
/**
 * Returns the label for the vehicle type.
 * @param {DeviceVehicleType} type - The vehicle type.
 * @param {Translation['device']} translations - The translations object.
 * @returns {string} The label for the vehicle type.
 */
export function getVehicleLabel(
    type: DeviceVehicleType,
    translations: Translation['device']
): string {
    return translations.table.vehicleTypes[type];
}
