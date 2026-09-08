import type {
    LiveLocationSnapshot,
    LiveLocationState,
    LocationPoint,
} from '@/types/api';

/**
 * Checks if the provided value is a LocationPoint object.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a LocationPoint object, false otherwise.
 */
function isLocation(value: unknown): value is LocationPoint {
    if (typeof value !== 'object' || value === null) return false;
    // Narrow the validated non-null object so its fields can be inspected safely.
    const point = value as Record<string, unknown>;
    return (
        typeof point.device_id === 'string' &&
        typeof point.recorded_at === 'string' &&
        typeof point.latitude === 'number' &&
        typeof point.longitude === 'number'
    );
}
/**
 * Checks if the provided value is a LiveLocationSnapshot object.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a LiveLocationSnapshot object, false otherwise.
 */
export function isLiveSnapshot(value: unknown): value is LiveLocationSnapshot {
    if (typeof value !== 'object' || value === null) return false;
    // Narrow the validated non-null object so its fields can be inspected safely.
    const snapshot = value as Record<string, unknown>;
    const presence = snapshot.presence;
    if (
        typeof snapshot.device_id !== 'string' ||
        typeof snapshot.server_time !== 'string'
    )
        return false;
    if (typeof presence !== 'object' || presence === null) return false;
    // Narrow presence after the object check to inspect its untrusted state field.
    const state = (presence as Record<string, unknown>).state;
    return (
        [
            'never_seen',
            'online_moving',
            'online_stationary',
            'offline',
        ].includes(String(state)) &&
        (snapshot.location === null || isLocation(snapshot.location))
    );
}
/**
 * Updates the live location state based on the provided snapshot.
 * @param {LiveLocationState} current - The current live location state.
 * @param {LiveLocationSnapshot} next - The new live location snapshot.
 * @param {number} maxPoints - The maximum number of points to keep in the route.
 * @returns {LiveLocationState} The updated live location state.
 */
export function reduceLiveLocation(
    current: LiveLocationState,
    next: LiveLocationSnapshot,
    maxPoints: number
): LiveLocationState {
    if (current.snapshot && current.snapshot.device_id !== next.device_id)
        return current;
    const currentLocation = current.snapshot?.location;
    const nextLocation = next.location;
    const newest =
        currentLocation &&
        nextLocation &&
        nextLocation.recorded_at < currentLocation.recorded_at
            ? currentLocation
            : nextLocation;
    const route = [...current.route];
    if (
        nextLocation &&
        !route.some(point => point.recorded_at === nextLocation.recorded_at)
    ) {
        route.push(nextLocation);
        route.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    }
    return {
        snapshot: { ...next, location: newest },
        route: route.slice(-maxPoints),
    };
}
