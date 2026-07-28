import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '@/i18n';
import { generateNavbarItems, redirectTo } from './router-utils';

describe('generateNavbarItems', () => {
    it('returns dashboard + devices + API keys + profile when showAdmin is false', () => {
        const items = generateNavbarItems('en', en, false);
        expect(items.map(i => i.key)).toEqual([
            'dashboard',
            'devices',
            'api-keys',
            'profile',
        ]);
    });

    it('inserts admin between API keys and profile when showAdmin is true', () => {
        const items = generateNavbarItems('en', en, true);
        expect(items.map(i => i.key)).toEqual([
            'dashboard',
            'devices',
            'api-keys',
            'admin',
            'profile',
        ]);
    });

    it('prefixes every href with the locale', () => {
        const items = generateNavbarItems('es', en, true);
        for (const item of items) {
            expect(item.href.startsWith('/es/')).toBe(true);
        }
    });

    it('uses nav translation keys as labels and assigns an Icon per item', () => {
        const items = generateNavbarItems('en', en, true);
        expect(items.find(i => i.key === 'dashboard')?.label).toBe(
            en.nav.dashboard
        );
        expect(items.find(i => i.key === 'devices')?.label).toBe(
            en.nav.devices
        );
        expect(items.find(i => i.key === 'admin')?.label).toBe(en.nav.admin);
        expect(items.find(i => i.key === 'profile')?.label).toBe(
            en.nav.profile
        );
        for (const item of items) {
            expect(item.Icon).toBeDefined();
        }
    });
});

describe('redirectTo', () => {
    let originalReplace: typeof window.location.replace;
    let originalPathname: string;
    let replaceSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        originalReplace = window.location.replace;
        originalPathname = window.location.pathname;
        replaceSpy = vi.fn();
        window.location.replace =
            replaceSpy as unknown as typeof window.location.replace;
    });

    afterEach(() => {
        window.location.replace = originalReplace;
        window.history.pushState({}, '', originalPathname);
    });

    const setPath = (path: string): void => {
        window.history.pushState({}, '', path);
    };

    const setNavigatorLanguage = (value: string): void => {
        Object.defineProperty(navigator, 'language', {
            value,
            configurable: true,
        });
    };

    it('prefers the locale in the current pathname over navigator.language', () => {
        setPath('/es/devices/');
        setNavigatorLanguage('en-US');
        redirectTo('/devices/detail?id=abc');
        expect(replaceSpy).toHaveBeenCalledWith('/es/devices/detail?id=abc');
    });

    it('prefixes the path with /en when the pathname starts with /en', () => {
        setPath('/en/');
        redirectTo('/dashboard');
        expect(replaceSpy).toHaveBeenCalledWith('/en/dashboard');
    });

    it('prefixes the path with /en when navigator.language is en-US', () => {
        setPath('/');
        setNavigatorLanguage('en-US');
        redirectTo('/dashboard');
        expect(replaceSpy).toHaveBeenCalledWith('/en/dashboard');
    });

    it('prefixes the path with /es when navigator.language starts with es', () => {
        setPath('/');
        setNavigatorLanguage('es-MX');
        redirectTo('/perfil');
        expect(replaceSpy).toHaveBeenCalledWith('/es/perfil');
    });

    it('falls back to /en for an unsupported navigator.language', () => {
        setPath('/');
        setNavigatorLanguage('fr-FR');
        redirectTo('/foo');
        expect(replaceSpy).toHaveBeenCalledWith('/en/foo');
    });

    it('falls back to /en when navigator.language is empty', () => {
        setPath('/');
        setNavigatorLanguage('');
        redirectTo('/foo');
        expect(replaceSpy).toHaveBeenCalledWith('/en/foo');
    });

    it('ignores an unsupported locale in the pathname and falls back to navigator', () => {
        setPath('/fr/');
        setNavigatorLanguage('es-MX');
        redirectTo('/perfil');
        expect(replaceSpy).toHaveBeenCalledWith('/es/perfil');
    });
});
