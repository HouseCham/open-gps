import { DATE_FORMAT_MONTHS } from '@/constants/date';
import type { Translation } from '@/i18n/en';
import type { DateRange } from '@/types';
import type { Language } from '@/types/i18n';

/**
 * Formats a date relative to the current time using locale-specific tokens.
 * Returns "—" for null/undefined/invalid input and a localized absolute
 * date string for inputs older than 30 days.
 * @param {string | null | undefined} iso - ISO date string.
 * @param {Language} locale - Locale used for the absolute fallback.
 * @param {Translation['date']} t - Date-related translation strings.
 * @returns {string} Relative or absolute date label.
 */
export function formatRelativeTime(
    iso: string | null | undefined,
    locale: Language,
    t: Translation['date']
): string {
    if (!iso) return '—';
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return '—';
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    const absolute = Math.abs(seconds);
    if (absolute < 60) return t.relative.justNow;
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60)
        return t.relative.minutesAgo.replace(
            '{count}',
            String(Math.abs(minutes))
        );
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24)
        return t.relative.hoursAgo.replace('{count}', String(Math.abs(hours)));
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30)
        return t.relative.daysAgo.replace('{count}', String(Math.abs(days)));
    return formatDate(locale, iso);
}
/**
 * Formats an absolute date as `"<day> <month-name> <year>"` using
 * locale-specific month names.
 * @param {Language} locale - Locale used to pick the month names.
 * @param {string | null | undefined} iso - ISO date string.
 * @returns {string} The formatted absolute date.
 */
export function formatDate(
    locale: Language,
    iso: string | null | undefined
): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const months = DATE_FORMAT_MONTHS[locale];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
}
/**
 * Formats a date and time
 * @param {string | null | undefined} iso - ISO date string.
 * @param {Language} locale - Locale.
 * @returns {string} Formatted date and time.
 */
export function formatDateTime(
    iso: string | null | undefined,
    locale: Language
): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * Returns a date range based on the given kind
 * @param {string} kind - The kind of the date range, can be 'today', '24h' or '7d'
 * @returns {DateRange}
 */
export function getDateRange(kind: 'today' | '24h' | '7d'): DateRange {
    const to = new Date();
    const from = new Date(to);
    if (kind === 'today') {
        from.setHours(0, 0, 0, 0);
    } else {
        from.setTime(
            to.getTime() - (kind === '24h' ? 24 : 24 * 7) * 60 * 60 * 1000
        );
    }
    return { from: toLocalInputValue(from), to: toLocalInputValue(to) };
}

/**
 * Converts an ISO date string to an API date string
 * @param {string} value - The ISO date string
 * @returns {string} The API date string
 */
export function toApiDate(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
}

/**
 * Converts a date to a local input value
 * @param {Date} date - The date
 * @returns {string} The local input value
 */
function toLocalInputValue(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Pads a number with leading zeros
 * @param {number} value - The number to pad
 * @returns {string} The padded number
 */
function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * Converts an ISO date string to a formatted date string
 * @param {string} iso - The ISO date string
 * @param {Language} locale - The locale
 * @returns {string} The formatted date string
 */
export function formatHistoryTime(iso: string, locale: Language): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(date);
}

/**
 * Formats a metric value
 * @param {number | null} value - The metric value
 * @param {string} unit - The metric unit
 * @param {number} decimals - The number of decimals
 * @returns {string} The formatted metric
 */
export function formatDateMetric(
    value: number | null,
    unit: string,
    decimals = 1
): string {
    return value == null ? '—' : `${value.toFixed(decimals)} ${unit}`;
}
