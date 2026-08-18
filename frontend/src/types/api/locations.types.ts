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
 * Type alias for the connection state of a device.
 * @typedef ConnectionState
 */
export type ConnectionState = 'online' | 'disconnected' | 'neverSeen';
