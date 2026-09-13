import type { JSX } from 'react';

import { ReportDisclaimer } from './ReportDisclaimer';
import { ReportTable } from './ReportTable';
import { formatReportMetric } from '@/lib/reports-utils';
import type { QualityContentProps } from '@/types/reports';

/** Renders reporting continuity and GPS quality indicators. */
export function QualitySection({
    data,
    translations: t,
}: QualityContentProps): JSX.Element {
    return (
        <>
            <ReportDisclaimer>
                {t.quality.continuityDisclaimer}
            </ReportDisclaimer>
            <ReportTable>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.overview.points}</th>
                        <th>{t.quality.averageInterval}</th>
                        <th>{t.quality.largestInterruption}</th>
                        <th>{t.quality.coordinateJumps}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.devices.map(device => (
                        <tr key={device.device.id}>
                            <td>{device.device.name}</td>
                            <td>{device.point_count}</td>
                            <td>
                                {formatReportMetric(
                                    device.average_interval_seconds,
                                    's'
                                )}
                            </td>
                            <td>
                                {formatReportMetric(
                                    device.longest_gap_seconds / 60,
                                    t.units.minutes
                                )}
                            </td>
                            <td>{device.jump_count}</td>
                        </tr>
                    ))}
                </tbody>
            </ReportTable>
        </>
    );
}
