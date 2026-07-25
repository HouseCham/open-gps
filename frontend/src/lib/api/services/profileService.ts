import { useState } from 'react';
//-- Types
import type {
    ApiError,
    DeviceCountResponse,
    Envelope,
    ProfileResponse,
} from '@/types/api';
//-- Utils
import { isApiError, toApiError } from '@/lib/api/api-utils';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the profile service.
 * @interface IProfileService
 * @property {boolean} isLoading - Whether the service is currently loading data.
 * @property {ApiError | null} error - The error that occurred, if any.
 * @property {ProfileResponse['user'] | null} profile - The authenticated user's full local projection.
 * @property {number | null} deviceCount - The number of devices the user has access to.
 * @method refresh - Re-fetches both the profile and the device count in parallel.
 */
interface IProfileService {
    isLoading: boolean;
    error: ApiError | null;
    profile: ProfileResponse['user'] | null;
    deviceCount: number | null;
    refresh: () => Promise<void>;
}

/**
 * Hook that fetches the authenticated user's profile and the number of
 * devices they have access to. Both requests are fired in parallel on
 * first call to `refresh()`.
 *
 * Mirrors `useDeviceService`'s shape so callers get a single
 * `{ isLoading, error, ...data, refresh }` surface. Errors are captured
 * in state (not re-thrown) so the caller can render an inline retry
 * instead of relying on a global error boundary.
 */
export const useProfileService = (): IProfileService => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [profile, setProfile] = useState<ProfileResponse['user'] | null>(
        null
    );
    const [deviceCount, setDeviceCount] = useState<number | null>(null);

    /**
     * Fetches the profile and device count in parallel. Sets
     * `isLoading` for the duration and surfaces any non-401 failure
     * via `error`. A null response (e.g. 401 "not signed in") leaves
     * `profile` / `deviceCount` untouched so the page keeps its last
     * known state instead of blanking out.
     */
    async function refresh(): Promise<void> {
        setIsLoading(true);
        setError(null);
        try {
            const [profileRes, countRes] = await Promise.all([
                apiClient<Envelope<ProfileResponse['user']> | null>(
                    '/users/me',
                    { method: 'GET' }
                ),
                apiClient<Envelope<DeviceCountResponse> | null>(
                    '/devices/count',
                    { method: 'GET' }
                ),
            ]);

            if (profileRes.data?.data) {
                setProfile(profileRes.data.data);
            }
            if (countRes.data?.data) {
                setDeviceCount(countRes.data.data.total);
            }
        } catch (error) {
            //* note: existing services re-throw via handleApiError so
            //   the React error boundary catches them; the profile page
            //   needs an inline retry instead, so we capture the
            //   ApiError-shaped object into state. No cast needed —
            //   isApiError narrows straight to ApiError via its typed
            //   field checks.
            setError(isApiError(error) ? error : toApiError(error));
        } finally {
            setIsLoading(false);
        }
    }

    return {
        isLoading,
        error,
        profile,
        deviceCount,
        refresh,
    };
};
