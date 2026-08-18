import { useState } from 'react';
//-- Types
import type {
    ApiError,
    Envelope,
    LocationHistoryResponse,
    LocationPoint,
    LocationRouteResponse,
    PaginationMeta,
} from '@/types/api';
//-- Constants
import {
    LIVE_ROUTE_MAX_POINTS,
    LOCATION_HISTORY_PAGE_SIZE,
} from '@/constants/components';
//-- Utils
import { isApiError, toApiError, withApiErrorToast } from '@/lib/api/api-utils';
import { toastBus } from '@/lib/stores/toast.store';
//-- Http Client
import { apiClient } from '@/lib/api/client';

/**
 * The interface for the locations service.
 * @interface ILocationService
 * @property {boolean} latestLoading - Whether the latest request is active.
 * @property {boolean} historyLoading - Whether the history request is active.
 * @property {boolean} routeLoading - Whether the route request is active.
 * @property {LocationPoint | null} latest - The device's most recent location, if any has been fetched.
 * @property {LocationPoint[]} history - The current page of historical locations.
 * @property {PaginationMeta | null} historyPagination - Pagination metadata for the history page.
 * @method getLatestLocation - Fetches the device's most recent location.
 * @method getLocationHistory - Fetches a page of locations in a local-time range.
 */
interface ILocationService {
    latestLoading: boolean;
    historyLoading: boolean;
    routeLoading: boolean;
    latestError: ApiError | null;
    historyError: ApiError | null;
    routeError: ApiError | null;
    latest: LocationPoint | null;
    history: LocationPoint[];
    historyPagination: PaginationMeta | null;
    route: LocationRouteResponse | null;
    getLatestLocation: (deviceId: string, silent?: boolean) => Promise<void>;
    getLocationHistory: (
        deviceId: string,
        from: string,
        to: string,
        timeZone: string,
        page?: number,
        pageSize?: number
    ) => Promise<void>;
    getLocationRoute: (
        deviceId: string,
        from: string,
        to: string,
        timeZone: string,
        maxPoints?: number
    ) => Promise<void>;
}

interface LocationRequestOptions<T> {
    request: () => Promise<unknown>;
    setLoading: (loading: boolean) => void;
    setError: (error: ApiError | null) => void;
    onSuccess: (data: T) => void;
    notify?: boolean;
    onStatus?: (status: number) => boolean;
}

function isEnvelope<T>(value: unknown): value is Envelope<T> {
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

async function runLocationRequest<T>({
    request,
    setLoading,
    setError,
    onSuccess,
    notify = true,
    onStatus,
}: LocationRequestOptions<T>): Promise<void> {
    setLoading(true);
    setError(null);
    try {
        const result = await withApiErrorToast(request, notify);
        const response =
            typeof result === 'object' && result !== null && 'data' in result
                ? result.data
                : null;
        if (!isEnvelope<T>(response)) {
            setError(toApiError(new Error('empty response')));
            return;
        }
        if (response.status_code !== 200) {
            if (onStatus?.(response.status_code)) return;
            const error = {
                status: response.status_code,
                message: response.message,
            };
            setError(error);
            if (notify) {
                toastBus.push({
                    variant: 'error',
                    title: 'Error',
                    message: response.message,
                });
            }
            return;
        }
        onSuccess(response.data);
    } catch (error: unknown) {
        setError(isApiError(error) ? error : toApiError(error));
    } finally {
        setLoading(false);
    }
}

/**
 * Hook that wraps the locations read endpoints.
 *
 * Latest, history, and route requests have independent loading and error
 * state because live polling runs while detective-mode requests are active.
 *
 * @returns {ILocationService} State + actions.
 */
export const useLocationService = (): ILocationService => {
    const [latestLoading, setLatestLoading] = useState<boolean>(false);
    const [historyLoading, setHistoryLoading] = useState<boolean>(false);
    const [routeLoading, setRouteLoading] = useState<boolean>(false);
    const [latestError, setLatestError] = useState<ApiError | null>(null);
    const [historyError, setHistoryError] = useState<ApiError | null>(null);
    const [routeError, setRouteError] = useState<ApiError | null>(null);
    const [latest, setLatest] = useState<LocationPoint | null>(null);
    const [history, setHistory] = useState<LocationPoint[]>([]);
    const [historyPagination, setHistoryPagination] =
        useState<PaginationMeta | null>(null);
    const [route, setRoute] = useState<LocationRouteResponse | null>(null);

    /**
     * Fetches the device's most recent location. The backend's
     * uniform envelope carries the HTTP code in `status_code` even
     * for 4xx, so `better-fetch` returns the parsed envelope as
     * `data` and never sets `error` for an HTTP failure — the only
     * path that throws / sets `error` is a network or parsing
     * failure. A 404 ("no location reported yet") is the "never seen"
     * branch: clear `latest`, leave `latestError` null, and do not toast.
     * Any other failure is captured for inline rendering; background polls
     * suppress their toast to avoid repeating transient errors.
     * @param {string} deviceId - UUID of the device to query.
     * @returns {Promise<void>} Resolves once the request settles.
     */
    async function getLatestLocation(
        deviceId: string,
        silent = false
    ): Promise<void> {
        await runLocationRequest<LocationPoint>({
            request: () =>
                apiClient<Envelope<LocationPoint> | null>(
                    `/devices/${deviceId}/locations/latest`,
                    { method: 'GET' }
                ),
            setLoading: setLatestLoading,
            setError: setLatestError,
            notify: !silent,
            onStatus: status => {
                if (status !== 404) return false;
                setLatest(null);
                return true;
            },
            onSuccess: data => setLatest(data),
        });
    }

    /**
     * Fetches a page of historical locations. `from` and `to` are local
     * wall-clock values in `timeZone`; the backend converts them to UTC.
     * @param {string} deviceId - UUID of the device to query.
     * @param {string} from - Local start time in YYYY-MM-DDTHH:mm:ss format.
     * @param {string} to - Local end time in YYYY-MM-DDTHH:mm:ss format.
     * @param {string} timeZone - IANA timezone, such as America/Mexico_City.
     * @param {number} [page=1] - The page number to retrieve.
     * @param {number} [pageSize=LOCATION_HISTORY_PAGE_SIZE] - The number of items to retrieve.
     * @returns {Promise<void>} Resolves once the request settles.
     */
    async function getLocationHistory(
        deviceId: string,
        from: string,
        to: string,
        timeZone: string,
        page: number = 1,
        pageSize: number = LOCATION_HISTORY_PAGE_SIZE
    ): Promise<void> {
        setHistory([]);
        setHistoryPagination(null);
        await runLocationRequest<LocationHistoryResponse>({
            request: () =>
                apiClient<Envelope<LocationHistoryResponse> | null>(
                    `/devices/${deviceId}/locations`,
                    {
                        method: 'GET',
                        query: {
                            from,
                            to,
                            'time-zone': timeZone,
                            page,
                            page_size: pageSize,
                        },
                    }
                ),
            setLoading: setHistoryLoading,
            setError: setHistoryError,
            onSuccess: response => {
                setHistory(response.items);
                setHistoryPagination(response.pagination);
            },
        });
    }

    async function getLocationRoute(
        deviceId: string,
        from: string,
        to: string,
        timeZone: string,
        maxPoints: number = LIVE_ROUTE_MAX_POINTS
    ): Promise<void> {
        setRoute(null);
        await runLocationRequest<LocationRouteResponse>({
            request: () =>
                apiClient<Envelope<LocationRouteResponse> | null>(
                    `/devices/${deviceId}/locations/route`,
                    {
                        method: 'GET',
                        query: {
                            from,
                            to,
                            'time-zone': timeZone,
                            max_points: maxPoints,
                        },
                    }
                ),
            setLoading: setRouteLoading,
            setError: setRouteError,
            onSuccess: data => setRoute(data),
        });
    }

    return {
        latestLoading,
        historyLoading,
        routeLoading,
        latestError,
        historyError,
        routeError,
        latest,
        history,
        historyPagination,
        route,
        //-- actions
        getLatestLocation,
        getLocationHistory,
        getLocationRoute,
    };
};
