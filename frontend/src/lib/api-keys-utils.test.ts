import { describe, expect, it } from 'vitest';
import { en } from '@/i18n';
import {
    getApiKeyTableColumns,
    isApiKeySortKey,
    truncateId,
} from './api-keys-utils';

describe('getApiKeyTableColumns', () => {
    it('returns the API key columns in display order', () => {
        const columns = getApiKeyTableColumns(en.apiKeys.table);

        expect(columns.map(column => column.key)).toEqual([
            'device',
            'keyId',
            'created',
            'lastUsed',
            'expires',
            'actions',
        ]);
    });

    it('uses the table translations and right-aligns actions', () => {
        const columns = getApiKeyTableColumns(en.apiKeys.table);

        expect(columns.map(column => column.label)).toEqual([
            en.apiKeys.table.device,
            en.apiKeys.table.keyId,
            en.apiKeys.table.created,
            en.apiKeys.table.lastUsed,
            en.apiKeys.table.expires,
            en.apiKeys.table.actions,
        ]);
        expect(columns.at(-1)?.align).toBe('right');
        expect(columns.slice(0, -1).every(column => !column.align)).toBe(true);
    });
});

describe('truncateId', () => {
    it('keeps IDs with eight or fewer characters unchanged', () => {
        expect(truncateId('')).toBe('');
        expect(truncateId('12345678')).toBe('12345678');
    });

    it('keeps the first eight characters and adds an ellipsis to longer IDs', () => {
        expect(truncateId('1234567890')).toBe('12345678…');
    });
});

describe('isApiKeySortKey', () => {
    it('accepts every supported sort key', () => {
        expect(isApiKeySortKey('created-desc')).toBe(true);
        expect(isApiKeySortKey('created-asc')).toBe(true);
        expect(isApiKeySortKey('device-asc')).toBe(true);
    });

    it('rejects unsupported values', () => {
        expect(isApiKeySortKey('name-asc')).toBe(false);
        expect(isApiKeySortKey('')).toBe(false);
    });
});
