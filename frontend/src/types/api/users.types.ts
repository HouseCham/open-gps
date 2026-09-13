//-- Types
import type { Translation } from '@/i18n';
import type { UserRole } from './auth.types';

export interface User {
    id: string;
    email: string;
    email_verified: boolean;
    image: string | null;
    name: string;
    lastname: string;
    role: UserRole;
    must_change_password: boolean;
    created_at: string;
}

/**
 * Payload sent to POST /api/v1/auth/change-password. The endpoint
 * verifies `old_password` against Authula's credential store, hashes
 * the new one, writes it back, and clears the local
 * `must_change_password` flag in one shot. See
 * `backend/docs/api/Authentication.md` for details.
 * @interface ChangePasswordDto
 * @property {string} old_password - The user's current password.
 * @property {string} new_password - The replacement password (≥ 8 chars, server-enforced).
 */
export interface ChangePasswordDto {
    old_password: string;
    new_password: string;
}

/**
 * Envelope returned by POST /api/v1/auth/change-password. The `data`
 * field is the new value of the user's `must_change_password` flag —
 * always `false` on a successful change.
 * @interface ChangePasswordResponse
 * @property {number} status_code - The HTTP status code echoed back.
 * @property {string} message - Human-readable confirmation.
 * @property {boolean} data - The new value of `must_change_password`.
 */
export interface ChangePasswordResponse {
    status_code: number;
    message: string;
    data: boolean;
}

/**
 * Payload sent to POST /api/v1/auth/generate-pwd-recovery-token. The
 * server embeds the freshly-generated reset token in the URL it sends
 * by email, so the frontend only ships the prefix (typically
 * `${origin}/reset?token=`). The endpoint always answers 202 —
 * unknown emails and rate-limited requests are indistinguishable
 * from a successful dispatch.
 * @interface RequestPasswordRecoveryDto
 * @property {string} email - The user's email address.
 * @property {string} locale - Template locale (`"en"` or `"es"`).
 * @property {string} reset_password_url - URL prefix the reset link should land on.
 */
export interface RequestPasswordRecoveryDto {
    email: string;
    locale: 'en' | 'es';
    reset_password_url: string;
}

/**
 * Envelope returned by POST /api/v1/auth/generate-pwd-recovery-token.
 * `data.message_id` echoes Resend's id when dispatch actually
 * happened; it is the empty string when the request was silently
 * dropped (unknown email or rate-limit hit).
 * @interface RequestPasswordRecoveryResponse
 * @property {number} status_code - The HTTP status code echoed back.
 * @property {string} message - Human-readable confirmation.
 * @property {{ message_id: string }} data - Resend's email id, or empty.
 */
export interface RequestPasswordRecoveryResponse {
    status_code: number;
    message: string;
    data: { message_id: string };
}

/**
 * Payload sent to POST /api/v1/auth/consume-pwd-recovery-token.
 * @interface ConsumePasswordRecoveryDto
 * @property {string} token - The raw token extracted from the reset URL.
 * @property {string} new_password - The replacement password (≥ 8 chars, server-enforced).
 */
export interface ConsumePasswordRecoveryDto {
    token: string;
    new_password: string;
}

export interface UserWithDevices extends User {
    devices: Array<{
        id: string;
        uuid_firmware: string;
        name: string;
    }>;
    pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    };
}

export interface CreateUserDto {
    email: string;
    name: string;
    lastname?: string;
}

export interface CreatedUser extends User {
    temporary_password: string;
}

export interface UpdateUserDto {
    name?: string;
    lastname?: string;
}

/**
 * Response shape returned by GET /api/v1/users/me. Carries the full local
 * user projection (role, lastname, image, created_at, …) the profile page
 * needs beyond the minimal AuthUser shape. Distinct from
 * `AuthSession`/`MeResponse` in `auth.types.ts`, which only carry the
 * Authula projection used by the auth gate.
 * @interface ProfileResponse
 * @property {User} user - The currently authenticated user with every
 *   field the local users table exposes.
 */
export interface ProfileResponse {
    user: User;
}
/**
 * Counts driving the chip badges in the filter bar.
 * @interface UserFilterCounts
 * @prop {number} all - Total number of users.
 * @prop {number} admin - Number of admin users.
 * @prop {number} user - Number of non-admin users.
 * @prop {number} verified - Number of verified emails.
 * @prop {number} unverified - Number of unverified emails.
 */
export interface UserFilterCounts {
    all: number;
    admin: number;
    user: number;
    verified: number;
    unverified: number;
}
/**
 * The role filter values.
 * @type {'all' | 'user' | 'super_admin'}
 */
export type UserRoleFilter = 'all' | 'user' | 'super_admin';
/**
 * The email-verification filter values.
 * @type {'all' | 'verified' | 'unverified'}
 */
export type UserEmailFilter = 'all' | 'verified' | 'unverified';
/**
 * The sort keys supported by the users table.
 * @type {'created-desc' | 'created-asc' | 'name-asc'}
 */
export type UserSortKey = 'created-desc' | 'created-asc' | 'name-asc';

/**
 * The translation namespace for the users page. Pulled from the
 * `Translation` type so adding a new locale only requires the locale
 * object to fill the same shape.
 */
export type UsersTranslation = Translation['user'] &
    Pick<Translation, 'admin'> &
    Pick<Translation, 'toast'>;