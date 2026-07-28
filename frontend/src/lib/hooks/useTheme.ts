import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'opengps-theme';
const ATTR = 'data-theme';

export type Theme = 'light' | 'dark';

/**
 * useTheme — reads/writes the `data-theme` attribute on `<html>` and persists
 * the choice to `localStorage`. Pairs with the inline pre-paint script in the
 * root layout to avoid FOUC on first paint.
 *
 * @returns A tuple of [currentTheme, setTheme, toggleTheme].
 */
export function useTheme(): readonly [
    Theme,
    (next: Theme) => void,
    () => void,
] {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof document === 'undefined') return 'light';
        const current = document.documentElement.getAttribute(ATTR);
        return current === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute(ATTR, theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // ponytail: storage may be unavailable (private mode, quota); ignore
        }
    }, [theme]);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    return [theme, setTheme, toggleTheme] as const;
}
