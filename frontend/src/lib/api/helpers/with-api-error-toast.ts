import { BetterFetchError } from '@better-fetch/fetch';
import { toastBus } from '@/lib/stores/toast.store';
import { asApiError, betterFetchErrorToApi, isApiError } from '../api-utils';
import type { ApiError } from '@/types/api';

/**
 * Maps an HTTP status to a short error title used as the toast header.
 * These are i18n-free on purpose — they are short, stable, and doubled
 * as `aria-label` on the toast.
 * @param {number} status - The HTTP status code.
 * @returns {string} A short title.
 */
function titleForStatus(status: number): string {
    if (status === 0) return 'Network error';
    if (status === 401) return 'Unauthorized';
    if (status === 403) return 'Forbidden';
    if (status === 404) return 'Not found';
    if (status >= 500) return 'Server error';
    return 'Error';
}

/**
 * Coerces any thrown value into a typed {@link ApiError}. Handles
 * `BetterFetchError` (extracts status + cause.message + cause.code) and
 * a plain `Error` (uses its message with status 0) before falling back
 * to the network-error default.
 * @param {unknown} error - The thrown value.
 * @returns {ApiError} A normalized error.
 */
function toError(error: unknown): ApiError {
    if (error instanceof BetterFetchError) {
        return betterFetchErrorToApi(error);
    }
    if (isApiError(error)) return error;
    const { message } = asApiError(error);
    if (error instanceof Error) {
        return { status: 0, message: error.message };
    }
    return { status: 0, message: message ?? 'Network error' };
}

/**
 * Runs `fn` and surfaces any thrown value as a top-level toast, then
 * re-throws so the caller can still handle it inline (e.g. set a
 * form-level error banner). One guard in the shared function is a
 * smaller diff than a guard in every caller.
 *
 * @example
 *   try {
 *       await withApiErrorToast(() => apiClient('/devices', { method: 'POST' }));
 *   } catch (err) {
 *       // err is still a typed ApiError; show inline if you want.
 *   }
 *
 * @param {() => Promise<T>} fn - The async work to run.
 * @returns {Promise<T>} The resolved value of `fn`.
 * @throws {ApiError} Rethrows the typed `ApiError` so the caller can
 *   still render an inline error if it wants.
 */
export async function withApiErrorToast<T>(
    fn: () => Promise<T>,
    notify = true
): Promise<T> {
    try {
        return await fn();
    } catch (error: unknown) {
        const apiErr = toError(error);
        if (notify) {
            toastBus.push({
                variant: 'error',
                title: titleForStatus(apiErr.status),
                message: apiErr.message,
            });
        }
        throw apiErr;
    }
}
