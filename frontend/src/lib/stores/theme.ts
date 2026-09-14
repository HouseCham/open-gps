import { atom } from 'nanostores';
/**
 * Supported themes.
 * @type {('light' | 'dark')}
 */
export type Theme = 'light' | 'dark';
/**
 * @constant THEME_STORAGE_KEY
 * @description The key used to store the theme in localStorage.
 */
export const THEME_STORAGE_KEY = 'open-gps:theme';

const ATTR = 'data-theme';
/**
 * Reads the initial theme from the document or defaults to 'light'.
 * @returns {Theme} The initial theme.
 */
function readInitialTheme(): Theme {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute(ATTR) === 'dark'
        ? 'dark'
        : 'light';
}

/** Shared theme state for all hydrated islands. */
export const $theme = atom<Theme>(readInitialTheme());

/**
 * Writes the theme to the document and localStorage.
 * @param {Theme} theme The theme to set.
 * @returns {void}
 */
export function setTheme(theme: Theme): void {
    $theme.set(theme);
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute(ATTR, theme);
    }
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // ponytail: storage may be unavailable; the in-memory theme still works.
    }
}
/**
 * Toggles the theme between 'light' and 'dark'.
 * @returns {void}
 */
export function toggleTheme(): void {
    setTheme($theme.get() === 'dark' ? 'light' : 'dark');
}
