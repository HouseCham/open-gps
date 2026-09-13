import type { DeviceVehicleType } from '@/types/api';
import type { Period } from '@/types/reports';

/** Predefined periods available in the report filter. */
export const REPORT_PERIODS: readonly Period[] = [
    'lastHour',
    'lastSixHours',
    'lastDay',
    'lastWeek',
    'custom',
];

/** Vehicle types supported by the report filter. */
export const REPORT_VEHICLE_TYPES: readonly DeviceVehicleType[] = [
    'bicycle',
    'motorcycle',
    'car',
    'truck',
    'van',
    'other',
];

/** Time zone sent with report requests. */
export const REPORT_TIME_ZONE =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Duration, in hours, for each predefined report period. */
export const REPORT_PERIOD_HOURS: Record<Exclude<Period, 'custom'>, number> = {
    lastHour: 1,
    lastSixHours: 6,
    lastDay: 24,
    lastWeek: 168,
};
