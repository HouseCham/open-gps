import { useState } from 'react';
//-- Stores
import { toastBus } from '@/lib/stores';
//-- Types
import type {
    AuthSession,
    AuthUser,
    Envelope,
    MeResponse,
    OAuthAuthorizeResponse,
    OAuthProvider,
    ProfileResponse,
    SignInCredentials,
    SignUpCredentials,
    UserRole,
} from '@/types/api';
//-- Constants
import { REDIRECT_AFTER_AUTH, REDIRECT_AFTER_SIGNOUT } from '@/constants/auth';
//-- Utils
import {
    clearUser,
    setAuthLoading,
    setUser,
} from '@/lib/stores/auth';
import { handleApiError, withApiErrorToast } from '@/lib/api/api-utils';
import { apiClient, authClient } from '@/lib/api/client';
import { redirectTo } from '@/lib';

/**
 * The interface for the authentication service.
 * @interface useAuthService
 * @property {boolean} isLoading - Whether the service is currently loading data.
 * @method signIn - Calls POST /email-password/sign-in on the Authula backend.
 * @method signUp - Calls POST /email-password/sign-up on the Authula backend.
 * @method signOut - Calls POST /sign-out on the Authula backend.
 * @method fetchMe - Calls GET /me on the Authula backend.
 * @method getSession - Retrieves the authenticated user from the backend.
 * @method fetchRole - Retrieves the authenticated user's role from the backend.
 */
interface useAuthService {
    isLoading: boolean;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    signOut: () => Promise<void>;
    fetchMe: (showToast?: boolean) => Promise<AuthUser | null>;
    fetchRole: () => Promise<UserRole | null>;
    fetchOAuthAuthorizeUrl: (provider: OAuthProvider, callbackUrl: string) => Promise<string>;
    getSession: (showToast?: boolean) => Promise<AuthUser | null>;
    signInOAuth: (provider: OAuthProvider) => Promise<void>;
};

/**
 * Hooks for Authula authentication API calls.
 */
export const useAuthService = (): useAuthService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);

    /**
     * Calls POST /email-password/sign-in on the Authula backend and
     * returns the resulting session.
     * @param {SignInCredentials} credentials - Email and password.
     * @returns {Promise<AuthSession>} The session payload from the backend.
     * @throws {ApiError} When the backend rejects the credentials.
     */
    async function signIn(credentials: SignInCredentials): Promise<void> {
        setIsLoading(true);
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<AuthSession | null>('/email-password/sign-in', {
                    method: 'POST',
                    body: credentials,
                })
            );
            if (!data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'sign-in returned an empty response',
                });
                handleApiError(
                    new Error('sign-in returned an empty response')
                );
            };
            setUser(data.user);
            redirectTo(REDIRECT_AFTER_AUTH);
        } finally {
            setIsLoading(false);
        }
    };
    /**
     * Calls POST /email-password/sign-up on the Authula backend and
     * returns the resulting session.
     * @param {SignUpCredentials} credentials - Email, password, and name.
     * @returns {Promise<AuthSession>} The session payload from the backend.
     * @throws {ApiError} When the backend rejects the credentials.
     */
    async function signUp(credentials: SignUpCredentials): Promise<void> {
        setAuthLoading(true);
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<AuthSession | null>('/email-password/sign-up', {
                    method: 'POST',
                    body: credentials,
                })
            );
            if (!data) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'sign-up returned an empty response',
                })
                handleApiError(new Error('sign-up returned an empty response'));
            }
            setUser(data.user);
            redirectTo(REDIRECT_AFTER_AUTH);
        } finally {
            setAuthLoading(false);
        }
    };
    /**
     * Signs out the user by calling POST /sign-out on the Authula backend.
     * @returns {Promise<void>}
     */
    async function signOut(): Promise<void> {
        setAuthLoading(true);
        try {
            // signOut's contract is "never throw": the session cookie is
            // gone either way, the toast above gives the user feedback,
            // and rethrowing would just leave them stranded on a page they
            // can't act on. Local cleanup runs unconditionally in `finally`.
            await withApiErrorToast(() =>
                authClient('/sign-out', { method: 'POST' })
            );
        } catch (_err) {
            // The toast from withApiErrorToast is the user-visible surface
            // for this failure path; swallowing here is intentional and
            // documented by the test "still clears $user + redirects when
            // the backend rejects (finally guarantee)".
        } finally {
            clearUser();
            redirectTo(REDIRECT_AFTER_SIGNOUT);
            setAuthLoading(false);
        }
    }
    /**
     * Calls GET /me on the Authula backend. Returns the authenticated
     * user or `null` when there is no valid session. A 401 (or any other
     * failure) is treated as "not signed in" rather than thrown, because
     * the only legitimate caller is `authService.getSession()` on app load.
     * @param {boolean | undefined} showToast - Whether to show a toast on error.
     * @returns {Promise<AuthUser | null>} The authenticated user, or null.
     */
    async function fetchMe(showToast: boolean = true): Promise<AuthUser | null> {
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<MeResponse | null>('/me', { method: 'GET' })
            );
            if (!data) {
                if (showToast) {
                    toastBus.push({
                        variant: 'error',
                        title: 'Error',
                        message: 'me returned an empty response',
                    });    
                }
                handleApiError(new Error('me returned an empty response'));
            }
            return data?.user ?? null;
        } catch (_err) {
            // withApiErrorToast already pushed a toast; treat any failure
            // as "not signed in" per the contract documented above.
            return null;
        }
    }
    /**
     * Returns the authenticated user's role or `null` when there is no valid session.
     * @returns {Promise<UserRole | null>} The authenticated user's role, or null.
     */
    async function fetchRole(): Promise<UserRole | null> {
        try {
            const { data } = await apiClient<Envelope<ProfileResponse['user']> | null>('/users/me', { method: 'GET' });
            const role = data?.data?.role;
            if (!data || !role) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'me returned an empty response',
                })
                handleApiError(new Error('me returned an empty response'));
            };
            return role;
        } catch (_err) {
            // No toast here: the only caller is getSession on app load,
            // where a failed role fetch is the same as "no session".
            return null;
        };
    };
    /**
     * Asks Authula for the provider's authorization URL. The backend
     * @param {OAuthProvider} provider - The provider identifier (e.g. "google").
     * @param {string} callbackUrl - Absolute URL the backend should redirect to after the callback.
     * @returns {Promise<string>} The authorization URL to send the browser to.
     */
    async function fetchOAuthAuthorizeUrl(provider: OAuthProvider, callbackUrl: string): Promise<string> {
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<OAuthAuthorizeResponse | null>(
                    `/oauth2/authorize/${provider}?redirect_to=${encodeURIComponent(callbackUrl)}`,
                    { method: 'GET' }
                )
            );
            if (!data || !data.authUrl) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: 'oauth authorize returned an empty response',
                });
                handleApiError(new Error('oauth authorize returned an empty response'));
            };
            return data.authUrl;
        } catch (_err) {
            // withApiErrorToast already pushed a toast; the caller falls
            // back to an empty string so the OAuth redirect is a no-op.
            return '';
        }
    }
    /**
     * Retrieves the authenticated user from the backend and updates and returns the `$user` atom.
     * @param {boolean | undefined} showToast - Whether to show a toast on error.
     * @returns {Promise<AuthUser | null>} The authenticated user, or null.
     */
    async function getSession(showToast: boolean = true): Promise<AuthUser | null> {
        setAuthLoading(true);
        try {
            const user = await fetchMe(showToast);
            if (user) {
                setUser(user);
                void fetchRole();
            } else {
                clearUser();
            }
            return user;
        } finally {
            setAuthLoading(false);
        }
    }
    /**
     * Kicks off the OAuth flow by asking Authula for the provider's
     * authorize URL, then hands the browser off to it. The callback URL
     * is the current page's origin; the backend redirects back there
     * after the provider handshake.
     * @param {OAuthProvider} provider - The provider identifier (e.g. "google").
     * @returns {Promise<void>} Resolves once the navigation is dispatched.
     * @throws {ApiError} When the authorize call fails (the toast has
     *   already been pushed by `withApiErrorToast`).
     */
    async function signInOAuth(provider: OAuthProvider): Promise<void> {
        setAuthLoading(true);
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<OAuthAuthorizeResponse | null>(
                    `/oauth2/authorize/${provider}?redirect_to=${encodeURIComponent(window.location.origin)}`,
                    { method: 'GET' }
                )
            );
            if (!data?.authUrl) {
                throw new Error('oauth authorize returned an empty response');
            }
            // Success path deliberately skips the `finally` reset: the page
            // navigates away, so the loading flag is moot in production.
            window.location.href = data.authUrl;
        } catch (err) {
            // withApiErrorToast already pushed a toast (or this is the
            // empty-response throw above). Reset the loading flag here —
            // the success path skips this reset because the page navigates.
            setAuthLoading(false);
            throw err;
        }
    }

    return {
        isLoading,
        signIn,
        signUp,
        signOut,
        fetchMe,
        fetchRole,
        fetchOAuthAuthorizeUrl,
        getSession,
        signInOAuth
    };
}
