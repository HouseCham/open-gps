import type { Translation } from '@/i18n';
import type { DeviceDetail, LocationPoint } from '@/types/api';

/**
 * Downloads the device location history as a CSV file
 * @param {DeviceDetail} device - The device details
 * @param {LocationPoint[]} points - The location points
 * @param {Translation['device']['live']} labels - The labels
 * @returns {void}
 */
export function downloadCsv(
    device: DeviceDetail,
    points: LocationPoint[],
    labels: Translation['device']['live']
): void {
    const header = [
        labels.recorded,
        labels.coordinates,
        labels.speed,
        labels.altitude,
        labels.accuracy,
        labels.source,
    ];
    const rows = points.map(point => [
        point.recorded_at,
        `${point.latitude}, ${point.longitude}`,
        point.speed == null ? '' : String(point.speed),
        point.altitude == null ? '' : String(point.altitude),
        point.accuracy == null ? '' : String(point.accuracy),
        labels.cellular,
    ]);
    const csv = [header, ...rows]
        .map(row =>
            row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')
        )
        .join('\n');
    const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${device.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-locations.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
