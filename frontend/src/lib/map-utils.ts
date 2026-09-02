//-- Types
import type { Translation } from '@/i18n';
import type { LocationPoint } from '@/types/api';
import type {
    Coordinate,
    DeviceMapRoutePoint,
    MarkerStatus,
} from '@/types/components';
//-- Constants
import {
    MAP_MAX_ACCURACY_M,
    MAP_MIN_DELTA_DEG,
    MAP_PROJECTION_GRID_SIZE,
    MAP_PROJECTION_LAT_MAX,
    MAP_PROJECTION_LAT_MIN,
    MAP_PROJECTION_LONGITUDE_OFFSET,
    MAP_PROJECTION_LONGITUDE_RANGE,
} from '@/constants';
import { MAP_COORDINATE_DECIMALS } from '@/constants/components';

/**
 * Project a latitude and longitude onto a 100x100 grid
 * @param {number} lat - The latitude to project.
 * @param {number} lng - The longitude to project.
 * @returns {{x: number, y: number}} The projected coordinates.
 */
export function projectCoordinate(lat: number, lng: number): Coordinate {
    const x =
        ((lng + MAP_PROJECTION_LONGITUDE_OFFSET) /
            MAP_PROJECTION_LONGITUDE_RANGE) *
        MAP_PROJECTION_GRID_SIZE;
    const y =
        ((MAP_PROJECTION_LAT_MAX - lat) /
            (MAP_PROJECTION_LAT_MAX - MAP_PROJECTION_LAT_MIN)) *
        MAP_PROJECTION_GRID_SIZE;
    return {
        x: Math.max(0, Math.min(MAP_PROJECTION_GRID_SIZE, x)),
        y: Math.max(0, Math.min(MAP_PROJECTION_GRID_SIZE, y)),
    };
}
/**
 * Format a latitude and longitude into a human-readable string.
 * @param {number} lat - The latitude to format.
 * @param {number} lng - The longitude to format.
 * @returns {string} The formatted coordinates.
 */
export function formatCoords(lat: number, lng: number): string {
    return `${Math.abs(lat).toFixed(MAP_COORDINATE_DECIMALS)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(MAP_COORDINATE_DECIMALS)}° ${lng >= 0 ? 'E' : 'W'}`;
}
/**
 * Convert a route into a SVG path string.
 * @param {DeviceMapRoutePoint[]} route - The route to convert.
 * @returns {string} The SVG path string.
 */
export function getPathFromRoute(
    route: readonly DeviceMapRoutePoint[]
): string {
    if (route.length === 0) return '';
    return route
        .map((p, i) => {
            const { x, y } = projectCoordinate(p.lat, p.lng);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
}
/**
 * Get the labels for the map status markers.
 * @param {Translation} t - The translation object.
 * @returns {Record<MarkerStatus, string>} The labels for the map status markers.
 */
export function getMapStatusLabels(
    t: Translation
): Record<MarkerStatus, string> {
    return {
        online: t.device.online,
        offline: t.device.offline,
        'never-seen': t.device.neverSeen,
        unknown: t.device.unknown,
    };
}

/**
 * Returns the straight-line distance between two [lng, lat] pairs in degrees.
 * Good enough for the tiny distances between GPS samples.
 * @param {readonly [number, number]} a - The first [longitude, latitude] pair.
 * @param {readonly [number, number]} b - The second [longitude, latitude] pair.
 * @returns {number} The straight-line distance in degrees.
 */
export function getDeltaDistance(
    a: readonly [number, number],
    b: readonly [number, number]
): number {
    const dLng = a[0] - b[0];
    const dLat = a[1] - b[1];
    return Math.sqrt(dLng * dLng + dLat * dLat);
}

/**
 * Filters and deduplicates a single route segment's points.
 *
 * Steps applied per segment (order matters):
 *   1. Exclude points with accuracy > MAP_MAX_ACCURACY_M (bad GPS fix).
 *   2. Skip points too close to the previous accepted point (stationary noise).
 *
 * Returns null when fewer than 2 points remain — the segment is then dropped
 * entirely from rendering so we never draw an invisible zero-length line.
 * @param {readonly LocationPoint[]} segment - The route segment to process.
 * @returns {[number, number][] | null} The processed coordinates, or null when fewer than two remain.
 */
export function processSegment(
    segment: readonly LocationPoint[]
): [number, number][] | null {
    const coords: [number, number][] = [];
    let last: [number, number] | null = null;

    for (const p of segment) {
        // 1. Filter by accuracy when the field is present.
        if (p.accuracy != null && p.accuracy > MAP_MAX_ACCURACY_M) continue;

        const coord: [number, number] = [p.longitude, p.latitude];

        // 2. Skip near-duplicate positions (stationary cluster → single point).
        if (last !== null && getDeltaDistance(last, coord) < MAP_MIN_DELTA_DEG)
            continue;

        coords.push(coord);
        last = coord;
    }

    return coords.length >= 2 ? coords : null;
}

/**
 * Builds a stable cache key from routeSegments without allocating a huge
 * joined string. Uses the first and last recorded_at of every segment, so
 * changes to middle points are not represented in the key.
 * @param {readonly (readonly LocationPoint[])[]} segments - The route segments.
 * @returns {string} A cache key derived from each segment's first and last timestamps.
 */
export function buildRouteKey(
    segments: readonly (readonly LocationPoint[])[]
): string {
    return segments
        .map(
            s =>
                `${s[0]?.recorded_at ?? ''}~${s[s.length - 1]?.recorded_at ?? ''}`
        )
        .join('|');
}
