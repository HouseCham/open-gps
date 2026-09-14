import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from './useTheme';
import { $theme } from '@/lib/stores/theme';

describe('useTheme', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
        localStorage.clear();
        $theme.set('light');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('reads initial theme from data-theme attribute on <html>', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        $theme.set('dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('dark');
    });

    it('defaults to light when no data-theme attribute is set', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('light');
    });

    it('writes data-theme attribute and localStorage when changed', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current[1]('dark'));
        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'dark'
        );
        expect(localStorage.getItem('open-gps:theme')).toBe('dark');
    });

    it('toggleTheme flips between light and dark', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('light');
        act(() => result.current[2]());
        expect(result.current[0]).toBe('dark');
        act(() => result.current[2]());
        expect(result.current[0]).toBe('light');
    });

    it('keeps multiple hook instances synchronized', () => {
        const first = renderHook(() => useTheme());
        const second = renderHook(() => useTheme());

        act(() => first.result.current[1]('dark'));

        expect(second.result.current[0]).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
});
