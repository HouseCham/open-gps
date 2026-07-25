/**
 * Minimal user shape returned by Authula on its endpoints. The auth
 * store tracks just enough identity to render "who is logged in"; the
 * detailed local projection (role, lastname, etc.) is fetched
 * separately from `/api/v1/users/me` when needed.
 * @interface AuthUser
 * @property {string} id - The Authula-assigned user id.
 * @property {string} email - The user's email address.
 * @property {string} name - The user's display name.
 */
export interface AuthUser {
    id: string;
    email: string;
    name: string;
}

/**
 * Credentials sent to POST /email-password/sign-in.
 * @interface SignInCredentials
 * @property {string} email - The email address of the user.
 * @property {string} password - The user's plaintext password.
 */
export interface SignInCredentials {
    email: string;
    password: string;
}

/**
 * Payload sent to POST /email-password/sign-up.
 * @interface SignUpCredentials
 * @property {string} email - The email address of the new user.
 * @property {string} password - The user's plaintext password.
 * @property {string} name - The display name of the new user.
 */
export interface SignUpCredentials {
    email: string;
    password: string;
    name: string;
}

/**
 * Response shape returned by Authula's email-password sign-in and
 * sign-up routes. The session itself is the HTTP-only cookie set by
 * Authula's session plugin; only the `user` projection is useful on
 * the client.
 * @interface AuthSession
 * @property {AuthUser} user - The authenticated Authula user.
 */
export interface AuthSession {
    user: AuthUser;
}

/**
 * Role assigned to a user. Mirrors the backend `domain.UserRole`
 * (`"user" | "super_admin"`). Used for client-side gating of admin-only
 * routes — the server remains the source of truth, this is only for
 * UX-level redirect / UI hiding.
 * @typedef {'user' | 'super_admin'} UserRole
 */
export type UserRole = 'user' | 'super_admin';

/**
 * Response shape returned by GET /me. Only the user is relevant on the
 * client; session metadata stays server-side.
 * @interface MeResponse
 * @property {AuthUser} user - The currently authenticated user.
 */
export interface MeResponse {
    user: AuthUser;
}

/**
 * Error shape returned by Authula on a failed sign-in or sign-up.
 * @interface AuthErrorBody
 * @property {string} message - Human-readable error message.
 * @property {string} [code] - Optional machine-readable error code.
 */
export interface AuthErrorBody {
    message: string;
    code?: string;
}

/**
 * The list of OAuth2 providers currently wired on the backend. Used
 * to drive which buttons render in the login UI without hard-coding
 * a provider list in two places.
 * @typedef {'google' | 'discord' | 'github'} OAuthProvider
 */
export type OAuthProvider = 'google' | 'discord' | 'github';

/**
 * Response shape returned by Authula's `/oauth2/authorize/{provider}`
 * route. The browser is redirected to `authUrl` to start the flow.
 * @interface OAuthAuthorizeResponse
 * @property {string} authUrl - The provider's authorization URL.
 */
export interface OAuthAuthorizeResponse {
    authUrl: string;
}

/**
 * Response shape returned by Authula's POST /sign-out endpoint. The
 * server clears the session cookie on its way out; the frontend just
 * needs to forget the local user.
 * @interface SignOutResponse
 * @property {string} message - Human-readable confirmation.
 */
export interface SignOutResponse {
    message: string;
}
/**
 * Result shape for the `useAuth` hook.
 * @interface UseAuthResult
 * @property {AuthUser | null} user - The currently authenticated user, or `null` when signed out.
 * @property {boolean} isAuthenticated - `true` when `user` is not `null`.
 * @property {boolean} isAuthLoading - `true` while a sign-in / sign-up / sign-out / session refresh is in flight.
 * @property {UserRole | null} role - The authenticated user's role. `null` until `authService.fetchProfile()` settles — use {@link isRoleLoaded} to disambiguate "not yet fetched" from "fetched and got nothing".
 * @property {boolean} isRoleLoaded - `true` once the profile fetch has resolved (success or failure). Only meaningful when `isAuthenticated` is `true`.
 * @property {(credentials: SignInCredentials) => Promise<void>} signIn - Sign in with email + password. Throws on invalid credentials.
 * @property {(credentials: SignUpCredentials) => Promise<void>} signUp - Register a new account. Throws on validation failure.
 * @property {(provider: OAuthProvider) => Promise<void>} signInOAuth - Begin the OAuth2 sign-in flow for the given provider. The browser is redirected away.
 * @property {() => void} signOut - Forget the local session and redirect away.
 */
export interface UseAuthResult {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    role: UserRole | null;
    isRoleLoaded: boolean;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    signInOAuth: (provider: OAuthProvider) => Promise<void>;
    signOut: () => void;
}
