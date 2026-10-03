import type { ApiError, Envelope } from '@/types/api';
import { BetterFetchError } from '@better-fetch/fetch';
/**
 * Checks if the provided value is an ApiError object.
 * Validates the field types so the guard narrows to the full `ApiError`
 * shape (status: number, message: string); callers that need to store
 * the value in `ApiError`-typed state don't need a follow-up cast.
 * @param {unknown} error - The value to check.
 * @returns {boolean} True if the value is an ApiError object, false otherwise.
 */
export function isApiError(error: unknown): error is ApiError {
    if (typeof error !== 'object' || error === null) return false;
    const e = error as Record<string, unknown>;
    return typeof e.status === 'number' && typeof e.message === 'string';
}
/**
 * Narrows an unknown thrown value (typically from `handleApiError`) into a
 * partial {@link ApiError} shape so callers can pluck `message` for inline
 * UI without each component redefining its own guard.
 * @param {unknown} err - Whatever the rejected promise gave us.
 * @returns {{ message?: string }} A safe subset of fields for rendering.
 */
export function asApiError(err: unknown): { message?: string } {
    if (typeof err === 'object' && err !== null) {
        //* note: at this point `err` is `object & not null`. The narrowed
        //   shape is consumed defensively (only `?.message` is read) so a
        //   stray `message` field is the worst-case we accept.
        return err as { message?: string };
    }
    return {};
}
/**
 * Normalizes any thrown value into the {@link ApiError} shape. Used as the
 * network-error fallback in {@link handleApiError} and in services that
 * capture errors into state instead of re-throwing.
 * @param {unknown} error - The value to normalize.
 * @returns {ApiError} An `ApiError` with `status: 0` and the throw's message
 *   (or `'Network error'` if the value isn't an `Error`).
 */
export function toApiError(error: unknown): ApiError {
    return {
        status: 0,
        message: error instanceof Error ? error.message : 'Network error',
    };
}

/**
 * Converts a `BetterFetchError` into an {@link ApiError}. The cause is the
 * parsed JSON body shape (undefined when the response had no/empty body),
 * so the cast below is defensive: we only read `message`/`code` off it and
 * fall back to defaults if either is absent or the body is missing.
 * @param {BetterFetchError} error - The error thrown by `better-fetch`.
 * @returns {ApiError} The normalized error.
 */
export function betterFetchErrorToApi(error: BetterFetchError): ApiError {
    const body = error.cause as { message?: string; code?: string } | undefined;
    return {
        status: error.status,
        message: body?.message || 'An unexpected error occurred',
        code: body?.code,
    };
}

/**
 * Handles errors thrown by the API.
 * @param {unknown} error - The error to handle.
 * @throws {ApiError} An object containing the error status, message, and code.
 */
export function handleApiError(error: unknown): never {
    if (error instanceof BetterFetchError) {
        throw betterFetchErrorToApi(error);
    }

    throw toApiError(error);
}

export { withApiErrorToast } from './helpers/with-api-error-toast';
/**
 * Checks if the provided value is an Envelope object from the API documentation.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an Envelope object, false otherwise.
 */
export function isEnvelope<T>(value: unknown): value is Envelope<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'status_code' in value &&
        typeof value.status_code === 'number' &&
        'message' in value &&
        typeof value.message === 'string' &&
        'data' in value
    );
}
