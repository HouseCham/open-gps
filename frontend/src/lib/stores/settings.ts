import { atom } from 'nanostores';
import type { LocalSettings } from '@/types';
import {
    getDefaultSettings,
    readSettingsPreferences,
    saveSettingsPreferences,
    sanitizeSettings,
} from '@/lib/settings';

/** Shared browser-local settings state for hydrated islands. */
export const $localSettings = atom<LocalSettings>(readSettingsPreferences());

/** Updates and immediately persists one local preference. */
export function updateLocalSetting<K extends keyof LocalSettings>(
    key: K,
    value: LocalSettings[K]
): void {
    const next = sanitizeSettings({ ...$localSettings.get(), [key]: value });
    $localSettings.set(next);
    saveSettingsPreferences(next);
}

/** Restores browser-local settings to environment-aware defaults. */
export function resetLocalSettings(): void {
    const reset = getDefaultSettings();
    $localSettings.set(reset);
    saveSettingsPreferences(reset);
}
