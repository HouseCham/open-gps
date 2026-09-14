import { useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $theme, setTheme as updateTheme, toggleTheme as flipTheme } from '@/lib/stores/theme';
import type { Theme } from '@/lib/stores/theme';

export type { Theme } from '@/lib/stores/theme';

/** Returns whether a value is a supported theme. */
export function isTheme(value: string): value is Theme {
    return value === 'light' || value === 'dark';
}

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
    const theme = useStore($theme);

    const setTheme = useCallback((next: Theme) => {
        updateTheme(next);
    }, []);

    const toggleTheme = useCallback(() => {
        flipTheme();
    }, []);

    return [theme, setTheme, toggleTheme] as const;
}
