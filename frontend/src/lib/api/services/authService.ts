import { useState } from 'react';
//-- Stores
import { toastBus } from '@/lib/stores';
//-- Types
import type {
    AuthSession,
    AuthUser,
    ChangePasswordDto,
    ChangePasswordResponse,
    ConsumePasswordRecoveryDto,
    Envelope,
    MeResponse,
    OAuthAuthorizeResponse,
    OAuthProvider,
    RequestPasswordRecoveryDto,
    RequestPasswordRecoveryResponse,
    SignInCredentials,
    SignUpCredentials,
    User,
} from '@/types/api';
//-- Constants
import { REDIRECT_AFTER_AUTH, REDIRECT_AFTER_SIGNOUT } from '@/constants/auth';
//-- Utils
import {
    clearUser,
    setAuthLoading,
    setMustChangePassword,
    setProfile,
    setRoleLoaded,
    setUser,
} from '@/lib/stores/auth';
import {
    asApiError,
    handleApiError,
    withApiErrorToast,
} from '@/lib/api/api-utils';
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
 * @method fetchProfile - Retrieves the authenticated user's full local profile (role, lastname, must_change_password, …) from /api/v1/users/me.
 * @method changePassword - Calls POST /api/v1/auth/change-password and refreshes the local profile.
 * @method requestPasswordRecovery - Calls POST /api/v1/auth/generate-pwd-recovery-token to email a single-use reset link.
 * @method consumePasswordRecovery - Calls POST /api/v1/auth/consume-pwd-recovery-token to rotate the password.
 * @method fetchOAuthAuthorizeUrl - Resolves the OAuth provider's authorization URL.
 * @method signInOAuth - Kicks off the OAuth2 sign-in flow.
 */
interface useAuthService {
    isLoading: boolean;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    signOut: () => Promise<void>;
    fetchMe: (showToast?: boolean) => Promise<AuthUser | null>;
    fetchProfile: () => Promise<User | null>;
    fetchOAuthAuthorizeUrl: (
        provider: OAuthProvider,
        callbackUrl: string
    ) => Promise<string>;
    getSession: (showToast?: boolean) => Promise<AuthUser | null>;
    changePassword: (payload: ChangePasswordDto) => Promise<void>;
    requestPasswordRecovery: (
        payload: RequestPasswordRecoveryDto
    ) => Promise<RequestPasswordRecoveryResponse['data'] | null>;
    consumePasswordRecovery: (
        payload: ConsumePasswordRecoveryDto
    ) => Promise<void>;
    signInOAuth: (provider: OAuthProvider) => Promise<void>;
}

/**
 * Hooks for Authula authentication API calls.
 */
function reportEmptyResponse(message: string, showToast: boolean): never {
    if (showToast) {
        toastBus.push({ variant: 'error', title: 'Error', message });
    }
    handleApiError(new Error(message));
}

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
                reportEmptyResponse('sign-in returned an empty response', true);
            }
            setUser(data.user);
            redirectTo(REDIRECT_AFTER_AUTH);
        } finally {
            setIsLoading(false);
        }
    }
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
                reportEmptyResponse('sign-up returned an empty response', true);
            }
            setUser(data.user);
            redirectTo(REDIRECT_AFTER_AUTH);
        } finally {
            setAuthLoading(false);
        }
    }
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
        } catch (error) {
            // The toast from withApiErrorToast is the user-visible surface
            // for this failure path; swallowing here is intentional and
            // documented by the test "still clears $user + redirects when
            // the backend rejects (finally guarantee)".
            console.error('Sign-out request failed', error);
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
    async function fetchMe(
        showToast: boolean = true
    ): Promise<AuthUser | null> {
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<MeResponse | null>('/me', { method: 'GET' })
            );
            if (!data) {
                reportEmptyResponse('me returned an empty response', showToast);
            }
            return data?.user ?? null;
        } catch (_err) {
            // withApiErrorToast already pushed a toast; treat any failure
            // as "not signed in" per the contract documented above.
            return null;
        }
    }
    /**
     * Fetches the authenticated user's full local profile from
     * `/api/v1/users/me` and stores it in `$profile`. Fires-and-forgets
     * `$isRoleLoaded` so the admin gate and the change-password gate can
     * tell "fetch in flight" apart from "fetched and got nothing".
     * Returns `null` (and does NOT throw) on any failure so the caller
     * can keep the last known good profile. The empty-response branch
     * is the same fall-through used by `fetchMe`.
     *
     * Special case: the backend's `RequirePasswordChanged` middleware
     * responds with HTTP 403 and body
     * `{"status_code":403,"message":"must_change_password"}`. `better-fetch`
     * does **not** throw by default — it returns `{ data: null, error: { ...body, status, statusText } }`.
     * We read the body off `error` and flip `mustChangePassword` so the
     * change-password gate has a signal. The `!user` guard would
     * otherwise classify the 403 as "no profile" and the gate would
     * never know to show the modal.
     * @returns {Promise<User | null>} The authenticated user, or null.
     */
    async function fetchProfile(): Promise<User | null> {
        // Reset the change-password flag on every attempt so a
        // successful post-change fetch clears the gate automatically.
        setMustChangePassword(false);
        try {
            const { data, error } = await apiClient<Envelope<User> | null>(
                '/users/me',
                { method: 'GET' }
            );

            // Body-level 403 from the middleware. The HTTP status lives
            // on `error.status`; the JSON body is spread into `error` by
            // better-fetch, so `message` is reachable directly.
            if (
                error?.status === 403 &&
                asApiError(error).message === 'must_change_password'
            ) {
                setMustChangePassword(true);
                return null;
            }
            const user = data?.data;
            if (!user) {
                reportEmptyResponse('profile returned an empty response', true);
            }
            setProfile(user);
            return user;
        } catch (_err) {
            // Network / transport failure. The only caller is getSession
            // on app load, where "no profile" is the same fallback as
            // "not signed in".
            return null;
        } finally {
            // Always flip the loaded flag, success or failure, so
            // OnlyAdminRoute / ChangePasswordGate can stop showing the
            // fallback and make a final decision.
            setRoleLoaded();
        }
    }
    /**
     * Asks Authula for the provider's authorization URL. The backend
     * @param {OAuthProvider} provider - The provider identifier (e.g. "google").
     * @param {string} callbackUrl - Absolute URL the backend should redirect to after the callback.
     * @returns {Promise<string>} The authorization URL to send the browser to.
     */
    async function fetchOAuthAuthorizeUrl(
        provider: OAuthProvider,
        callbackUrl: string
    ): Promise<string> {
        try {
            const { data } = await withApiErrorToast(() =>
                authClient<OAuthAuthorizeResponse | null>(
                    `/oauth2/authorize/${provider}?redirect_to=${encodeURIComponent(callbackUrl)}`,
                    { method: 'GET' }
                )
            );
            if (!data || !data.authUrl) {
                reportEmptyResponse(
                    'oauth authorize returned an empty response',
                    true
                );
            }
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
    async function getSession(
        showToast: boolean = true
    ): Promise<AuthUser | null> {
        setAuthLoading(true);
        try {
            const user = await fetchMe(showToast);
            if (user) {
                setUser(user);
                void fetchProfile();
            } else {
                clearUser();
            }
            return user;
        } finally {
            setAuthLoading(false);
        }
    }
    /**
     * Calls POST /api/v1/auth/change-password. Verifies the current
     * password against Authula's credential store, hashes the new one,
     * writes it back, and clears the local `must_change_password` flag
     * in one shot. On success, the local profile is re-fetched so the
     * change-password gate drops without a full reload.
     * @param {ChangePasswordDto} payload - `{ old_password, new_password }`.
     * @returns {Promise<void>}
     * @throws {ApiError} Surfaces the backend's 400/401 message verbatim;
     *   the modal renders it inline. The server folds "wrong current
     *   password" and "weak new password" into a single 400, so the
     *   modal falls back to its own copy for those.
     */
    async function changePassword(payload: ChangePasswordDto): Promise<void> {
        await withApiErrorToast(() =>
            apiClient<Envelope<ChangePasswordResponse['data']> | null>(
                '/auth/change-password',
                { method: 'POST', body: payload }
            )
        );
        // Refresh the profile so the gate can read the cleared flag
        // without a full page reload.
        await fetchProfile();
    }
    /**
     * Calls POST /api/v1/auth/generate-pwd-recovery-token to email the
     * user a single-use reset link. The endpoint always answers 202 —
     * unknown emails and rate-limited requests are indistinguishable
     * from a successful dispatch — so this function never throws on
     * the "address doesn't exist" path. Returns the envelope's `data`
     * (with Resend's `message_id`, or empty when the request was
     * dropped silently) so the calling screen can show its own
     * confirmation copy.
     * @param {RequestPasswordRecoveryDto} payload - Email, locale, and the URL prefix the reset link should land on.
     * @returns {Promise<RequestPasswordRecoveryResponse['data'] | null>}
     */
    async function requestPasswordRecovery(
        payload: RequestPasswordRecoveryDto
    ): Promise<RequestPasswordRecoveryResponse['data'] | null> {
        const { data } = await withApiErrorToast(() =>
            apiClient<Envelope<RequestPasswordRecoveryResponse['data']> | null>(
                '/auth/generate-pwd-recovery-token',
                { method: 'POST', body: payload }
            )
        );
        return data?.data ?? null;
    }
    /**
     * Calls POST /api/v1/auth/consume-pwd-recovery-token to validate
     * the email link and rotate the password. Throws on the server's
     * `400 invalid or expired token` so the calling screen can render
     * its own "link is no longer valid" copy. Backend anti-enumeration
     * means unknown / expired / already-used tokens are
     * indistinguishable on the wire.
     * @param {ConsumePasswordRecoveryDto} payload - Raw token + new password.
     * @returns {Promise<void>}
     */
    async function consumePasswordRecovery(
        payload: ConsumePasswordRecoveryDto
    ): Promise<void> {
        await withApiErrorToast(() =>
            apiClient<Envelope<boolean> | null>(
                '/auth/consume-pwd-recovery-token',
                { method: 'POST', body: payload }
            )
        );
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
        fetchProfile,
        fetchOAuthAuthorizeUrl,
        getSession,
        changePassword,
        requestPasswordRecovery,
        consumePasswordRecovery,
        signInOAuth,
    };
};
