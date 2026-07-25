//-- Types
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
