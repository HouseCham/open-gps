/**
 * Represents an error returned by the API.
 * @interface ApiError
 * @property {number} status - The HTTP status code of the error.
 * @property {string} message - The error message.
 * @property {string} [code] - The error code.
 */
export interface ApiError {
    status: number;
    message: string;
    code?: string;
}

export * from './auth.types';
export * from './devices.types';
export * from './users.types';
export * from './system.types';
export * from './api-keys.types';
export * from './locations.types';
export * from './reports.types';
