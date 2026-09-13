import type { JSX } from 'react';

import { ReportDisclaimer } from './ReportDisclaimer';
import { ReportTable } from './ReportTable';
import { formatReportMetric } from '@/lib/reports-utils';
import type { RoutesContentProps } from '@/types/reports';

/** Renders route sessions and their simplified display point counts. */
export function RoutesSection({
    data,
    translations: t,
}: RoutesContentProps): JSX.Element {
    return (
        <>
            <ReportDisclaimer>{t.routes.disclaimer}</ReportDisclaimer>
            <ReportTable>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.routes.duration}</th>
                        <th>{t.routes.distance}</th>
                        <th>{t.routes.averageSpeed}</th>
                        <th>{t.routes.routePoints}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.routes.map(route => (
                        <tr key={`${route.device.id}-${route.started_at}`}>
                            <td>{route.device.name}</td>
                            <td>
                                {formatReportMetric(
                                    route.duration_seconds / 60,
                                    t.units.minutes
                                )}
                            </td>
                            <td>
                                {formatReportMetric(
                                    route.distance_km,
                                    t.units.kilometers
                                )}
                            </td>
                            <td>
                                {formatReportMetric(
                                    route.average_speed_kph,
                                    t.units.speed
                                )}
                            </td>
                            <td>
                                {route.complete_point_count}{' '}
                                <small>
                                    ({route.returned_point_count} {t.display})
                                </small>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ReportTable>
        </>
    );
}
