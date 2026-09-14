import { beforeEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_SETTINGS,
    SETTINGS_STORAGE_KEY,
    readSettingsPreferences,
    saveSettingsPreferences,
} from './settings';

beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1280;
});

describe('settings preferences', () => {
    it('returns browser-aware defaults when storage is empty', () => {
        expect(readSettingsPreferences()).toEqual(DEFAULT_SETTINGS);
        expect(DEFAULT_SETTINGS.sidebarInitialState).toBe('expanded');
        expect(DEFAULT_SETTINGS.defaultHistoryRange).toBe('24h');
    });

    it('accepts valid values and ignores unknown properties', () => {
        localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify({
                sidebarInitialState: 'collapsed',
                defaultHistoryRange: '7d',
                unknown: 'ignored',
            })
        );

        expect(readSettingsPreferences()).toMatchObject({
            sidebarInitialState: 'collapsed',
            defaultHistoryRange: '7d',
        });
        expect(readSettingsPreferences()).not.toHaveProperty('unknown');
    });

    it('sanitizes corrupt JSON and invalid values before persisting', () => {
        localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify({
                timeZone: 'Not/AZone',
                timeFormat: 'invalid',
                reduceMotion: 'yes',
            })
        );

        const settings = readSettingsPreferences();
        expect(settings.timeZone).toBe(DEFAULT_SETTINGS.timeZone);
        expect(settings.timeFormat).toBe(DEFAULT_SETTINGS.timeFormat);
        expect(settings.reduceMotion).toBe(DEFAULT_SETTINGS.reduceMotion);
        expect(
            JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
        ).toEqual(settings);
    });

    it('falls back to in-memory defaults when storage contains malformed JSON', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEY, '{not-json');

        expect(readSettingsPreferences()).toEqual(DEFAULT_SETTINGS);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(
            JSON.stringify(DEFAULT_SETTINGS)
        );
    });

    it('uses a collapsed sidebar default on mobile', () => {
        window.innerWidth = 640;

        expect(readSettingsPreferences().sidebarInitialState).toBe('collapsed');
    });

    it('persists a supplied settings object', () => {
        saveSettingsPreferences(DEFAULT_SETTINGS);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(
            JSON.stringify(DEFAULT_SETTINGS)
        );
        expect(readSettingsPreferences()).toEqual(DEFAULT_SETTINGS);
    });
});
