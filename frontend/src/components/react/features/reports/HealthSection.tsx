import type { JSX } from 'react';

import { ReportTable } from './ReportTable';
import { formatReportMetric } from '@/lib/reports-utils';
import type { HealthContentProps } from '@/types/reports';

/** Renders available device telemetry without replacing null values with zeroes. */
export function HealthSection({
    data,
    translations: t,
}: HealthContentProps): JSX.Element {
    return (
        <ReportTable>
            <thead>
                <tr>
                    <th>{t.overview.device}</th>
                    <th>{t.health.battery}</th>
                    <th>{t.health.averageBattery}</th>
                    <th>{t.health.signal}</th>
                    <th>{t.health.gpsAccuracy}</th>
                    <th>{t.health.reports}</th>
                </tr>
            </thead>
            <tbody>
                {data.devices.map(device => (
                    <tr key={device.device.id}>
                        <td>{device.device.name}</td>
                        <td>
                            {formatReportMetric(
                                device.battery_voltage.latest,
                                'V'
                            )}
                        </td>
                        <td>
                            {formatReportMetric(
                                device.battery_voltage.average,
                                'V'
                            )}
                        </td>
                        <td>
                            {device.signal_strength.latest == null
                                ? '—'
                                : `${device.signal_strength.latest} CSQ`}
                        </td>
                        <td>
                            {formatReportMetric(
                                device.gps_accuracy.average,
                                'm'
                            )}
                        </td>
                        <td>{device.point_count}</td>
                    </tr>
                ))}
            </tbody>
        </ReportTable>
    );
}
