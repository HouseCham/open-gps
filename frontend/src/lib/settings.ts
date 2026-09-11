//-- Types
import type { Settings } from "@/types";
//-- Constants
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/constants";

/**
 * Reads the user's settings preferences from local storage.
 * If no preferences are found, it returns the default settings.
 * @returns {Settings} The user's settings preferences or the default settings.
 */
export function readSettingsPreferences(): Settings {
    try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (error) {
        console.warn('Unable to read saved settings from local storage.', error);
        return DEFAULT_SETTINGS;
    }
}