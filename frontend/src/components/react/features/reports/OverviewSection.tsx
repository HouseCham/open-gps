import type { JSX } from 'react';

import { ReportKpi } from './ReportKpi';
import { ReportTable } from './ReportTable';
import { formatReportDate, formatReportMetric } from '@/lib/reports-utils';
import type { OverviewContentProps } from '@/types/reports';

/** Renders overview KPIs and per-device activity summaries. */
export function OverviewSection({
    data,
    translations: t,
}: OverviewContentProps): JSX.Element {
    return (
        <>
            <div className="reports-kpis">
                <ReportKpi
                    label={t.kpis.activity}
                    value={String(data.device_count)}
                    unit={t.units.devices}
                />
                <ReportKpi
                    label={t.kpis.points}
                    value={String(data.point_count)}
                    unit={t.units.points}
                />
                <ReportKpi
                    label={t.kpis.distance}
                    value={formatReportMetric(
                        data.estimated_distance_km,
                        t.units.kilometers
                    )}
                    unit={t.estimated}
                />
                <ReportKpi
                    label={t.kpis.interruption}
                    value={formatReportMetric(
                        data.longest_gap_seconds / 60,
                        t.units.minutes
                    )}
                    unit={t.longestGap}
                />
            </div>
            <ReportTable>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.overview.points}</th>
                        <th>{t.overview.distance}</th>
                        <th>{t.overview.firstReport}</th>
                        <th>{t.overview.lastReport}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.devices.map(item => (
                        <tr key={item.device.id}>
                            <td>
                                <strong>{item.device.name}</strong>
                                <small>{item.device.vehicle_type}</small>
                            </td>
                            <td>{item.point_count}</td>
                            <td>
                                {formatReportMetric(
                                    item.estimated_distance_km,
                                    t.units.kilometers
                                )}
                            </td>
                            <td>{formatReportDate(item.first_report)}</td>
                            <td>{formatReportDate(item.latest_report)}</td>
                        </tr>
                    ))}
                </tbody>
            </ReportTable>
        </>
    );
}
