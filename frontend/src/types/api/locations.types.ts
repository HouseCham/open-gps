import type { PaginationMeta } from './devices.types';

/**
 * One location row as returned by the read-side locations endpoints.
 * Field names mirror the backend `LocationResponse` shape (snake_case)
 * so the wire payload maps 1:1 — no client-side renaming needed.
 *
 * Nullable telemetry fields stay as `| null` so a missing sensor
 * reading surfaces in the UI as "—" rather than a misleading zero.
 *
 * @interface LocationPoint
 * @property {string} device_id - UUID of the device that reported the row.
 * @property {string} recorded_at - ISO 8601 timestamp of the GPS fix.
 * @property {number} latitude - WGS84 latitude (decimal degrees).
 * @property {number} longitude - WGS84 longitude (decimal degrees).
 * @property {number | null} altitude - Altitude above sea level (meters).
 * @property {number | null} speed - Ground speed (m/s).
 * @property {number | null} accuracy - Position accuracy (meters).
 * @property {number | null} battery_voltage - Reported battery voltage (volts).
 * @property {number | null} signal_strength - Cellular RSSI (`0`–`31`).
 */
export interface LocationPoint {
    device_id: string;
    recorded_at: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    accuracy: number | null;
    battery_voltage: number | null;
    signal_strength: number | null;
}

/**
 * Response shape for the History API endpoint, which returns a paginated list of location points.
 * @interface LocationHistoryResponse
 * @property {LocationPoint[]} items - Array of location points.
 * @property {PaginationMeta} pagination - Pagination metadata.
 */
export interface LocationHistoryResponse {
    items: LocationPoint[];
    pagination: PaginationMeta;
}

/**
 * Bounded chronological route returned by the detective-mode route endpoint.
 */
export interface LocationRouteResponse {
    items: LocationPoint[];
    total_points: number;
    returned: number;
    sampled: boolean;
}

/**
 * Type alias for the presence state of a device.
 */
export type DevicePresenceState =
    | 'never_seen'
    | 'online_moving'
    | 'online_stationary'
    | 'offline';

/**
 * Interface for the presence state of a device.
 * @interface DevicePresence
 * @property {DevicePresenceState} state - The presence state of the device.
 * @property {string | null} last_contact_at - ISO timestamp of the last contact, or null if never seen.
 * @property {string | null} expires_at - ISO timestamp when the presence state expires, or null if never seen.
 */
export interface DevicePresence {
    state: DevicePresenceState;
    last_contact_at: string | null;
    expires_at: string | null;
}
/**
 * Interface for a live location snapshot of a device.
 * @interface LiveLocationSnapshot
 * @property {string} device_id - UUID of the device that reported the snapshot.
 * @property {LocationPoint | null} location - The latest location point, or null if unavailable.
 * @property {DevicePresence} presence - The presence state of the device.
 * @property {string} server_time - ISO timestamp when the snapshot was generated on the server.
 */
export interface LiveLocationSnapshot {
    device_id: string;
    location: LocationPoint | null;
    presence: DevicePresence;
    server_time: string;
}
/**
 * Type alias for the connection state of a live location stream.
 * @typedef LiveStreamConnectionState
 * @property {'connecting' | 'live' | 'reconnecting' | 'fallback'} LiveStreamConnectionState - The connection state of the live location stream.
 */
export type LiveStreamConnectionState =
    | 'connecting'
    | 'live'
    | 'reconnecting'
    | 'fallback';

/**
 * Type alias for the connection state of a device.
 * @typedef ConnectionState
 */
export type ConnectionState = 'online' | 'disconnected' | 'neverSeen';

/**
 * Interface for the live location state.
 * @interface LiveLocationState
 * @property {LiveLocationSnapshot | null} snapshot - The latest live location snapshot for the device.
 * @property {LocationPoint[]} route - The route of the device based on the live location data.
 */
export interface LiveLocationState {
    snapshot: LiveLocationSnapshot | null;
    route: LocationPoint[];
}