import type { JSX } from 'react';

import type { ReportKpiProps } from '@/types/reports';

/** Displays one report summary metric. */
export function ReportKpi({ label, value, unit }: ReportKpiProps): JSX.Element {
    return (
        <div className="reports-kpi">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{unit}</small>
        </div>
    );
}
