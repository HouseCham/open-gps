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
import {
    $isAuthLoading,
    $isRoleLoaded,
    $mustChangePassword,
    $profile,
    $user,
} from '@/lib/stores/auth';
import { $toasts } from '@/lib/stores/toast.store';
import type {
    AuthSession,
    AuthUser,
    ChangePasswordResponse,
    Envelope,
    MeResponse,
    OAuthAuthorizeResponse,
    User,
} from '@/types/api';
import { useAuthService } from './authService';

const authClient = vi.mocked(clientMod.authClient);
const apiClient = vi.mocked(clientMod.apiClient);
const redirectTo = vi.mocked(libMod.redirectTo);

const user: AuthUser = { id: 'u-1', email: 'a@b.com', name: 'A B' };
const session: AuthSession = { user };

const fullUser: User = {
    id: 'u-1',
    email: 'a@b.com',
    email_verified: true,
    image: null,
    name: 'A B',
    lastname: '',
    role: 'user',
    must_change_password: false,
    created_at: '2026-01-01T00:00:00Z',
};

let svc: ReturnType<typeof useAuthService>;

beforeEach(() => {
    $user.set(null);
    $profile.set(null);
    $isAuthLoading.set(false);
    $isRoleLoaded.set(false);
    $mustChangePassword.set(false);
    $toasts.set([]);
    authClient.mockReset();
    apiClient.mockReset();
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

describe('useAuthService.fetchProfile', () => {
    it('populates $profile from the /users/me envelope and flips $isRoleLoaded', async () => {
        const body: Envelope<User> = {
            status_code: 200,
            message: 'ok',
            data: fullUser,
        };
        apiClient.mockResolvedValue({ data: body });

        const result = await svc.fetchProfile();

        expect(result).toEqual(fullUser);
        expect($profile.get()).toEqual(fullUser);
        expect($isRoleLoaded.get()).toBe(true);
        expect(apiClient).toHaveBeenCalledWith(
            '/users/me',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('returns null and still flips $isRoleLoaded on an empty response', async () => {
        apiClient.mockResolvedValue({ data: null });

        const result = await svc.fetchProfile();

        expect(result).toBeNull();
        expect($profile.get()).toBeNull();
        expect($isRoleLoaded.get()).toBe(true);
    });

    it('returns null and still flips $isRoleLoaded when the network throws', async () => {
        apiClient.mockRejectedValue(new Error('network'));

        const result = await svc.fetchProfile();

        expect(result).toBeNull();
        expect($profile.get()).toBeNull();
        expect($isRoleLoaded.get()).toBe(true);
    });

    it('flips $mustChangePassword on a 403 must_change_password from the middleware', async () => {
        // better-fetch does NOT throw on 4xx by default — it returns
        // `{ data: null, error: { ...body, status, statusText } }`.
        // The middleware's status code lives on `error.status` and
        // the JSON body is spread into `error` by better-fetch.
        apiClient.mockResolvedValue({
            data: null,
            error: {
                status: 403,
                statusText: 'Forbidden',
                status_code: 403,
                message: 'must_change_password',
            },
        });

        const result = await svc.fetchProfile();

        expect(result).toBeNull();
        expect($profile.get()).toBeNull();
        expect($mustChangePassword.get()).toBe(true);
        expect($isRoleLoaded.get()).toBe(true);
        // No toast on the expected code path — the gate renders the modal.
        expect($toasts.get()).toEqual([]);
    });

    it('does NOT flip $mustChangePassword on an unrelated 403', async () => {
        apiClient.mockResolvedValue({
            data: null,
            error: {
                status: 403,
                statusText: 'Forbidden',
                status_code: 403,
                message: 'some other reason',
            },
        });

        await svc.fetchProfile();

        expect($mustChangePassword.get()).toBe(false);
        expect($isRoleLoaded.get()).toBe(true);
    });

    it('resets $mustChangePassword on a subsequent successful fetch', async () => {
        $mustChangePassword.set(true);
        const body: Envelope<User> = {
            status_code: 200,
            message: 'ok',
            data: { ...fullUser, must_change_password: false },
        };
        apiClient.mockResolvedValue({ data: body });

        const result = await svc.fetchProfile();

        expect(result?.must_change_password).toBe(false);
        expect($mustChangePassword.get()).toBe(false);
    });
});

describe('useAuthService.changePassword', () => {
    it('POSTs the payload, then re-fetches the profile so the gate can drop', async () => {
        const updated: User = { ...fullUser, must_change_password: false };
        const body: Envelope<ChangePasswordResponse['data']> = {
            status_code: 200,
            message: 'password changed',
            data: false,
        };
        apiClient.mockResolvedValueOnce({ data: body }).mockResolvedValueOnce({
            data: {
                status_code: 200,
                message: 'ok',
                data: updated,
            },
        });

        await svc.changePassword({
            old_password: 'temp',
            new_password: 'newStrong1!',
        });

        expect(apiClient).toHaveBeenNthCalledWith(
            1,
            '/auth/change-password',
            expect.objectContaining({
                method: 'POST',
                body: { old_password: 'temp', new_password: 'newStrong1!' },
            })
        );
        expect(apiClient).toHaveBeenNthCalledWith(
            2,
            '/users/me',
            expect.objectContaining({ method: 'GET' })
        );
        expect($profile.get()).toEqual(updated);
    });

    it('surfaces a 400 error verbatim and leaves $profile untouched', async () => {
        $profile.set({ ...fullUser, must_change_password: true });
        apiClient.mockRejectedValueOnce(new Error('password is too short'));

        await expect(
            svc.changePassword({ old_password: 'x', new_password: 'y' })
        ).rejects.toEqual({
            status: 0,
            message: 'password is too short',
        });
        // The gate keeps showing the modal because we never re-fetched.
        expect($profile.get()?.must_change_password).toBe(true);
    });
});
