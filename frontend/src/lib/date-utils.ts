import { DATE_FORMAT_MONTHS } from '@/constants/date';
import type { Translation } from '@/i18n/en';
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
