import { describe, expect, it } from 'vitest';
import { en } from '@/i18n';
import { DATE_FORMAT_MONTHS } from '@/constants/date';
import { formatDate, formatRelativeTime } from './date-utils';

describe('formatDate', () => {
    it('formats an English date with the UTC day, month, and year', () => {
        expect(formatDate('en', '2026-01-05T00:00:00Z')).toBe('5 January 2026');
    });

    it('formats a Spanish date using the localized month name', () => {
        expect(formatDate('es', '2026-01-05T00:00:00Z')).toBe('5 Enero 2026');
    });

    it('switches month name with the locale but keeps the day/year identical', () => {
        const day = 14;
        const year = 2030;
        const input = `${year}-03-${String(day).padStart(2, '0')}T12:00:00Z`;
        expect(formatDate('en', input)).toBe(
            `${day} ${DATE_FORMAT_MONTHS.en[2]} ${year}`
        );
        expect(formatDate('es', input)).toBe(
            `${day} ${DATE_FORMAT_MONTHS.es[2]} ${year}`
        );
    });
});

describe('formatRelativeTime', () => {
    const now = Date.now();
    const date = en.date;

    it('returns the em-dash placeholder for null / undefined / invalid input', () => {
        expect(formatRelativeTime(null, 'en', date)).toBe('—');
        expect(formatRelativeTime(undefined, 'en', date)).toBe('—');
        expect(formatRelativeTime('not-a-date', 'en', date)).toBe('—');
    });

    it('reports timestamps less than a minute old as "just now"', () => {
        const iso = new Date(now - 30 * 1000).toISOString();
        expect(formatRelativeTime(iso, 'en', date)).toBe('just now');
    });

    it('rounds sub-hour ages to whole minutes', () => {
        const iso = new Date(now - 42 * 60 * 1000).toISOString();
        expect(formatRelativeTime(iso, 'en', date)).toBe('42m ago');
    });

    it('switches to "h ago" past the 1-hour mark', () => {
        const iso = new Date(now - 5 * 60 * 60 * 1000).toISOString();
        expect(formatRelativeTime(iso, 'en', date)).toBe('5h ago');
    });

    it('switches to "d ago" past the 1-day mark', () => {
        const iso = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelativeTime(iso, 'en', date)).toBe('3d ago');
    });

    it('uses the Spanish templates when given the es locale bundle', async () => {
        const es = (await import('@/i18n')).es.date;
        const iso = new Date(now - 42 * 60 * 1000).toISOString();
        expect(formatRelativeTime(iso, 'es', es)).toBe('hace 42m');
    });

    it('returns a localized absolute date once the age exceeds 30 days', () => {
        const iso = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
        const out = formatRelativeTime(iso, 'en', date);
        // The exact locale string depends on the runtime; we just want a
        // date-shaped string (digits + slashes), not the relative phrase.
        expect(out).not.toBe('—');
        expect(out).not.toMatch(/(ago|just now)/);
        expect(out).toMatch(/\d/);
    });
});

describe('en translations used by device-utils', () => {
    it('exposes a stale status label so deriveDeviceStatus can resolve it', () => {
        expect(typeof en.device.stale).toBe('string');
        expect(en.device.stale.length).toBeGreaterThan(0);
    });
});
