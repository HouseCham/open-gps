import { useState } from 'react';
//-- Types
import type { ApiError, Envelope, LocationPoint } from '@/types/api';
//-- Utils
import { toApiError, withApiErrorToast } from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the locations service.
 * @interface ILocationService
 * @property {boolean} isLoading - Whether the service is currently fetching.
 * @property {ApiError | null} error - The error from the last failed call, if any.
 * @property {LocationPoint | null} latest - The device's most recent location, if any has been fetched.
 * @method getLatestLocation - Fetches the device's most recent location.
 */
interface ILocationService {
    isLoading: boolean;
    error: ApiError | null;
    latest: LocationPoint | null;
    getLatestLocation: (deviceId: string) => Promise<void>;
}

/**
 * Hook that wraps the locations read endpoints. Scope today is the
 * "latest" lookup that drives the device-detail map preview; the
 * paginated history endpoint lands with the LivePreview component.
 *
 * Mirrors the shape of `useDeviceService`: `isLoading` flips during
 * the request, `latest` holds the last fetched row, `error` surfaces
 * non-404 failures (a 404 — "never reported" — leaves `latest` as
 * null so the page can render its "Never seen" badge).
 *
 * @returns {ILocationService} State + actions.
 */
export const useLocationService = (): ILocationService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [latest, setLatest] = useState<LocationPoint | null>(null);

    /**
     * Fetches the device's most recent location. The backend's
     * uniform envelope carries the HTTP code in `status_code` even
     * for 4xx, so `better-fetch` returns the parsed envelope as
     * `data` and never sets `error` for an HTTP failure — the only
     * path that throws / sets `error` is a network or parsing
     * failure. A 404 ("no location reported yet") is the "never seen"
     * branch: clear `latest`, leave `error` null, no toast.
     * Any other failure surfaces via the toast bus and the
     * captured `error` state.
     * @param {string} deviceId - UUID of the device to query.
     * @returns {Promise<void>} Resolves once the request settles.
     */
    async function getLatestLocation(deviceId: string): Promise<void> {
        setIsLoading(true);
        setError(null);
        try {
            const { data: response } = await withApiErrorToast(() =>
                apiClient<Envelope<LocationPoint> | null>(
                    `/devices/${deviceId}/locations/latest`,
                    { method: 'GET' }
                )
            );
            if (!response) {
                // Genuinely empty response (shouldn't happen on a
                // 2xx envelope). Treat as an unknown failure so the
                // UI can retry.
                setError(toApiError(new Error('empty response')));
                return;
            }
            if (response.status_code === 404) {
                // "Never reported" — render the disconnected badge
                // without firing an error toast.
                setLatest(null);
                return;
            }
            if (response.status_code !== 200) {
                setError({
                    status: response.status_code,
                    message: response.message,
                });
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: response.message,
                });
                return;
            }
            setLatest(response.data);
        } catch (err) {
            // withApiErrorToast has already pushed a toast; capture
            // the typed error so the caller can render inline too.
            setError(
                err && typeof err === 'object' && 'status' in err
                    ? //'in' narrows to a Record of unknown;
                      // our ApiError is exactly that shape, so the cast
                      // is the tightest available without restructuring
                      // the catch block.
                      (err as ApiError)
                    : toApiError(err)
            );
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        error,
        latest,
        //-- actions
        getLatestLocation,
    };
};
