import { atom, computed } from 'nanostores';
//-- Types
import type { AuthUser, User } from '@/types/api';

/**
 * The currently authenticated user, or `null` when nobody is signed in.
 * Hydrated by `authService.getSession()` on app startup and updated by
 * `authService.signIn()` / `authService.signOut()`.
 * @type {import('nanostores').Atom<AuthUser | null>}
 */
export const $user = atom<AuthUser | null>(null);

/**
 * `true` whenever `$user` holds a non-null value. Components subscribe
 * to this to render authenticated vs unauthenticated states without
 * re-checking the user object themselves.
 * @type {import('nanostores').ReadonlyAtom<boolean>}
 */
export const $isAuthenticated = computed($user, user => user !== null);

/**
 * `true` while a sign-in, sign-up, sign-out, or session refresh is in
 * flight. UI components read this to disable buttons and show spinners.
 * @type {import('nanostores').Atom<boolean>}
 */
export const $isAuthLoading = atom<boolean>(false);

/**
 * The full local user projection returned by `/api/v1/users/me`.
 * Carries the role, lastname, image, `must_change_password` flag, etc.
 * that the Authula-shaped `$user` does not. Hydrated by
 * `authService.getSession()` right after `$user` is resolved.
 * @type {import('nanostores').Atom<User | null>}
 */
export const $profile = atom<User | null>(null);

/**
 * The authenticated user's role. Derived from `$profile` — `null`
 * whenever the profile is missing (i.e. the user is signed out, the
 * profile fetch is still in flight, or the fetch failed). Read
 * {@link $isRoleLoaded} for the "fetch settled" signal.
 * @type {import('nanostores').ReadonlyAtom<UserRole | null>}
 */
export const $userRole = computed($profile, profile => profile?.role ?? null);

/**
 * `true` once `authService.fetchProfile()` has settled — either with
 * a user or with an error. Used by `OnlyAdminRoute` and the
 * `ChangePasswordGate` to know when the role / password-flag decision
 * is final vs. still in flight. Never `true` while the user is signed
 * out (profile fetches only run after a successful `getSession()`).
 * @type {import('nanostores').Atom<boolean>}
 */
export const $isRoleLoaded = atom<boolean>(false);

/**
 * `true` when the backend's `RequirePasswordChanged` middleware has
 * blocked `/api/v1/*` with a 403 and the `must_change_password` body.
 * The middleware short-circuits the response before the handler
 * returns, so `$profile` stays `null` — this flag is the only signal
 * the change-password gate has in that case. Reset on every
 * `fetchProfile()` call so a successful re-fetch after the change
 * lets the gate drop.
 * @type {import('nanostores').Atom<boolean>}
 */
export const $mustChangePassword = atom<boolean>(false);

/**
 * Replace the currently held user with a new one. Use after a
 * successful sign-in or session refresh.
 * @param {AuthUser} user - The authenticated user.
 * @returns {void}
 */
export function setUser(user: AuthUser): void {
    $user.set(user);
}

/**
 * Forget the currently held user, profile, and resolved role. Use
 * after sign-out or when a session refresh fails.
 * @returns {void}
 */
export function clearUser(): void {
    $user.set(null);
    $profile.set(null);
    $isRoleLoaded.set(false);
    $mustChangePassword.set(false);
}

/**
 * Toggle the loading flag that gates buttons and spinners in the
 * auth UI.
 * @param {boolean} loading - Whether an auth operation is in progress.
 * @returns {void}
 */
export function setAuthLoading(loading: boolean): void {
    $isAuthLoading.set(loading);
}

/**
 * Replace the resolved profile. The role is recomputed from this
 * value automatically — callers don't need to set it separately.
 * @param {User} user - The full local user projection.
 * @returns {void}
 */
export function setProfile(user: User): void {
    $profile.set(user);
}

/**
 * Forget the resolved profile. Use when the profile becomes invalid
 * (e.g. after the user changes their own password, where the
 * `must_change_password` flag is now stale).
 * @returns {void}
 */
export function clearProfile(): void {
    $profile.set(null);
}

/**
 * Mark the profile fetch as settled. Always called after
 * `fetchProfile()` resolves (success or failure) so consumers can
 * distinguish "not yet tried" from "tried and got nothing back".
 * @returns {void}
 */
export function setRoleLoaded(): void {
    $isRoleLoaded.set(true);
}

/**
 * Flip the change-password gate signal. Called by `fetchProfile()`
 * when the backend's `RequirePasswordChanged` middleware returns 403
 * with the `must_change_password` body; reset on every
 * `fetchProfile()` call so a successful post-change fetch clears it.
 * @param {boolean} required - Whether the user must change their password.
 * @returns {void}
 */
export function setMustChangePassword(required: boolean): void {
    $mustChangePassword.set(required);
}
