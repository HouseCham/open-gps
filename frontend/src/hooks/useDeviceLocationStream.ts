import { useCallback, useEffect, useState } from 'react';
//-- Types
import type {
    ApiError,
    LiveLocationSnapshot,
    LiveLocationState,
    LiveStreamConnectionState,
} from '@/types/api';
//-- Utils
import { apiClient } from '@/lib/api/client';
import { isLiveSnapshot, reduceLiveLocation } from '@/lib/live-location';
import { toApiError } from '@/lib/api';
//-- Constants
import { LIVE_ROUTE_MAX_POINTS } from '@/constants/components';
import { API_RETRY_DELAYS, EMPTY_LIVE_LOCATION_STATE } from '@/constants';

/**
 * Interface for the useDeviceLocationStream hook.
 * @property {LiveLocationSnapshot | null} snapshot - The latest live location snapshot for the device.
 * @property {LocationPoint[]} route - The route of the device based on the live location data.
 * @property {LiveStreamConnectionState} connectionState - The current state of the live stream connection.
 * @property {ApiError | null} error - Any error that occurred while fetching the live location data.
 * @property {() => Promise<void>} refresh - A function to manually refresh the live location data.
 * @returns {useDeviceLocationStreamInterface}
 */
interface useDeviceLocationStreamInterface {
    snapshot: LiveLocationSnapshot | null;
    route: LiveLocationState['route'];
    connectionState: LiveStreamConnectionState;
    error: ApiError | null;
    refresh: () => Promise<void>;
}
/**
 * Provides a live stream of location data for a device.
 * @param {string | null} deviceId - The ID of the device to stream location data for.
 * @returns {useDeviceLocationStreamInterface} An object containing the live location snapshot, route, connection state, error, and a refresh function.
 * @throws {Error} If the deviceId is null or invalid.
 */
export function useDeviceLocationStream(
    deviceId: string | null
): useDeviceLocationStreamInterface {
    const [state, setState] = useState<LiveLocationState>(
        EMPTY_LIVE_LOCATION_STATE
    );
    const [connectionState, setConnectionState] =
        useState<LiveStreamConnectionState>('connecting');
    const [error, setError] = useState<ApiError | null>(null);

    /**
     * Fetches the latest live location data for the device and updates the state.
     * @returns {Promise<void>} A promise that resolves when the data has been fetched and the state has been updated.
     * @throws {Error} If the deviceId is null or invalid, or if the API request fails.
     */
    // Keep refresh stable so the stream effect reconnects only when deviceId changes.
    const refresh = useCallback(async () => {
        if (!deviceId) return;
        try {
            const result = await apiClient<{ data?: { data?: unknown } }>(
                `/devices/${deviceId}/locations/live`,
                { method: 'GET' }
            );
            const response = result.data?.data;
            if (!isLiveSnapshot(response))
                throw new Error('Invalid live location response');
            setState(previous =>
                reduceLiveLocation(previous, response, LIVE_ROUTE_MAX_POINTS)
            );
            setError(null);
        } catch (reason: unknown) {
            setError(toApiError(reason));
        }
    }, [deviceId]);

    /**
     * Sets up the live location stream for the device and handles incoming events.
     */
    useEffect(() => {
        setState(EMPTY_LIVE_LOCATION_STATE);
        if (!deviceId) {
            return;
        }
        let source: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let fallbackTimer: ReturnType<typeof setInterval> | null = null;
        let attempt = 0;
        let stopped = false;

        void refresh();

        /**
         * Establishes a connection to the live location stream for the device and handles incoming events.
         * @returns {void}
         * @throws {Error} If the deviceId is null or invalid, or if the EventSource connection fails.
         */
        const connect = (): void => {
            if (stopped) return;
            setConnectionState(attempt ? 'reconnecting' : 'connecting');
            source = new EventSource(
                `/api/v1/devices/${deviceId}/locations/stream`
            );
            const handle = (event: MessageEvent<string>): void => {
                try {
                    const value: unknown = JSON.parse(event.data);
                    if (!isLiveSnapshot(value))
                        throw new Error('Invalid live stream event');
                    setState(previous =>
                        reduceLiveLocation(
                            previous,
                            value,
                            LIVE_ROUTE_MAX_POINTS
                        )
                    );
                    setError(null);
                } catch (reason: unknown) {
                    setError(toApiError(reason));
                    void refresh();
                }
            };
            source.addEventListener('snapshot', handle);
            source.addEventListener('location', handle);
            source.addEventListener('presence', handle);
            source.onopen = (): void => {
                attempt = 0;
                setConnectionState('live');
                if (fallbackTimer) {
                    clearInterval(fallbackTimer);
                    fallbackTimer = null;
                }
            };
            source.onerror = (): void => {
                source?.close();
                source = null;
                const delay =
                    API_RETRY_DELAYS[
                        Math.min(attempt, API_RETRY_DELAYS.length - 1)
                    ] ?? 15000;
                attempt += 1;
                if (attempt >= 3) {
                    setConnectionState('fallback');
                    if (!fallbackTimer)
                        fallbackTimer = setInterval(
                            () => void refresh(),
                            60000
                        );
                } else {
                    setConnectionState('reconnecting');
                }
                retryTimer = setTimeout(connect, delay);
            };
        };
        connect();
        return (): void => {
            stopped = true;
            source?.close();
            if (retryTimer) clearTimeout(retryTimer);
            if (fallbackTimer) clearInterval(fallbackTimer);
        };
    }, [deviceId, refresh]);

    return {
        snapshot: state.snapshot,
        route: state.route,
        connectionState,
        error,
        refresh,
    };
}
