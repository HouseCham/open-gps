import type { LocationPoint } from '@/types/api';
import { LIVE_ROUTE_GAP_THRESHOLD_MS } from '@/constants/components';

/**
 * Splits a chronological route when the device missed an expected report.
 * @param {readonly LocationPoint[]} points - The route points to split.
 * @param {number} gapThresholdMs - The minimum gap that starts a new segment.
 * @returns {LocationPoint[][]} The route segments containing at least two points.
 */
export function splitLocationRoute(
    points: readonly LocationPoint[],
    gapThresholdMs: number = LIVE_ROUTE_GAP_THRESHOLD_MS
): LocationPoint[][] {
    if (points.length === 0) return [];

    const ordered = [...points].sort(
        (a, b) =>
            new Date(a.recorded_at).getTime() -
            new Date(b.recorded_at).getTime()
    );
    const segments: LocationPoint[][] = [[ordered[0]]];

    for (let index = 1; index < ordered.length; index += 1) {
        const current = ordered[index];
        const previous = ordered[index - 1];
        const gap =
            new Date(current.recorded_at).getTime() -
            new Date(previous.recorded_at).getTime();
        if (gap >= gapThresholdMs) segments.push([]);
        segments[segments.length - 1].push(current);
    }

    return segments.filter(segment => segment.length > 1);
}
