import { describe, expect, it } from 'vitest';
import { maskEmail } from './email-utils';

describe('maskEmail', () => {
    it('keeps the first two local-part characters and masks the rest', () => {
        expect(maskEmail('alex@open-gps.local')).toBe('al•••@open-gps.local');
    });

    it('masks short local parts without changing the domain', () => {
        expect(maskEmail('a@example.com')).toBe('a•••@example.com');
        expect(maskEmail('ab@example.com')).toBe('ab•••@example.com');
    });

    it('returns malformed addresses without a usable local part unchanged', () => {
        expect(maskEmail('')).toBe('');
        expect(maskEmail('@example.com')).toBe('@example.com');
        expect(maskEmail('not-an-email')).toBe('not-an-email');
    });

    it('preserves subdomains and additional at-signs in the domain suffix', () => {
        expect(maskEmail('driver@fleet.eu.example.com')).toBe(
            'dr•••@fleet.eu.example.com'
        );
        expect(maskEmail('driver@domain@example.com')).toBe(
            'dr•••@domain@example.com'
        );
    });
});
