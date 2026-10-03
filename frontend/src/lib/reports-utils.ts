import type { DeviceVehicleType } from '@/types/api';
import type { Period, SectionState } from '@/types/reports';

/** Returns whether a value is a supported report period. */
export function isReportPeriod(value: string): value is Period {
    return (
        value === 'lastHour' ||
        value === 'lastSixHours' ||
        value === 'lastDay' ||
        value === 'lastWeek' ||
        value === 'custom'
    );
}

/** Returns whether a value is a supported vehicle type. */
export function isReportVehicleType(value: string): value is DeviceVehicleType {
    return (
        value === 'bicycle' ||
        value === 'motorcycle' ||
        value === 'car' ||
        value === 'truck' ||
        value === 'van' ||
        value === 'other'
    );
}

/** Converts a number to a two-character string for date inputs. */
export function padDatePart(value: number): string {
    return String(value).padStart(2, '0');
}

/** Formats a Date for a datetime-local input. */
export function formatDateTimeInput(date: Date): string {
    return [
        date.getFullYear(),
        '-',
        padDatePart(date.getMonth() + 1),
        '-',
        padDatePart(date.getDate()),
        'T',
        padDatePart(date.getHours()),
        ':',
        padDatePart(date.getMinutes()),
    ].join('');
}

/** Returns the default six-hour report range. */
export function getInitialReportRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 60 * 60 * 1000);
    return { from: formatDateTimeInput(from), to: formatDateTimeInput(to) };
}

/** Adds seconds when converting a datetime-local value to the API format. */
export function formatReportDateForApi(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
}

/** Formats a numeric value using the user's locale. */
export function formatReportNumber(value: number, digits = 1): string {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
    }).format(value);
}

/** Formats a nullable metric with its unit. */
export function formatReportMetric(
    value: number | null | undefined,
    unit: string,
    digits = 1
): string {
    return value == null ? '—' : `${formatReportNumber(value, digits)} ${unit}`;
}

/** Formats an optional ISO timestamp for display. */
export function formatReportDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString() : '—';
}

/** Creates the initial loading state for a report section. */
export function createReportSectionState<T>(): SectionState<T> {
    return { data: null, loading: true, error: null };
}
