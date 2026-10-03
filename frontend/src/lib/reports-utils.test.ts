import { describe, expect, it } from 'vitest';

import {
    createReportSectionState,
    formatDateTimeInput,
    formatReportDate,
    formatReportDateForApi,
    formatReportMetric,
    formatReportNumber,
    getInitialReportRange,
    isReportPeriod,
    isReportVehicleType,
    padDatePart,
} from './reports-utils';

describe('report type guards', () => {
    it('accepts supported periods and rejects unknown values', () => {
        expect(isReportPeriod('lastSixHours')).toBe(true);
        expect(isReportPeriod('unknown')).toBe(false);
    });

    it('accepts supported vehicle types and rejects unknown values', () => {
        expect(isReportVehicleType('motorcycle')).toBe(true);
        expect(isReportVehicleType('spaceship')).toBe(false);
    });
});

describe('report date utilities', () => {
    it('pads date parts to two characters', () => {
        expect(padDatePart(3)).toBe('03');
        expect(padDatePart(12)).toBe('12');
    });

    it('formats a date for datetime-local inputs', () => {
        expect(formatDateTimeInput(new Date(2026, 0, 5, 9, 7))).toBe(
            '2026-01-05T09:07'
        );
    });

    it('adds seconds to datetime-local values for API requests', () => {
        expect(formatReportDateForApi('2026-01-05T09:07')).toBe(
            '2026-01-05T09:07:00'
        );
        expect(formatReportDateForApi('2026-01-05T09:07:30')).toBe(
            '2026-01-05T09:07:30'
        );
    });

    it('creates an ordered six-hour initial range', () => {
        const range = getInitialReportRange();
        expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(new Date(range.from).getTime()).toBeLessThan(
            new Date(range.to).getTime()
        );
    });

    it('formats timestamps and preserves the missing-value placeholder', () => {
        expect(formatReportDate(null)).toBe('—');
        expect(formatReportDate('2026-01-05T09:07:00Z')).toMatch(/2026/);
    });
});

describe('report display utilities', () => {
    it('formats numbers and nullable metrics', () => {
        expect(formatReportNumber(12.345, 2)).toBe('12.35');
        expect(formatReportMetric(12.345, 'km', 2)).toBe('12.35 km');
        expect(formatReportMetric(null, 'km')).toBe('—');
    });

    it('creates an empty loading section state', () => {
        expect(createReportSectionState()).toEqual({
            data: null,
            loading: true,
            error: null,
        });
    });
});
