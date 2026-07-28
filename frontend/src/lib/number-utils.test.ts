import { describe, expect, it } from 'vitest';
import { clampValue, renderNumberWithUnit } from './number-utils';

describe('renderNumberWithUnit', () => {
    it('renders an integer value with its unit and a single space', () => {
        expect(renderNumberWithUnit(12, 'km/h')).toBe('12 km/h');
    });

    it('renders a fractional value with the requested digit count', () => {
        expect(renderNumberWithUnit(1.23456, 'km/h', 2)).toBe('1.23 km/h');
    });

    it('pads with trailing zeros up to the digit count', () => {
        expect(renderNumberWithUnit(1, 'V', 2)).toBe('1.00 V');
    });

    it('returns the em-dash placeholder for null', () => {
        expect(renderNumberWithUnit(null, 'V')).toBe('—');
    });

    it('returns the em-dash placeholder for undefined', () => {
        expect(renderNumberWithUnit(undefined, 'V')).toBe('—');
    });

    it('defaults to zero fraction digits', () => {
        expect(renderNumberWithUnit(3.9, 'm')).toBe('4 m');
    });

    it('handles negative values', () => {
        expect(renderNumberWithUnit(-7.4, 'm/s', 1)).toBe('-7.4 m/s');
    });
});

describe('clampValue', () => {
    it('returns the value when already inside the range', () => {
        expect(clampValue(5, 0, 10)).toBe(5);
    });

    it('clamps to the minimum when below the range', () => {
        expect(clampValue(-3, 0, 10)).toBe(0);
    });

    it('clamps to the maximum when above the range', () => {
        expect(clampValue(99, 0, 10)).toBe(10);
    });

    it('returns the bound itself when the value matches', () => {
        expect(clampValue(0, 0, 10)).toBe(0);
        expect(clampValue(10, 0, 10)).toBe(10);
    });

    it('clamps to the smaller bound when the range is inverted', () => {
        // ponytail: implementation does not validate that min <= max;
        // for inverted ranges it returns Math.min(max, Math.max(min, value)).
        expect(clampValue(5, 10, 0)).toBe(0);
    });

    it('preserves fractional precision', () => {
        expect(clampValue(2.5, 0, 1)).toBe(1);
        expect(clampValue(0.25, 0, 1)).toBe(0.25);
    });
});
