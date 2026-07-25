import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    authClient: vi.fn(),
    apiClient: vi.fn(),
}));

vi.mock('@/lib', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib')>();
    return { ...actual, redirectTo: vi.fn() };
});

import * as clientMod from '@/lib/api/client';
import * as libMod from '@/lib';
import { $isAuthLoading, $user } from '@/lib/stores/auth';
import { $toasts } from '@/lib/stores/toast.store';
import type {
    AuthSession,
    AuthUser,
    MeResponse,
    OAuthAuthorizeResponse,
} from '@/types/api';
import { useAuthService } from './authService';

const authClient = vi.mocked(clientMod.authClient);
const redirectTo = vi.mocked(libMod.redirectTo);

const user: AuthUser = { id: 'u-1', email: 'a@b.com', name: 'A B' };
const session: AuthSession = { user };

let svc: ReturnType<typeof useAuthService>;

beforeEach(() => {
    $user.set(null);
    $isAuthLoading.set(false);
    $toasts.set([]);
    authClient.mockReset();
    redirectTo.mockReset();
    svc = renderHook(() => useAuthService()).result.current;
});

describe('useAuthService.signIn', () => {
    it('POSTs, populates $user, redirects to "/" and toggles isAuthLoading', async () => {
        authClient.mockResolvedValue({ data: session });

        await svc.signIn({ email: 'a@b.com', password: 'pw' });

        expect(authClient).toHaveBeenCalledWith(
            '/email-password/sign-in',
            expect.objectContaining({
                method: 'POST',
                body: { email: 'a@b.com', password: 'pw' },
            })
        );
        expect($user.get()).toEqual(user);
        expect(redirectTo).toHaveBeenCalledWith('/');
        expect($isAuthLoading.get()).toBe(false);
    });

    it('clears isAuthLoading on an API error and does NOT populate the user', async () => {
        authClient.mockRejectedValue(new Error('bad creds'));

        await expect(
            svc.signIn({ email: 'a@b.com', password: 'pw' })
        ).rejects.toEqual({ status: 0, message: 'bad creds' });

        expect($user.get()).toBeNull();
        expect(redirectTo).not.toHaveBeenCalled();
        expect($isAuthLoading.get()).toBe(false);
    });

    it('throws when the backend returns an empty data field', async () => {
        authClient.mockResolvedValue({ data: null });

        await expect(
            svc.signIn({ email: 'a@b.com', password: 'pw' })
        ).rejects.toEqual({
            status: 0,
            message: 'sign-in returned an empty response',
        });
        expect($user.get()).toBeNull();
    });
});

describe('useAuthService.signUp', () => {
    it('POSTs to /email-password/sign-up, populates $user and redirects to "/"', async () => {
        authClient.mockResolvedValue({ data: session });

        await svc.signUp({
            email: 'a@b.com',
            password: 'pw',
            name: 'A B',
        });

        expect(authClient).toHaveBeenCalledWith(
            '/email-password/sign-up',
            expect.objectContaining({ method: 'POST' })
        );
        expect($user.get()).toEqual(user);
        expect(redirectTo).toHaveBeenCalledWith('/');
    });
});

describe('useAuthService.signInOAuth', () => {
    let hrefSpy: ReturnType<typeof vi.fn>;
    let originalDesc: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalDesc = Object.getOwnPropertyDescriptor(window.location, 'href');
        hrefSpy = vi.fn();
        // happy-dom lets us substitute the setter on window.location.href so
        // we can observe the `window.location.href = authUrl` line without
        // letting a real navigation mutate `window.location.origin` for
        // later assertions.
        Object.defineProperty(window.location, 'href', {
            set: hrefSpy,
            get: () => '',
            configurable: true,
        });
    });

    afterEach(() => {
        if (originalDesc) {
            Object.defineProperty(window.location, 'href', originalDesc);
        }
    });

    it('hits /oauth2/authorize with the right path and assigns the resolved authUrl to location.href', async () => {
        const body: OAuthAuthorizeResponse = {
            authUrl: 'https://provider.example/auth',
        };
        authClient.mockResolvedValue({ data: body });

        await svc.signInOAuth('google');

        const calledPath = (authClient.mock.calls[0]?.[0] as string) ?? '';
        expect(
            calledPath.startsWith('/oauth2/authorize/google?redirect_to=')
        ).toBe(true);
        expect(hrefSpy).toHaveBeenCalledWith('https://provider.example/auth');
        // Note: the happy path does NOT clear `$isAuthLoading` — the page
        // navigates away, making the flag moot in production. The catch
        // branch is the only path that resets it, covered separately.
    });

    it('re-throws and clears isAuthLoading when the authorize call fails', async () => {
        authClient.mockRejectedValue(new Error('nope'));

        await expect(svc.signInOAuth('google')).rejects.toEqual({
            status: 0,
            message: 'nope',
        });
        expect($isAuthLoading.get()).toBe(false);
    });
});

describe('useAuthService.signOut', () => {
    it('POSTs /sign-out, clears $user and redirects to "/login"', async () => {
        authClient.mockResolvedValue({ data: { message: 'ok' } });
        $user.set(user);

        await svc.signOut();

        expect(authClient).toHaveBeenCalledWith(
            '/sign-out',
            expect.objectContaining({ method: 'POST' })
        );
        expect($user.get()).toBeNull();
        expect(redirectTo).toHaveBeenCalledWith('/login');
        expect($isAuthLoading.get()).toBe(false);
    });

    it('still clears $user + redirects when the backend rejects (finally guarantee)', async () => {
        authClient.mockRejectedValue(new Error('server down'));
        $user.set(user);

        await svc.signOut();

        expect($user.get()).toBeNull();
        expect(redirectTo).toHaveBeenCalledWith('/login');
        expect($isAuthLoading.get()).toBe(false);
    });
});

describe('useAuthService.getSession', () => {
    it('populates $user and returns it on a successful /me', async () => {
        const body: MeResponse = { user };
        authClient.mockResolvedValue({ data: body });

        const result = await svc.getSession();

        expect(result).toEqual(user);
        expect($user.get()).toEqual(user);
        expect($isAuthLoading.get()).toBe(false);
    });

    it('clears $user and returns null when the session is missing', async () => {
        authClient.mockResolvedValue({ data: null });
        $user.set(user);

        const result = await svc.getSession();

        expect(result).toBeNull();
        expect($user.get()).toBeNull();
        expect($isAuthLoading.get()).toBe(false);
    });

    it('returns null and clears $user when /me throws (treats any failure as "not signed in")', async () => {
        authClient.mockRejectedValue(new Error('network'));
        $user.set(user);

        const result = await svc.getSession();

        expect(result).toBeNull();
        expect($user.get()).toBeNull();
        expect($isAuthLoading.get()).toBe(false);
    });
});
