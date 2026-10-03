import type { LocalSettings } from '@/types';
import { MOBILE_BREAKPOINT } from '@/constants/layout';

/** Versioned storage key for browser-local preferences. */
export const SETTINGS_STORAGE_KEY = 'open-gps:settings:v1';

/** Returns the browser's IANA time zone or UTC when unavailable. */
export function getBrowserTimeZone(): string {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/** Returns whether an IANA time zone can be used by Intl. */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
    if (typeof timeZone !== 'string' || timeZone.length === 0) return false;
    try {
        new Intl.DateTimeFormat(undefined, { timeZone });
        return true;
    } catch {
        return false;
    }
}

/** Creates defaults using the current browser environment when available. */
export function getDefaultSettings(): LocalSettings {
    const isMobile =
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
        sidebarInitialState: isMobile ? 'collapsed' : 'expanded',
        reduceMotion: prefersReducedMotion,
        defaultHistoryRange: '24h',
        landingPage: 'dashboard',
        tableDensity: 'comfortable',
        timeZone: getBrowserTimeZone(),
        unitSystem: 'metric',
        timeFormat: '24h',
    };
}

/** Stable defaults for consumers that need a non-browser value. */
export const DEFAULT_SETTINGS: LocalSettings = getDefaultSettings();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Returns whether a string belongs to a supported settings union. */
export function isSettingValue<T extends string>(
    value: string,
    allowedValues: readonly T[]
): value is T {
    return allowedValues.some(allowedValue => allowedValue === value);
}

/** Validates and sanitizes untrusted localStorage data. */
export function sanitizeSettings(value: unknown): LocalSettings {
    const defaults = getDefaultSettings();
    if (!isRecord(value)) return defaults;

    return {
        sidebarInitialState:
            value.sidebarInitialState === 'collapsed' ||
            value.sidebarInitialState === 'expanded'
                ? value.sidebarInitialState
                : defaults.sidebarInitialState,
        reduceMotion:
            typeof value.reduceMotion === 'boolean'
                ? value.reduceMotion
                : defaults.reduceMotion,
        defaultHistoryRange:
            value.defaultHistoryRange === '1h' ||
            value.defaultHistoryRange === '6h' ||
            value.defaultHistoryRange === '24h' ||
            value.defaultHistoryRange === '7d'
                ? value.defaultHistoryRange
                : defaults.defaultHistoryRange,
        landingPage:
            value.landingPage === 'dashboard' || value.landingPage === 'devices'
                ? value.landingPage
                : defaults.landingPage,
        tableDensity:
            value.tableDensity === 'comfortable' ||
            value.tableDensity === 'compact'
                ? value.tableDensity
                : defaults.tableDensity,
        timeZone: isValidTimeZone(value.timeZone)
            ? value.timeZone
            : defaults.timeZone,
        unitSystem:
            value.unitSystem === 'metric' || value.unitSystem === 'imperial'
                ? value.unitSystem
                : defaults.unitSystem,
        timeFormat:
            value.timeFormat === '12h' || value.timeFormat === '24h'
                ? value.timeFormat
                : defaults.timeFormat,
    };
}

/** Saves settings without allowing storage failures to block the UI. */
export function saveSettingsPreferences(settings: LocalSettings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Browser storage can be unavailable in private mode or sandboxed contexts.
    }
}

/** Reads, validates, and repairs browser-local settings. */
export function readSettingsPreferences(): LocalSettings {
    const defaults = getDefaultSettings();
    if (typeof localStorage === 'undefined') return defaults;

    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw === null) return defaults;
        const sanitized = sanitizeSettings(JSON.parse(raw));
        if (JSON.stringify(sanitized) !== raw)
            saveSettingsPreferences(sanitized);
        return sanitized;
    } catch {
        saveSettingsPreferences(defaults);
        return defaults;
    }
}
