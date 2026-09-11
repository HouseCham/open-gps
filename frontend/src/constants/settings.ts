import type { Settings } from "@/types";

/**
 * @constant SETTINGS_STORAGE_KEY
 * @description Key used for storing settings in local storage
 * @type {string}
 */
export const SETTINGS_STORAGE_KEY = 'open-gps:settings';
/**
 * @constant DEFAULT_SETTINGS
 * @description Default settings for the app
 * @type {Settings}
 */
export const DEFAULT_SETTINGS: Settings = {
    history: '6h',
    landing: 'devices',
    density: 'comfortable',
    timezone: 'America/Mexico_City',
    units: 'metric',
    hours: '24',
    sidebar: 'open',
    motion: false,
};